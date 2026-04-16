import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { isSuperAdmin } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { AuthRequest, qs } from '../types';
import { createAuditLog } from '../services/audit.service';

const router = Router();

// All admin routes require authentication + superadmin platform role
router.use(authenticate, isSuperAdmin);

// ─── Plan pricing for MRR calculation ────────────────────────────────────────

const PLAN_MRR: Record<string, number> = {
  solo: 12,
  pro: 49,
  business: 129,
  business_pro: 300,
  enterprise: 500,
};

// ─── GET /api/admin/stats — platform-wide statistics ─────────────────────────

router.get('/stats', async (req: AuthRequest, res: Response) => {
  try {
    const now = new Date();

    const [accounts, totalUsers, totalCompanies] = await Promise.all([
      prisma.account.findMany({ orderBy: { created_at: 'desc' } }),
      prisma.user.count(),
      prisma.company.count(),
    ]);

    const stats = {
      total_accounts: accounts.length,
      total_users: totalUsers,
      total_companies: totalCompanies,
      trial: 0,
      active: 0,
      locked: 0,
      cancelled: 0,
      mrr: 0,
      trials_expiring_3d: 0,
      trials_expiring_7d: 0,
    };

    for (const a of accounts) {
      const daysLeft = a.trial_end
        ? Math.max(0, Math.ceil((a.trial_end.getTime() - now.getTime()) / 86400000))
        : null;

      if (a.status === 'trial') {
        stats.trial++;
        if (daysLeft !== null && daysLeft <= 3) stats.trials_expiring_3d++;
        if (daysLeft !== null && daysLeft <= 7) stats.trials_expiring_7d++;
      } else if (a.status === 'active') {
        stats.active++;
        stats.mrr += PLAN_MRR[a.plan] ?? 0;
      } else if (a.status === 'locked') {
        stats.locked++;
      } else if (a.status === 'cancelled') {
        stats.cancelled++;
      }
    }

    res.json({ stats });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ error: 'Failed to load platform stats' });
  }
});

// ─── GET /api/admin/accounts — list ALL accounts with stats ──────────────────

router.get('/accounts', async (req: AuthRequest, res: Response) => {
  try {
    const now = new Date();
    const search = qs(req.query.search)?.toLowerCase();
    const status = qs(req.query.status);
    const page = Math.max(1, parseInt(qs(req.query.page) || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(qs(req.query.limit) || '50', 10)));

    const where: any = {};
    if (status && status !== 'all') {
      where.status = status;
    }
    if (search) {
      where.OR = [
        { owner_email: { contains: search, mode: 'insensitive' } },
        { owner_name: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [accounts, total] = await Promise.all([
      prisma.account.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { company: { select: { id: true, name: true } } },
      }),
      prisma.account.count({ where }),
    ]);

    const rows = accounts.map(a => {
      const daysLeft = a.trial_end
        ? Math.max(0, Math.ceil((a.trial_end.getTime() - now.getTime()) / 86400000))
        : null;
      return {
        id: a.id,
        owner_email: a.owner_email,
        owner_name: a.owner_name,
        company_name: a.company?.name || null,
        company_id: a.company_id,
        status: a.status,
        plan: a.plan,
        billing_interval: a.billing_interval,
        user_limit: a.user_limit,
        trial_end: a.trial_end,
        days_left: daysLeft,
        lock_reason: a.lock_reason,
        stripe_subscription_status: a.stripe_subscription_status,
        created_at: a.created_at,
      };
    });

    res.json({ accounts: rows, total, page, limit });
  } catch (error) {
    console.error('Admin accounts error:', error);
    res.status(500).json({ error: 'Failed to load accounts' });
  }
});

// ─── GET /api/admin/companies — list ALL companies ───────────────────────────

router.get('/companies', async (req: AuthRequest, res: Response) => {
  try {
    const search = qs(req.query.search)?.toLowerCase();
    const page = Math.max(1, parseInt(qs(req.query.page) || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(qs(req.query.limit) || '50', 10)));

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { owner_email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [companies, total] = await Promise.all([
      prisma.company.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          account: { select: { status: true, plan: true } },
          _count: { select: { workerProfiles: true } },
        },
      }),
      prisma.company.count({ where }),
    ]);

    const rows = companies.map(c => ({
      id: c.id,
      name: c.name,
      owner_email: c.owner_email,
      state: c.state,
      plan: c.account?.plan || null,
      status: c.account?.status || null,
      user_count: c._count.workerProfiles,
      created_at: c.created_at,
    }));

    res.json({ companies: rows, total, page, limit });
  } catch (error) {
    console.error('Admin companies error:', error);
    res.status(500).json({ error: 'Failed to load companies' });
  }
});

