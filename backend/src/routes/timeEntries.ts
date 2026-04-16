import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { requireMinRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { AuthRequest, qs } from '../types';
import { getIO } from '../lib/socket';
import { getCompanyId, getCompanyWorkerEmails } from '../lib/company';
import { createAuditLog } from '../services/audit.service';
import { findPayPeriodForDate } from '../services/payPeriod.service';

const router = Router();

// List time entries
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const worker_email = qs(req.query.worker_email);
    const status = qs(req.query.status);
    const pay_period_id = qs(req.query.pay_period_id);
    const start_date = qs(req.query.start_date);
    const end_date = qs(req.query.end_date);
    const where: any = {};

    if (req.user!.role === 'worker') {
      where.worker_email = req.user!.email;
    } else {
      const companyEmails = await getCompanyWorkerEmails(req.user!.email);
      where.worker_email = worker_email
        ? (companyEmails.includes(worker_email) ? worker_email : '__none__')
        : { in: companyEmails };
    }

    if (status) where.status = status;
    if (pay_period_id) where.pay_period_id = pay_period_id;
    if (start_date || end_date) {
      where.date = {};
      if (start_date) where.date.gte = new Date(start_date);
      if (end_date) where.date.lte = new Date(end_date);
    }

    const entries = await prisma.timeEntry.findMany({
      where,
      orderBy: { date: 'desc' },
      take: 1000,
    });
    res.json(entries);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch time entries' });
  }
});

// Get single time entry
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const entry = await prisma.timeEntry.findUnique({ where: { id: req.params.id } });
    if (!entry) {
      res.status(404).json({ error: 'Time entry not found' });
      return;
    }

    if (req.user!.role === 'worker') {
      if (entry.worker_email !== req.user!.email) {
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }
    } else {
      const companyEmails = await getCompanyWorkerEmails(req.user!.email);
      if (!companyEmails.includes(entry.worker_email)) {
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }
    }

    res.json(entry);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch time entry' });
  }
});

// Create time entry
const createTimeEntrySchema = z.object({
  worker_email: z.string().email().optional(),
  worker_name: z.string().optional(),
  date: z.string(),
  clock_in: z.string().datetime().optional(),
  clock_out: z.string().datetime().optional(),
  break_minutes: z.number().int().min(0).optional(),
  total_hours: z.number().min(0).optional(),
  regular_hours: z.number().min(0).optional(),
  overtime_hours: z.number().min(0).optional(),
  site_id: z.string().uuid().optional(),
  site_name: z.string().optional(),
  status: z.enum(['pending', 'submitted', 'approved', 'rejected', 'corrected']).optional(),
  pay_period_id: z.string().uuid().optional(),
  has_exception: z.boolean().optional(),
  exception_notes: z.string().optional(),
  edit_reason: z.string().optional(),
  clock_in_latitude: z.number().optional(),
  clock_in_longitude: z.number().optional(),
});

router.post('/', authenticate, validate(createTimeEntrySchema), async (req: AuthRequest, res: Response) => {
  try {
    const workerEmail = req.body.worker_email || req.user!.email;

    // Managers can only create entries for workers in their company
    if (req.body.worker_email && req.user!.role !== 'worker') {
      const companyEmails = await getCompanyWorkerEmails(req.user!.email);
      if (!companyEmails.includes(workerEmail)) {
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }
    }
    const workerProfile = await prisma.workerProfile.findFirst({
      where: { user_email: workerEmail },
    });

    // Auto-assign pay_period_id if not provided
    let payPeriodId = req.body.pay_period_id || null;
    if (!payPeriodId) {
      const companyId = await getCompanyId(req.user!.email);
      if (companyId) {
        payPeriodId = await findPayPeriodForDate(companyId, new Date(req.body.date));
      }
    }

    const entry = await prisma.timeEntry.create({
      data: {
        ...req.body,
        worker_email: workerEmail,
        worker_name: req.body.worker_name || workerProfile?.full_name || workerEmail,
        date: new Date(req.body.date),
        clock_in: req.body.clock_in ? new Date(req.body.clock_in) : undefined,
        clock_out: req.body.clock_out ? new Date(req.body.clock_out) : undefined,
        pay_period_id: payPeriodId,
      },
    });

    res.status(201).json(entry);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create time entry' });
  }
});

