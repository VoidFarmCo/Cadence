import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { AuthRequest } from '../types';
import { env } from '../config/env';

const router = Router();

// ─── Super-admin guard ────────────────────────────────────────────────────────

function requireSuperAdmin(req: AuthRequest, res: Response, next: Function) {
  const adminEmails = env.ADMIN_EMAIL
    ? env.ADMIN_EMAIL.split(',').map(e => e.trim().toLowerCase())
    : [];
  if (!adminEmails.includes(req.user!.email.toLowerCase())) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  next();
}

// ─── GET /api/admin/stats ─────────────────────────────────────────────────────

router.get('/stats', authenticate, requireSuperAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const now = new Date();

    const accounts = await prisma.account.findMany({
      orderBy: { created_at: 'desc' },
    });

    const PLAN_MRR: Record<string, number> = {
      solo: 12,
      pro: 49,
      business: 129,
      business_pro: 300,
      enterprise: 500,
    };

    const stats = {
      total: accounts.length,
      trial: 0,
      active: 0,
      locked: 0,
      mrr: 0,
      trials_expiring_3d: 0,
      trials_expiring_7d: 0,
    };

    const accountRows = accounts.map(a => {
      const daysLeft = a.trial_end
        ? Math.max(0, Math.ceil((a.trial_end.getTime() - now.getTime()) / 86400000))
        : null;

      if (a.status === 'trial') {
        stats.trial++;
        if (daysLeft !== null && daysLeft <= 3) stats.trials_expiring_3d++;
        if (daysLeft !== null && daysLeft <= 7) stats.trials_expiring_7d++;
      } else if (a.status === 'active') {
        stats.active++;
        const planPrice = PLAN_MRR[a.plan] ?? 0;
        const multiplier = 1; // MRR uses monthly plan price regardless of billing interval
        stats.mrr += planPrice * multiplier;
      } else if (a.status === 'locked') {
        stats.locked++;
      }

      return {
        id: a.id,
        owner_email: a.owner_email,
        owner_name: a.owner_name,
        status: a.status,
        plan: a.plan,
        billing_interval: a.billing_interval,
        trial_end: a.trial_end,
        days_left: daysLeft,
        lock_reason: a.lock_reason,
        stripe_subscription_status: a.stripe_subscription_status,
        created_at: a.created_at,
      };
    });

    res.json({ stats, accounts: accountRows });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ error: 'Failed to load admin stats' });
  }
});

export default router;
