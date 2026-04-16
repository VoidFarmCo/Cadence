import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { requireMinRole } from '../middleware/rbac';
import { AuthRequest } from '../types';
import { createAuditLog } from '../services/audit.service';
import { sendInviteEmail, sendPasswordResetEmail } from '../services/email.service';
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
const COOKIE_SAME_SITE = IS_PROD ? 'none' : 'lax';

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

    const payload = { userId: user.id, email: user.email, role: user.role };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    await createAuditLog({
      action: 'create',
      entityType: 'user',
      entityId: user.id,
      performedBy: user.id,
      details: 'Account registration',
    });

    setAuthCookies(res, accessToken, refreshToken);
    res.status(201).json({
      user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role },
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

    if (user.status !== 'active') {
      res.status(403).json({ error: 'Account is not active' });
      return;
    }

    // Check account status and trial expiry
    const account = await prisma.account.findFirst({
      where: { owner_email: user.email },
    });
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

    const payload = { userId: user.id, email: user.email, role: user.role };
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
      user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role },
    });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// ─── Refresh Token ──────────────────────────────────────────────────────────

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

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

    const payload = { userId: user.id, email: user.email, role: user.role };
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
      select: { id: true, email: true, full_name: true, role: true, status: true, created_at: true },
    });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const profile = await prisma.workerProfile.findFirst({
      where: { user_email: user.email },
    });

    res.json(user);
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

      const { user, inviteToken } = await createInvitedUser(
        email,
        full_name,
        role,
        req.user!.email
      );

      await sendInviteEmail(email, full_name, inviteToken);

      await createAuditLog({
        action: 'invite',
        entityType: 'user',
        entityId: user.id,
        performedBy: req.user!.userId,
        details: `Invited ${email} as ${role}`,
      });

      res.status(201).json({ message: 'Invite sent', userId: user.id });
    } catch (error) {
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

    const payload = { userId: user.id, email: user.email, role: user.role };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    setAuthCookies(res, accessToken, refreshToken);
    res.json({
      user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role },
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
    res.status(500).json({ error: 'Failed to process request' });
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