// Update time entry
const updateTimeEntrySchema = z.object({
  clock_in: z.string().datetime().optional(),
  clock_out: z.string().datetime().optional(),
  break_minutes: z.number().int().min(0).optional(),
  total_hours: z.number().min(0).optional(),
  regular_hours: z.number().min(0).optional(),
  overtime_hours: z.number().min(0).optional(),
  site_id: z.string().uuid().nullable().optional(),
  site_name: z.string().optional(),
  status: z.enum(['pending', 'submitted', 'approved', 'rejected', 'corrected']).optional(),
  pay_period_id: z.string().uuid().nullable().optional(),
  has_exception: z.boolean().optional(),
  exception_notes: z.string().optional(),
  edit_reason: z.string().optional(),
}).strict();

router.put('/:id', authenticate, validate(updateTimeEntrySchema), async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.timeEntry.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Time entry not found' });
      return;
    }

    if (req.user!.role === 'worker') {
      // Workers can only edit their own pending/rejected entries
      if (existing.worker_email !== req.user!.email) {
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }
      if (existing.status !== 'pending' && existing.status !== 'rejected') {
        res.status(400).json({ error: 'Can only edit pending or rejected entries' });
        return;
      }
      // Workers cannot change their own entry status
      if (req.body.status) {
        res.status(403).json({ error: 'Workers cannot change entry status' });
        return;
      }
    } else {
      // Managers+ can only edit entries for their own company's workers
      const companyEmails = await getCompanyWorkerEmails(req.user!.email);
      if (!companyEmails.includes(existing.worker_email)) {
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }
    }

    const data: any = { ...req.body };
    if (data.clock_in) data.clock_in = new Date(data.clock_in);
    if (data.clock_out) data.clock_out = new Date(data.clock_out);

    const updated = await prisma.timeEntry.update({
      where: { id: req.params.id },
      data,
    });

    // Emit real-time event for status changes
    if (req.body.status) {
      try {
        getIO().emit('timeEntry:updated', updated);
      } catch {}
    }

    await createAuditLog({
      action: 'update',
      entityType: 'time_entry',
      entityId: existing.id,
      performedBy: req.user!.userId,
      oldValue: existing,
      newValue: updated,
      reason: req.body.edit_reason,
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update time entry' });
  }
});

// Bulk approve time entries
router.post(
  '/bulk-approve',
  authenticate,
  requireMinRole('manager'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        res.status(400).json({ error: 'ids must be a non-empty array' });
        return;
      }

      const companyEmails = await getCompanyWorkerEmails(req.user!.email);
      const result = await prisma.timeEntry.updateMany({
        where: {
          id: { in: ids },
          status: { in: ['pending', 'submitted'] },
          worker_email: { in: companyEmails },
        },
        data: { status: 'approved' },
      });

      res.json({ updated: result.count });
    } catch (error) {
      res.status(500).json({ error: 'Failed to bulk approve' });
    }
  }
);

// Delete time entry
router.delete('/:id', authenticate, requireMinRole('manager'), async (req: AuthRequest, res: Response) => {
  try {
    const entry = await prisma.timeEntry.findUnique({ where: { id: req.params.id } });
    if (!entry) {
      res.status(404).json({ error: 'Time entry not found' });
      return;
    }
    const companyEmails = await getCompanyWorkerEmails(req.user!.email);
    if (!companyEmails.includes(entry.worker_email)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    await prisma.timeEntry.delete({ where: { id: req.params.id } });
    res.json({ message: 'Time entry deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete time entry' });
  }
});

export default router;
