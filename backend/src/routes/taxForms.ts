import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { requireMinRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { AuthRequest, qs } from '../types';

const router = Router();

// List tax forms
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const worker_email = qs(req.query.worker_email);
    const status = qs(req.query.status);
    const form_type = qs(req.query.form_type);
    const where: any = {};

    if (req.user!.role === 'worker') {
      where.worker_email = req.user!.email;
    } else if (worker_email) {
      where.worker_email = worker_email;
    }

    if (status) where.status = status;
    if (form_type) where.form_type = form_type;

    const forms = await prisma.taxForm.findMany({
      where,
      orderBy: { created_at: 'desc' },
    });
    res.json(forms);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tax forms' });
  }
});

// Get single tax form
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const form = await prisma.taxForm.findUnique({ where: { id: req.params.id } });
    if (!form) {
      res.status(404).json({ error: 'Tax form not found' });
      return;
    }

    if (req.user!.role === 'worker' && form.worker_email !== req.user!.email) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    res.json(form);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tax form' });
  }
});

// Create (send) tax form
const createTaxFormSchema = z.object({
  title: z.string().min(1),
  form_type: z.enum(['W4', 'I9', 'W9', 'NM_State_Withholding', 'Direct_Deposit_Auth', 'Custom']),
  description: z.string().optional(),
  worker_email: z.string().email(),
  worker_name: z.string().optional(),
  due_date: z.string().optional(),
  fields_config: z.string().optional(),
});

router.post(
  '/',
  authenticate,
  requireMinRole('manager'),
  validate(createTaxFormSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const workerProfile = await prisma.workerProfile.findFirst({
        where: { user_email: req.body.worker_email },
      });

      const form = await prisma.taxForm.create({
        data: {
          ...req.body,
          worker_name: req.body.worker_name || workerProfile?.full_name || req.body.worker_email,
          sent_by: req.user!.email,
          sent_at: new Date(),
          due_date: req.body.due_date ? new Date(req.body.due_date) : undefined,
        },
      });

      res.status(201).json(form);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create tax form' });
    }
  }
);

// Complete/respond to tax form (worker submits their response)
const respondTaxFormSchema = z.object({
  response_data: z.string(),
});

router.post(
  '/:id/respond',
  authenticate,
  validate(respondTaxFormSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const form = await prisma.taxForm.findUnique({ where: { id: req.params.id } });
      if (!form) {
        res.status(404).json({ error: 'Tax form not found' });
        return;
      }

      if (req.user!.role === 'worker' && form.worker_email !== req.user!.email) {
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }

      const updated = await prisma.taxForm.update({
        where: { id: req.params.id },
        data: {
          response_data: req.body.response_data,
          status: 'completed',
          completed_at: new Date(),
        },
      });

      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: 'Failed to respond to tax form' });
    }
  }
);

// Update tax form
const updateTaxFormSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(['pending', 'completed', 'expired']).optional(),
  due_date: z.string().optional(),
  fields_config: z.string().optional(),
}).strict();

router.put(
  '/:id',
  authenticate,
  requireMinRole('manager'),
  validate(updateTaxFormSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const data: any = { ...req.body };
      if (data.due_date) data.due_date = new Date(data.due_date);

      const updated = await prisma.taxForm.update({
        where: { id: req.params.id },
        data,
      });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update tax form' });
    }
  }
);

// Delete tax form
router.delete(
  '/:id',
  authenticate,
  requireMinRole('manager'),
  async (req: AuthRequest, res: Response) => {
    try {
      await prisma.taxForm.delete({ where: { id: req.params.id } });
      res.json({ message: 'Tax form deleted' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete tax form' });
    }
  }
);

export default router;
