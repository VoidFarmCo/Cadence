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

    res.status(201).json({
      user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role },
      account,
      company,
      accessToken,
      refreshToken,
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

    // Check if the account is locked
    const account = await prisma.account.findFirst({
      where: { owner_email: user.email },
    });
    if (account && account.status === 'locked') {
      res.status(403).json({
        error: 'Account is locked',
        reason: account.lock_reason,
      });
      return;
    }

    const payload = { userId: user.id, email: user.email, role: user.role };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    await createAuditLog({
      action: 'login',
      entityType: 'user',
      entityId: user.id,
      performedBy: user.id,
    });

    res.json({
      user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// ─── Refresh Token ──────────────────────────────────────────────────────────

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

router.post('/refresh', validate(refreshSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { refreshToken } = req.body;
    const decoded = verifyRefreshToken(refreshToken);

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user || user.status !== 'active') {
      res.status(401).json({ error: 'Invalid refresh token' });
      return;
    }

    const payload = { userId: user.id, email: user.email, role: user.role };
    const accessToken = generateAccessToken(payload);
    const newRefreshToken = generateRefreshToken(payload);

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

    res.json({ user, profile });
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

    res.json({
      user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role },
      accessToken,
      refreshToken,
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to accept invite' });
  }
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
