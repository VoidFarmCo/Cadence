import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { requireMinRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { AuthRequest, qs } from '../types';
import { createAuditLog } from '../services/audit.service';
import { getCompanyId, parsePagination, paginatedResponse } from '../lib/company';

const router = Router();

// List worker profiles
router.get('/', authenticate, requireMinRole('manager'), async (req: AuthRequest, res: Response) => {
  try {
    const status = qs(req.query.status);
    const worker_type = qs(req.query.worker_type);
    const companyId = await getCompanyId(req.user!.email);
    if (!companyId) {
      res.json(paginatedResponse([], 0, 1, 50));
      return;
    }
    const where: any = { company_id: companyId };
    if (status) where.status = status;
    if (worker_type) where.worker_type = worker_type;

    const { skip, take, page, limit } = parsePagination({
      page: qs(req.query.page),
      limit: qs(req.query.limit),
    });

    const [profiles, total] = await Promise.all([
      prisma.workerProfile.findMany({ where, orderBy: { full_name: 'asc' }, skip, take }),
      prisma.workerProfile.count({ where }),
    ]);

    res.json(paginatedResponse(profiles, total, page, limit));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch worker profiles' });
  }
});

// Get own profile (worker)
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const profile = await prisma.workerProfile.findFirst({
      where: { user_email: req.user!.email },
    });
    if (!profile) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }
    res.json(profile);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Get single worker profile
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const companyId = await getCompanyId(req.user!.email);
    const profile = await prisma.workerProfile.findUnique({
      where: { id: req.params.id },
    });
    if (!profile) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }

    if (req.user!.role === 'worker') {
      if (profile.user_email !== req.user!.email) {
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }
    } else if (!companyId || profile.company_id !== companyId) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    res.json(profile);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update worker profile
const updateProfileSchema = z.object({
  full_name: z.string().min(1).optional(),
  phone: z.string().optional(),
  worker_type: z.enum(['employee', 'contractor']).optional(),
  role: z.enum(['payroll_admin', 'manager', 'worker']).optional(),
  pay_rate: z.number().positive().optional(),
  default_site_id: z.string().uuid().nullable().optional(),
  status: z.enum(['active', 'inactive', 'pending']).optional(),
  pay_preference: z.enum(['direct_deposit', 'paper_check']).optional(),
  dd_status: z.enum(['not_setup', 'setup_in_qb']).optional(),
  qb_entity_id: z.string().optional(),
  pto_balance: z.number().min(0).optional(),
  sick_balance: z.number().min(0).optional(),
}).strict();

router.put(
  '/:id',
  authenticate,
  requireMinRole('manager'),
  validate(updateProfileSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = await getCompanyId(req.user!.email);
      const existing = await prisma.workerProfile.findUnique({
        where: { id: req.params.id },
      });
      if (!existing) {
        res.status(404).json({ error: 'Profile not found' });
        return;
      }
      if (!companyId || existing.company_id !== companyId) {
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }

      // Only owners can change roles
      if (req.body.role && req.user!.role !== 'owner') {
        res.status(403).json({ error: 'Only owners can change user roles' });
        return;
      }

      const updated = await prisma.workerProfile.update({
        where: { id: req.params.id },
        data: req.body,
      });

      // If role was changed, also update the User record
      if (req.body.role && req.body.role !== existing.role) {
        await prisma.user.updateMany({
          where: { email: existing.user_email },
          data: { role: req.body.role },
        });
      }

      await createAuditLog({
        action: 'update',
        entityType: 'worker_profile',
        entityId: existing.id,
        performedBy: req.user!.userId,
        oldValue: existing,
        newValue: updated,
        companyId,
      });

      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update profile' });
    }
  }
);

// Delete worker profile (deactivate)
router.delete(
  '/:id',
  authenticate,
  requireMinRole('owner'),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = await getCompanyId(req.user!.email);
      const profile = await prisma.workerProfile.findUnique({
        where: { id: req.params.id },
      });
      if (!profile) {
        res.status(404).json({ error: 'Profile not found' });
        return;
      }
      if (!companyId || profile.company_id !== companyId) {
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }

      await prisma.workerProfile.update({
        where: { id: req.params.id },
        data: { status: 'inactive' },
      });

      await prisma.user.updateMany({
        where: { email: profile.user_email },
        data: { status: 'inactive' },
      });

      await createAuditLog({
        action: 'delete',
        entityType: 'worker_profile',
        entityId: profile.id,
        performedBy: req.user!.userId,
        companyId,
      });

      res.json({ message: 'Profile deactivated' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to deactivate profile' });
    }
  }
);

export default router;