// ─── GET /api/admin/users — list ALL users across platform ───────────────────

router.get('/users', async (req: AuthRequest, res: Response) => {
  try {
    const search = qs(req.query.search)?.toLowerCase();
    const page = Math.max(1, parseInt(qs(req.query.page) || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(qs(req.query.limit) || '50', 10)));

    const where: any = {};
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { full_name: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          email: true,
          full_name: true,
          role: true,
          platform_role: true,
          status: true,
          created_at: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    // Fetch associated company for each user via WorkerProfile
    const emails = users.map(u => u.email);
    const profiles = await prisma.workerProfile.findMany({
      where: { user_email: { in: emails } },
      select: { user_email: true, company: { select: { id: true, name: true } } },
    });
    const profileMap = new Map(profiles.map(p => [p.user_email, p.company]));

    const rows = users.map(u => ({
      ...u,
      company: profileMap.get(u.email) || null,
    }));

    res.json({ users: rows, total, page, limit });
  } catch (error) {
    console.error('Admin users error:', error);
    res.status(500).json({ error: 'Failed to load users' });
  }
});

// ─── POST /api/admin/users/:id/set-role — change platform_role ───────────────

const setRoleSchema = z.object({
  platform_role: z.enum(['user', 'superadmin']),
});

router.post('/users/:id/set-role', validate(setRoleSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { platform_role } = req.body;

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { platform_role },
      select: { id: true, email: true, full_name: true, role: true, platform_role: true, status: true },
    });

    await createAuditLog({
      action: 'update',
      entityType: 'user',
      entityId: id,
      performedBy: req.user!.userId,
      details: `Changed platform_role to ${platform_role}`,
      oldValue: { platform_role: target.platform_role },
      newValue: { platform_role },
    });

    res.json(updated);
  } catch (error) {
    console.error('Admin set-role error:', error);
    res.status(500).json({ error: 'Failed to update platform role' });
  }
});

// ─── POST /api/admin/accounts/:id/update-status — lock/unlock/change status ──

const updateAccountSchema = z.object({
  status: z.enum(['trial', 'active', 'locked', 'cancelled']).optional(),
  plan: z.enum(['solo', 'pro', 'business', 'business_pro', 'enterprise']).optional(),
  lock_reason: z.enum(['trial_expired', 'payment_failed']).nullable().optional(),
});

router.post('/accounts/:id/update-status', validate(updateAccountSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, plan, lock_reason } = req.body;

    const account = await prisma.account.findUnique({ where: { id } });
    if (!account) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }

    const data: any = {};
    if (status !== undefined) data.status = status;
    if (plan !== undefined) data.plan = plan;
    if (lock_reason !== undefined) data.lock_reason = lock_reason;
    // Clear lock_reason when unlocking
    if (status && status !== 'locked') data.lock_reason = null;

    const updated = await prisma.account.update({ where: { id }, data });

    await createAuditLog({
      action: status === 'locked' ? 'lock' : status === 'active' || status === 'trial' ? 'unlock' : 'update',
      entityType: 'account',
      entityId: id,
      performedBy: req.user!.userId,
      details: `Admin updated account: ${JSON.stringify(req.body)}`,
      oldValue: { status: account.status, plan: account.plan, lock_reason: account.lock_reason },
      newValue: data,
    });

    res.json(updated);
  } catch (error) {
    console.error('Admin account-status error:', error);
    res.status(500).json({ error: 'Failed to update account' });
  }
});

// ─── GET /api/admin/audit-logs — view ALL audit logs across companies ────────

router.get('/audit-logs', async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(qs(req.query.page) || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(qs(req.query.limit) || '50', 10)));
    const action = qs(req.query.action);
    const entityType = qs(req.query.entity_type);

    const where: any = {};
    if (action) where.action = action;
    if (entityType) where.entity_type = entityType;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          performer: { select: { email: true, full_name: true } },
          company: { select: { id: true, name: true } },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({ logs, total, page, limit });
  } catch (error) {
    console.error('Admin audit-logs error:', error);
    res.status(500).json({ error: 'Failed to load audit logs' });
  }
});

export default router;
