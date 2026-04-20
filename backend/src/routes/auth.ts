import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { requireMinRole } from '../middleware/rbac';
import { AuthRequest } from '../types';
import { createAuditLog } from '../services/audit.service';
import { sendInviteEmail, sendPasswordResetEmail, buildInviteUrl, isEmailConfigured } from '../services/email.service';
import {
  hashPassword,
  comparePassword,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  registerOwner,
  createInvitedUser,
  acceptInvite,
  generateResetToken,
} from '../services/auth.service';
import { emitToCompany } from '../lib/socket';
import { getCompanyId } from '../lib/company';

const router = Router();

// ─── In-memory brute force protection ───────────────────────────────────────

const loginAttempts = new Map<string, { count: number; firstAttempt: number }>();
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_LOGIN_ATTEMPTS = 10;

function checkLoginRateLimit(identifier: string): boolean {
  const now = Date.now();
  const record = loginAttempts.get(identifier);
  if (!record || now - record.firstAttempt > LOGIN_WINDOW_MS) {
    loginAttempts.set(identifier, { count: 1, firstAttempt: now });
    return true;
  }
  if (record.count >= MAX_LOGIN_ATTEMPTS) return false;
  record.count++;
  return true;
}

function clearLoginRateLimit(identifier: string): void {
  loginAttempts.delete(identifier);
}

// ─── Cookie helpers ──────────────────────────────────────────────────────────

const IS_PROD = process.env.NODE_ENV === 'production';

// Cross-domain deployments (frontend on Vercel, backend on Railway) require
// SameSite=None; Secure so the browser actually sends cookies cross-site.
const COOKIE_SAME_SITE: 'none' | 'lax' = IS_PROD ? 'none' : 'lax';

function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: COOKIE_SAME_SITE,
    maxAge: 15 * 60 * 1000, // 15 minutes
  });
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: COOKIE_SAME_SITE,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

function clearAuthCookies(res: Response): void {
  const opts = { httpOnly: true, secure: IS_PROD, sameSite: COOKIE_SAME_SITE };
  res.clearCookie('accessToken', opts);
  res.clearCookie('refreshToken', opts);
}

// ─── Register (create account + company + owner) ────────────────────────────

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  full_name: z.string().min(1),
  company_name: z.string().min(1),
});

