import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { requireMinRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { AuthRequest, qs } from '../types';
import { createAuditLog } from '../services/audit.service';
import { getCompanyId } from '../lib/company';
import { generatePayPeriodsForCompany } from '../services/payPeriod.service';

const router = Router();

// List pay periods
router.get('/', authenticate, requireMinRole('manager'), async (req: AuthRequest, res: Response) => {
  try {
    const status = qs(req.query.status);
    const companyId = await getCompanyId(req.user!.email);
    if (!companyId) {
      res.json([]);
      return;
    }
    const where: any = { company_id: companyId };
    if (status) where.status = status;

    const periods = await prisma.payPeriod.findMany({
      where,
      orderBy: { start_date: 'desc' },
    });
    res.json(periods);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch pay periods' });
  }
});

// Get single pay period
router.get('/:id', authenticate, requireMinRole('manager'), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = await getCompanyId(req.user!.email);
    const period = await prisma.payPeriod.findUnique({
      where: { id: req.params.id },
      include: { timeEntries: true, payrollRuns: true },
    });
    if (!period) {
      res.status(404).json({ error: 'Pay period not found' });
      return;
    }
    if (period.company_id !== companyId) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    res.json(period);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch pay period' });
  }
});

// Create pay period
const createPayPeriodSchema = z.object({
  start_date: z.string(),
  end_date: z.string(),
  status: z.enum(['open', 'locked', 'paid']).optional(),
});

router.post(
  '/',
  authenticate,
  requireMinRole('payroll_admin'),
  validate(createPayPeriodSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const cId = await getCompanyId(req.user!.email);
      const period = await prisma.payPeriod.create({
        data: {
          start_date: new Date(req.body.start_date),
          end_date: new Date(req.body.end_date),
          status: req.body.status || 'open',
          company_id: cId,
        },
      });
      res.status(201).json(period);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create pay period' });
    }
  }
);

// Update pay period (lock/unlock)
const updatePayPeriodSchema = z.object({
  status: z.enum(['open', 'locked', 'paid']).optional(),
  unlock_reason: z.string().optional(),
}).strict();

router.put(
  '/:id',
  authenticate,
  requireMinRole('payroll_admin'),
  validate(updatePayPeriodSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const existing = await prisma.payPeriod.findUnique({ where: { id: req.params.id } });
      if (!existing) {
        res.status(404).json({ error: 'Pay period not found' });
        return;
      }
      const companyId = await getCompanyId(req.user!.email);
      if (existing.company_id !== companyId) {
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }

      const data: any = { ...req.body };
      if (data.status === 'locked') {
        data.locked_at = new Date();
        data.locked_by = req.user!.email;
      }

      const updated = await prisma.payPeriod.update({
        where: { id: req.params.id },
        data,
      });

      await createAuditLog({
        action: data.status === 'locked' ? 'lock' : data.status === 'open' ? 'unlock' : 'update',
        entityType: 'pay_period',
        entityId: existing.id,
        performedBy: req.user!.userId,
        reason: req.body.unlock_reason,
        oldValue: existing,
        newValue: updated,
      });

      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update pay period' });
    }
  }
);

// Auto-generate pay periods based on company settings
const generateSchema = z.object({
  count: z.number().int().min(1).max(26).optional(),
}).strict();

router.post(
  '/generate',
  authenticate,
  requireMinRole('payroll_admin'),
  validate(generateSchema),
  async (req: AuthRequest, res: Response) => {
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

      if (!company.pay_period_start_date) {
        res.status(400).json({ error: 'Pay period start date not configured. Update it in Settings first.' });
        return;
      }

      const count = req.body.count || 6;
      const periods = await generatePayPeriodsForCompany(
        companyId,
        company.pay_period_type,
        company.pay_period_start_date,
        count
      );

      res.status(201).json(periods);
    } catch (error) {
      res.status(500).json({ error: 'Failed to generate pay periods' });
    }
  }
);

// Delete pay period
router.delete(
  '/:id',
  authenticate,
  requireMinRole('owner'),
  async (req: AuthRequest, res: Response) => {
    try {
      const period = await prisma.payPeriod.findUnique({ where: { id: req.params.id } });
      if (!period) {
        res.status(404).json({ error: 'Pay period not found' });
        return;
      }
      const companyId = await getCompanyId(req.user!.email);
      if (period.company_id !== companyId) {
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }

      if (period.status !== 'open') {
        res.status(400).json({ error: 'Can only delete open pay periods' });
        return;
      }

      await prisma.payPeriod.delete({ where: { id: req.params.id } });
      res.json({ message: 'Pay period deleted' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete pay period' });
    }
  }
);

export default router;
