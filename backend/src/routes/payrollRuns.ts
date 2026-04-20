import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { AuthRequest, qs } from '../types';
import { createAuditLog } from '../services/audit.service';
import { getCompanyId, parsePagination, paginatedResponse } from '../lib/company';
import {
  finalizePayPeriodAndStartPayroll,
  submitPayrollRun,
  completePayrollRun,
} from '../services/payroll.service';

const router = Router();

// List payroll runs
router.get(
  '/',
  authenticate,
  requireRole('owner', 'payroll_admin'),
  async (req: AuthRequest, res: Response) => {
    try {
      const status = qs(req.query.status);
      const pay_period_id = qs(req.query.pay_period_id);
      const companyId = await getCompanyId(req.user!.email);
      if (!companyId) { res.json(paginatedResponse([], 0, 1, 50)); return; }

      const where: any = { company_id: companyId };
      if (status) where.status = status;
      if (pay_period_id) where.pay_period_id = pay_period_id;

      const { skip, take, page, limit } = parsePagination({
        page: qs(req.query.page),
        limit: qs(req.query.limit),
      });

      const [runs, total] = await Promise.all([
        prisma.payrollRun.findMany({
          where,
          orderBy: { created_at: 'desc' },
          include: { payPeriod: true },
          skip,
          take,
        }),
        prisma.payrollRun.count({ where }),
      ]);

      res.json(paginatedResponse(runs, total, page, limit));
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch payroll runs' });
    }
  }
);

// Get single payroll run
router.get(
  '/:id',
  authenticate,
  requireRole('owner', 'payroll_admin'),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = await getCompanyId(req.user!.email);
      const run = await prisma.payrollRun.findUnique({
        where: { id: req.params.id },
        include: { payPeriod: true },
      });
      if (!run) {
        res.status(404).json({ error: 'Payroll run not found' });
        return;
      }
      if (run.company_id !== companyId) {
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }
      res.json(run);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch payroll run' });
    }
  }
);

// Create a payroll run directly
const createPayrollRunSchema = z.object({
  pay_period_id: z.string().uuid(),
  pay_period_label: z.string().optional(),
  status: z.enum(['draft', 'reviewing', 'submitted', 'completed', 'failed']).optional(),
  total_regular_hours: z.number().min(0).optional(),
  total_overtime_hours: z.number().min(0).optional(),
  worker_count: z.number().int().min(0).optional(),
  submitted_at: z.string().datetime().optional(),
  submitted_by: z.string().optional(),
  worker_results: z.string().optional(),
});

router.post(
  '/',
  authenticate,
  requireRole('owner', 'payroll_admin'),
  validate(createPayrollRunSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = await getCompanyId(req.user!.email);
      // Verify the pay period belongs to this company
      const period = await prisma.payPeriod.findUnique({
        where: { id: req.body.pay_period_id },
      });
      if (!period || period.company_id !== companyId) {
        res.status(403).json({ error: 'Pay period not found or insufficient permissions' });
        return;
      }

      const data: any = { ...req.body };
      if (data.submitted_at) data.submitted_at = new Date(data.submitted_at);
      data.company_id = companyId;

      const run = await prisma.payrollRun.create({ data });
      res.status(201).json(run);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create payroll run' });
    }
  }
);

// Finalize pay periods and start payroll
router.post(
  '/finalize',
  authenticate,
  requireRole('owner', 'payroll_admin'),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = await getCompanyId(req.user!.email);
      const results = await finalizePayPeriodAndStartPayroll(req.user!.email, companyId);

      for (const result of results) {
        await createAuditLog({
          action: 'lock',
          entityType: 'pay_period',
          entityId: result.payPeriod.id,
          performedBy: req.user!.userId,
          details: 'Finalized pay period and created payroll run',
          companyId,
        });
      }

      res.json({
        message: `Finalized ${results.length} pay period(s)`,
        results,
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to finalize payroll' });
    }
  }
);

// Submit payroll run
router.post(
  '/:id/submit',
  authenticate,
  requireRole('owner', 'payroll_admin'),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = await getCompanyId(req.user!.email);
      const existing = await prisma.payrollRun.findUnique({ where: { id: req.params.id }, include: { payPeriod: true } });
      if (!existing || existing.company_id !== companyId) {
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }

      const run = await submitPayrollRun(req.params.id, req.user!.email);

      await createAuditLog({
        action: 'submit',
        entityType: 'payroll_run',
        entityId: run.id,
        performedBy: req.user!.userId,
        companyId,
      });

      res.json(run);
    } catch (error) {
      res.status(500).json({ error: 'Failed to submit payroll run' });
    }
  }
);

// Complete payroll run
const completeSchema = z.object({
  worker_results: z.string().optional(),
});

router.post(
  '/:id/complete',
  authenticate,
  requireRole('owner', 'payroll_admin'),
  validate(completeSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = await getCompanyId(req.user!.email);
      const existing = await prisma.payrollRun.findUnique({ where: { id: req.params.id }, include: { payPeriod: true } });
      if (!existing || existing.company_id !== companyId) {
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }

      const run = await completePayrollRun(req.params.id, req.body.worker_results || '');

      await createAuditLog({
        action: 'update',
        entityType: 'payroll_run',
        entityId: run.id,
        performedBy: req.user!.userId,
        details: 'Completed payroll run',
        companyId,
      });

      res.json(run);
    } catch (error) {
      res.status(500).json({ error: 'Failed to complete payroll run' });
    }
  }
);

// Update payroll run
const updatePayrollRunSchema = z.object({
  status: z.enum(['draft', 'reviewing', 'submitted', 'completed', 'failed']).optional(),
  worker_results: z.string().optional(),
}).strict();

router.put(
  '/:id',
  authenticate,
  requireRole('owner', 'payroll_admin'),
  validate(updatePayrollRunSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = await getCompanyId(req.user!.email);
      const existing = await prisma.payrollRun.findUnique({ where: { id: req.params.id }, include: { payPeriod: true } });
      if (!existing || existing.company_id !== companyId) {
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }

      const updated = await prisma.payrollRun.update({
        where: { id: req.params.id },
        data: req.body,
      });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update payroll run' });
    }
  }
);

export default router;