router.post('/register', validate(registerSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { email, password, full_name, company_name } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    const { user, account, company } = await registerOwner(email, password, full_name, company_name);

    // Auto-promote superadmin on registration if env var matches
    const superadminEmails = (process.env.SUPERADMIN_EMAIL || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
    if (superadminEmails.includes(user.email.toLowerCase()) && user.platform_role !== 'superadmin') {
      await prisma.user.update({ where: { id: user.id }, data: { platform_role: 'superadmin' } });
      user.platform_role = 'superadmin' as any;
      console.log(`Auto-promoted ${user.email} to superadmin on registration`);
    }

    const payload = { userId: user.id, email: user.email, role: user.role, platform_role: user.platform_role };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    await createAuditLog({
      action: 'create',
      entityType: 'user',
      entityId: user.id,
      performedBy: user.id,
      details: 'Account registration',
    });

    // Notify admin dashboard of new signup
    emitToCompany(company.id, 'account:created', { owner_email: account.owner_email, owner_name: account.owner_name });

    setAuthCookies(res, accessToken, refreshToken);
    res.status(201).json({
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role, platform_role: user.platform_role },
      account,
      company,
    });
  } catch (error) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

// ─── Login ──────────────────────────────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post('/login', validate(loginSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { email, password } = req.body;

    // Brute force protection
    const identifier = `${req.ip}:${email}`;
    if (!checkLoginRateLimit(identifier)) {
      res.status(429).json({ error: 'Too many login attempts. Try again in 15 minutes.' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password_hash) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const valid = await comparePassword(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // Auto-promote superadmin on login if env var matches
    const superadminEmails = (process.env.SUPERADMIN_EMAIL || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
    if (superadminEmails.includes(user.email.toLowerCase()) && user.platform_role !== 'superadmin') {
      await prisma.user.update({ where: { id: user.id }, data: { platform_role: 'superadmin' } });
      user.platform_role = 'superadmin' as any;
      console.log(`Auto-promoted ${user.email} to superadmin on login`);
    }

    if (user.status !== 'active') {
      res.status(403).json({ error: 'Account is not active' });
      return;
    }

    // Check account status and trial expiry — for owners and workers
    let account = await prisma.account.findFirst({
      where: { owner_email: user.email },
    });
    if (!account) {
      // For non-owners (workers), find account via their company's FK
      const profile = await prisma.workerProfile.findFirst({
        where: { user_email: user.email },
        select: { company_id: true },
      });
      if (profile?.company_id) {
        account = await prisma.account.findFirst({
          where: { company_id: profile.company_id },
        });
      }
    }
    if (account) {
      if (account.status === 'locked') {
        res.status(403).json({ error: 'Account is locked', reason: account.lock_reason });
        return;
      }
      if (account.status === 'trial' && account.trial_end < new Date()) {
        await prisma.account.update({
          where: { id: account.id },
          data: { status: 'locked', lock_reason: 'trial_expired' },
        });
        res.status(403).json({ error: 'Trial has expired. Please upgrade to continue.' });
        return;
      }
    }

    clearLoginRateLimit(identifier);

    const payload = { userId: user.id, email: user.email, role: user.role, platform_role: user.platform_role };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    await createAuditLog({
      action: 'login',
      entityType: 'user',
      entityId: user.id,
      performedBy: user.id,
    });

    setAuthCookies(res, accessToken, refreshToken);
    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        platform_role: user.platform_role,
        is_platform_admin: user.platform_role === 'superadmin',
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// ─── Refresh Token ──────────────────────────────────────────────────────────

router.post('/refresh', async (req: AuthRequest, res: Response) => {
  try {
    // Accept refresh token from cookie or request body
    const refreshToken = (req as any).cookies?.refreshToken || req.body?.refreshToken;
    if (!refreshToken) {
      res.status(401).json({ error: 'No refresh token provided' });
      return;
    }
    const decoded = verifyRefreshToken(refreshToken);

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user || user.status !== 'active') {
      res.status(401).json({ error: 'Invalid refresh token' });
      return;
    }

    const payload = { userId: user.id, email: user.email, role: user.role, platform_role: user.platform_role };
    const accessToken = generateAccessToken(payload);
    const newRefreshToken = generateRefreshToken(payload);

    setAuthCookies(res, accessToken, newRefreshToken);
    res.json({ accessToken, refreshToken: newRefreshToken });
  } catch {
    res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
});

// ─── Get Current User ───────────────────────────────────────────────────────

router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { id: true, email: true, full_name: true, role: true, platform_role: true, status: true, created_at: true },
    });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const profile = await prisma.workerProfile.findFirst({
      where: { user_email: user.email },
    });

    res.json({ ...user, is_platform_admin: user.platform_role === 'superadmin', workerProfile: profile });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// ─── Invite User ────────────────────────────────────────────────────────────

const inviteSchema = z.object({
  email: z.string().email(),
  full_name: z.string().min(1),
  role: z.enum(['payroll_admin', 'manager', 'worker']),
});

router.post(
  '/invite',
  authenticate,
  requireMinRole('manager'),
  validate(inviteSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { email, full_name, role } = req.body;

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        res.status(409).json({ error: 'User already exists' });
        return;
      }

      const companyId = await getCompanyId(req.user!.email);
      const { user, inviteToken } = await createInvitedUser(
        email,
        full_name,
        role,
        req.user!.email,
        companyId
      );

      const inviteUrl = buildInviteUrl(inviteToken);
      let emailSent = false;
      let emailError: string | undefined;

      if (!isEmailConfigured()) {
        emailError =
          'Email is not configured on the server. Copy the invite link below and share it with the user.';
      } else {
        try {
          await sendInviteEmail(email, full_name, inviteToken);
          emailSent = true;
        } catch (err: any) {
          console.error('Failed to send invite email:', err);
          emailError =
            err?.message
              ? `Failed to send invite email: ${err.message}. Copy the invite link below and share it manually.`
              : 'Failed to send invite email. Copy the invite link below and share it manually.';
        }
      }

      await createAuditLog({
        action: 'invite',
        entityType: 'user',
        entityId: user.id,
        performedBy: req.user!.userId,
        details: `Invited ${email} as ${role}${emailSent ? '' : ' (email delivery failed)'}`,
      });

      res.status(201).json({
        message: emailSent ? 'Invite sent' : 'User created but invite email failed to send',
        userId: user.id,
        emailSent,
        inviteUrl,
        ...(emailError ? { emailError } : {}),
      });
    } catch (error) {
      console.error('Failed to send invite:', error);
      res.status(500).json({ error: 'Failed to send invite' });
    }
  }
);

// ─── Accept Invite ──────────────────────────────────────────────────────────

const acceptInviteSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

router.post('/accept-invite', validate(acceptInviteSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { token, password } = req.body;
    const user = await acceptInvite(token, password);

    const payload = { userId: user.id, email: user.email, role: user.role, platform_role: user.platform_role };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    setAuthCookies(res, accessToken, refreshToken);
    res.json({
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role, platform_role: user.platform_role },
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to accept invite' });
  }
});

// ─── Logout ─────────────────────────────────────────────────────────────────

router.post('/logout', (req: AuthRequest, res: Response) => {
  clearAuthCookies(res);
  res.json({ message: 'Logged out' });
});

// ─── Forgot Password ────────────────────────────────────────────────────────

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

router.post('/forgot-password', validate(forgotPasswordSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { email } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    // Always return success to prevent email enumeration
    if (!user) {
      res.json({ message: 'If the email exists, a reset link has been sent' });
      return;
    }

    const resetToken = generateResetToken();
    const resetExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: { reset_token: resetToken, reset_token_exp: resetExpiry },
    });

    await sendPasswordResetEmail(email, resetToken);

    res.json({ message: 'If the email exists, a reset link has been sent' });
  } catch (error) {
    console.error('Password reset error:', error);
    // Return same message to prevent email enumeration
    res.json({ message: 'If the email exists, a reset link has been sent' });
  }
});

// ─── Reset Password ─────────────────────────────────────────────────────────

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

router.post('/reset-password', validate(resetPasswordSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { token, password } = req.body;

    const user = await prisma.user.findFirst({
      where: {
        reset_token: token,
        reset_token_exp: { gt: new Date() },
      },
    });

    if (!user) {
      res.status(400).json({ error: 'Invalid or expired reset token' });
      return;
    }

    const passwordHash = await hashPassword(password);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password_hash: passwordHash,
        reset_token: null,
        reset_token_exp: null,
      },
    });

    await createAuditLog({
      action: 'password_reset',
      entityType: 'user',
      entityId: user.id,
      performedBy: user.id,
    });

    res.json({ message: 'Password reset successful' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

export default router;
