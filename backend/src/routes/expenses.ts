import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { AuthRequest, qs } from '../types';
import { getCompanyId, parsePagination, paginatedResponse } from '../lib/company';

const router = Router();

// List expenses
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const worker_email = qs(req.query.worker_email);
    const status = qs(req.query.status);
    const category = qs(req.query.category);
    const start_date = qs(req.query.start_date);
    const end_date = qs(req.query.end_date);

    const companyId = await getCompanyId(req.user!.email);
    if (!companyId) { res.json(paginatedResponse([], 0, 1, 50)); return; }

    const where: any = { company_id: companyId };

    if (req.user!.role === 'worker') {
      where.worker_email = req.user!.email;
    } else if (worker_email) {
      where.worker_email = worker_email;
    }

    if (status) where.status = status;
    if (category) where.category = category;
    if (start_date || end_date) {
      where.date = {};
      if (start_date) where.date.gte = new Date(start_date);
      if (end_date) where.date.lte = new Date(end_date);
    }

    const { skip, take, page, limit } = parsePagination({
      page: qs(req.query.page),
      limit: qs(req.query.limit),
    });

    const [expenses, total] = await Promise.all([
      prisma.expense.findMany({ where, orderBy: { date: 'desc' }, skip, take }),
      prisma.expense.count({ where }),
    ]);

    res.json(paginatedResponse(expenses, total, page, limit));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
});

// Get single expense
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const companyId = await getCompanyId(req.user!.email);
    const expense = await prisma.expense.findUnique({ where: { id: req.params.id } });
    if (!expense) {
      res.status(404).json({ error: 'Expense not found' });
      return;
    }
    if (!companyId || expense.company_id !== companyId) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    if (req.user!.role === 'worker' && expense.worker_email !== req.user!.email) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    res.json(expense);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch expense' });
  }
});

// Create expense
const createExpenseSchema = z.object({
  category: z.enum(['fuel', 'supplies', 'repairs', 'tools', 'mileage', 'other']),
  amount: z.number().positive(),
  date: z.string(),
  site_id: z.string().uuid().optional(),
  site_name: z.string().optional(),
  notes: z.string().optional(),
  receipt_url: z.string().optional(),
});

router.post('/', authenticate, validate(createExpenseSchema), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = await getCompanyId(req.user!.email);
    const workerProfile = await prisma.workerProfile.findFirst({
      where: { user_email: req.user!.email },
    });

    const expense = await prisma.expense.create({
      data: {
        ...req.body,
        worker_email: req.user!.email,
        worker_name: workerProfile?.full_name || req.user!.email,
        date: new Date(req.body.date),
        company_id: companyId,
      },
    });

    res.status(201).json(expense);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create expense' });
  }
});

// Update expense
const updateExpenseSchema = z.object({
  category: z.enum(['fuel', 'supplies', 'repairs', 'tools', 'mileage', 'other']).optional(),
  amount: z.number().positive().optional(),
  date: z.string().optional(),
  site_id: z.string().uuid().nullable().optional(),
  site_name: z.string().optional(),
  notes: z.string().optional(),
  receipt_url: z.string().optional(),
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
}).strict();

router.put('/:id', authenticate, validate(updateExpenseSchema), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = await getCompanyId(req.user!.email);
    const existing = await prisma.expense.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Expense not found' });
      return;
    }
    if (!companyId || existing.company_id !== companyId) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    // Workers can only edit their own pending expenses (but not status)
    if (req.user!.role === 'worker') {
      if (existing.worker_email !== req.user!.email) {
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }
      if (existing.status !== 'pending') {
        res.status(400).json({ error: 'Can only edit pending expenses' });
        return;
      }
      if (req.body.status) {
        res.status(403).json({ error: 'Workers cannot change expense status' });
        return;
      }
    }

    const data: any = { ...req.body };
    if (data.date) data.date = new Date(data.date);

    const updated = await prisma.expense.update({
      where: { id: req.params.id },
      data,
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update expense' });
  }
});

// Delete expense
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const companyId = await getCompanyId(req.user!.email);
    const expense = await prisma.expense.findUnique({ where: { id: req.params.id } });
    if (!expense) {
      res.status(404).json({ error: 'Expense not found' });
      return;
    }
    if (!companyId || expense.company_id !== companyId) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    if (req.user!.role === 'worker' && expense.worker_email !== req.user!.email) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    if (expense.status !== 'pending') {
      res.status(400).json({ error: 'Can only delete pending expenses' });
      return;
    }

    await prisma.expense.delete({ where: { id: req.params.id } });
    res.json({ message: 'Expense deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});

export default router;
