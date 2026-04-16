import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { requireMinRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { AuthRequest } from '../types';
import { createAuditLog } from '../services/audit.service';
import { getCompanyId } from '../lib/company';

const router = Router();

// List companies (returns array for frontend entity pattern)
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const companyId = await getCompanyId(req.user!.email);
    if (!companyId) {
      res.json([]);
      return;
    }
    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) {
      res.json([]);
      return;
    }
    res.json([company]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch company' });
  }
});

// Update company settings
const updateCompanySchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  phone: z.string().optional(),
  pay_period_type: z.enum(['weekly', 'biweekly', 'semimonthly', 'monthly']).optional(),
  pay_period_start_date: z.string().optional(),
  workweek_start: z.enum(['sunday', 'monday']).optional(),
  overtime_threshold: z.number().int().positive().optional(),
}).strict();

async function handleCompanyUpdate(req: AuthRequest, res: Response) {
  try {
    const companyId = await getCompanyId(req.user!.email);
    if (!companyId) {
      res.status(404).json({ error: 'Company not found' });
      return;
    }
    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) {
      res.status(404).json({ error: 'Company not found' });
      return;
    }

    const data: any = { ...req.body };
    if (data.pay_period_start_date) {
      data.pay_period_start_date = new Date(data.pay_period_start_date);
    }

    const updated = await prisma.company.update({
      where: { id: company.id },
      data,
    });

    await createAuditLog({
      action: 'update',
      entityType: 'company',
      entityId: company.id,
      performedBy: req.user!.userId,
      oldValue: company,
      newValue: updated,
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update company' });
  }
}

// PUT /api/companies (no ID)
router.put(
  '/',
  authenticate,
  requireMinRole('owner'),
  validate(updateCompanySchema),
  handleCompanyUpdate
);

// PUT /api/companies/:id (frontend entity pattern sends ID)
router.put(
  '/:id',
  authenticate,
  requireMinRole('owner'),
  validate(updateCompanySchema),
  handleCompanyUpdate
);

export default router;
