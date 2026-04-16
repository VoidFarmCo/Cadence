import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { requireMinRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { AuthRequest, qs } from '../types';
import { createAuditLog } from '../services/audit.service';
import { getCompanyWorkerEmails } from '../lib/company';

const router = Router();

// List leave requests
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const worker_email = qs(req.query.worker_email);
    const status = qs(req.query.status);
    const leave_type = qs(req.query.leave_type);
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
    if (leave_type) where.leave_type = leave_type;

    const requests = await prisma.leaveRequest.findMany({
      where,
      orderBy: { created_at: 'desc' },
    });
    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch leave requests' });
  }
});

// Get single leave request
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const request = await prisma.leaveRequest.findUnique({ where: { id: req.params.id } });
    if (!request) {
      res.status(404).json({ error: 'Leave request not found' });
      return;
    }

    if (req.user!.role === 'worker' && request.worker_email !== req.user!.email) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    res.json(request);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch leave request' });
  }
});

// Create leave request
const createLeaveRequestSchema = z.object({
  leave_type: z.enum(['pto', 'sick', 'unpaid']),
  start_date: z.string(),
  end_date: z.string(),
  total_days: z.number().positive().optional(),
  total_hours: z.number().positive().optional(),
  notes: z.string().optional(),
});

router.post('/', authenticate, validate(createLeaveRequestSchema), async (req: AuthRequest, res: Response) => {
  try {
    const workerProfile = await prisma.workerProfile.findFirst({
      where: { user_email: req.user!.email },
    });

    const request = await prisma.leaveRequest.create({
      data: {
        ...req.body,
        worker_email: req.user!.email,
        worker_name: workerProfile?.full_name || req.user!.email,
        start_date: new Date(req.body.start_date),
        end_date: new Date(req.body.end_date),
      },
    });

    res.status(201).json(request);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create leave request' });
  }
});

// Approve/deny leave request
const reviewLeaveSchema = z.object({
  status: z.enum(['approved', 'denied']),
  denial_reason: z.string().optional(),
});

router.post(
  '/:id/review',
  authenticate,
  requireMinRole('manager'),
  validate(reviewLeaveSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const existing = await prisma.leaveRequest.findUnique({ where: { id: req.params.id } });
      if (!existing) {
        res.status(404).json({ error: 'Leave request not found' });
        return;
      }

      const updated = await prisma.leaveRequest.update({
        where: { id: req.params.id },
        data: {
          status: req.body.status,
          denial_reason: req.body.denial_reason,
          reviewed_by: req.user!.email,
          reviewed_at: new Date(),
        },
      });

      // If approved and PTO/sick, deduct from balance
      if (req.body.status === 'approved' && updated.total_hours) {
        const balanceField = updated.leave_type === 'pto' ? 'pto_balance' : updated.leave_type === 'sick' ? 'sick_balance' : null;
        if (balanceField) {
          const profile = await prisma.workerProfile.findFirst({
            where: { user_email: updated.worker_email },
          });
          if (profile) {
            await prisma.workerProfile.update({
              where: { id: profile.id },
              data: {
                [balanceField]: Math.max(0, (profile[balanceField] as number) - updated.total_hours),
              },
            });
          }
        }
      }

      await createAuditLog({
        action: req.body.status === 'approved' ? 'approve' : 'reject',
        entityType: 'leave_request',
        entityId: existing.id,
        performedBy: req.user!.userId,
        reason: req.body.denial_reason,
      });

      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: 'Failed to review leave request' });
    }
  }
);

// Delete leave request
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const request = await prisma.leaveRequest.findUnique({ where: { id: req.params.id } });
    if (!request) {
      res.status(404).json({ error: 'Leave request not found' });
      return;
    }

    if (req.user!.role === 'worker' && request.worker_email !== req.user!.email) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    if (request.status !== 'pending') {
      res.status(400).json({ error: 'Can only delete pending requests' });
      return;
    }

    await prisma.leaveRequest.delete({ where: { id: req.params.id } });
    res.json({ message: 'Leave request deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete leave request' });
  }
});

export default router;
