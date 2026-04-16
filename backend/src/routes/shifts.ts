import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { requireMinRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { AuthRequest, qs } from '../types';

const router = Router();

// List shifts
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const worker_email = qs(req.query.worker_email);
    const site_id = qs(req.query.site_id);
    const status = qs(req.query.status);
    const start_date = qs(req.query.start_date);
    const end_date = qs(req.query.end_date);
    const where: any = {};

    if (req.user!.role === 'worker') {
      where.worker_email = req.user!.email;
    } else if (worker_email) {
      where.worker_email = worker_email;
    }

    if (site_id) where.site_id = site_id;
    if (status) where.status = status;
    if (start_date || end_date) {
      where.date = {};
      if (start_date) where.date.gte = new Date(start_date);
      if (end_date) where.date.lte = new Date(end_date);
    }

    const shifts = await prisma.shift.findMany({
      where,
      orderBy: { date: 'asc' },
    });
    res.json(shifts);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch shifts' });
  }
});

// Get single shift
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const shift = await prisma.shift.findUnique({ where: { id: req.params.id } });
    if (!shift) {
      res.status(404).json({ error: 'Shift not found' });
      return;
    }

    if (req.user!.role === 'worker' && shift.worker_email !== req.user!.email) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    res.json(shift);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch shift' });
  }
});

// Create shift
const createShiftSchema = z.object({
  worker_email: z.string().email(),
  worker_name: z.string().optional(),
  site_id: z.string().uuid().optional(),
  site_name: z.string().optional(),
  date: z.string(),
  start_time: z.string(),
  end_time: z.string(),
  status: z.enum(['scheduled', 'confirmed', 'cancelled']).optional(),
  notes: z.string().optional(),
});

router.post(
  '/',
  authenticate,
  requireMinRole('manager'),
  validate(createShiftSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const workerProfile = await prisma.workerProfile.findFirst({
        where: { user_email: req.body.worker_email },
      });

      const shift = await prisma.shift.create({
        data: {
          ...req.body,
          worker_name: req.body.worker_name || workerProfile?.full_name || req.body.worker_email,
          date: new Date(req.body.date),
        },
      });

      res.status(201).json(shift);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create shift' });
    }
  }
);

// Update shift
const updateShiftSchema = z.object({
  worker_email: z.string().email().optional(),
  worker_name: z.string().optional(),
  site_id: z.string().uuid().nullable().optional(),
  site_name: z.string().optional(),
  date: z.string().optional(),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  status: z.enum(['scheduled', 'confirmed', 'cancelled']).optional(),
  notes: z.string().optional(),
}).strict();

router.put(
  '/:id',
  authenticate,
  requireMinRole('manager'),
  validate(updateShiftSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const data: any = { ...req.body };
      if (data.date) data.date = new Date(data.date);

      const updated = await prisma.shift.update({
        where: { id: req.params.id },
        data,
      });

      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update shift' });
    }
  }
);

// Delete shift
router.delete(
  '/:id',
  authenticate,
  requireMinRole('manager'),
  async (req: AuthRequest, res: Response) => {
    try {
      await prisma.shift.delete({ where: { id: req.params.id } });
      res.json({ message: 'Shift deleted' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete shift' });
    }
  }
);

export default router;
