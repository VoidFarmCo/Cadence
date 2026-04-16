import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { AuthRequest, qs } from '../types';
import { getCompanyId, parsePagination, paginatedResponse } from '../lib/company';

const router = Router();

// List tax deductions
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const worker_email = qs(req.query.worker_email);
    const tax_year = qs(req.query.tax_year);
    const category = qs(req.query.category);

    const companyId = await getCompanyId(req.user!.email);
    if (!companyId) { res.json(paginatedResponse([], 0, 1, 50)); return; }

    const where: any = { company_id: companyId };

    if (req.user!.role === 'worker') {
      where.worker_email = req.user!.email;
    } else if (worker_email) {
      where.worker_email = worker_email;
    }

    if (tax_year) where.tax_year = parseInt(tax_year, 10);
    if (category) where.category = category;

    const { skip, take, page, limit } = parsePagination({
      page: qs(req.query.page),
      limit: qs(req.query.limit),
    });

    const [deductions, total] = await Promise.all([
      prisma.taxDeduction.findMany({ where, orderBy: { created_at: 'desc' }, skip, take }),
      prisma.taxDeduction.count({ where }),
    ]);

    res.json(paginatedResponse(deductions, total, page, limit));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tax deductions' });
  }
});

// Get single tax deduction
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const companyId = await getCompanyId(req.user!.email);
    const deduction = await prisma.taxDeduction.findUnique({ where: { id: req.params.id } });
    if (!deduction) {
      res.status(404).json({ error: 'Tax deduction not found' });
      return;
    }
    if (!companyId || deduction.company_id !== companyId) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    if (req.user!.role === 'worker' && deduction.worker_email !== req.user!.email) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    res.json(deduction);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tax deduction' });
  }
});

// Create tax deduction
const createTaxDeductionSchema = z.object({
  tax_year: z.number().int().min(2020).max(2030),
  category: z.enum([
    'mileage', 'home_office', 'equipment_tools', 'phone_internet',
    'meals_entertainment', 'health_insurance', 'retirement', 'other',
  ]),
  description: z.string().optional(),
  amount: z.number().positive().optional(),
  miles: z.number().positive().optional(),
  date: z.string().optional(),
  receipt_url: z.string().optional(),
  notes: z.string().optional(),
});

router.post('/', authenticate, validate(createTaxDeductionSchema), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = await getCompanyId(req.user!.email);
    const workerProfile = await prisma.workerProfile.findFirst({
      where: { user_email: req.user!.email },
    });

    const deduction = await prisma.taxDeduction.create({
      data: {
        ...req.body,
        worker_email: req.user!.email,
        worker_name: workerProfile?.full_name || req.user!.email,
        date: req.body.date ? new Date(req.body.date) : undefined,
        company_id: companyId,
      },
    });

    res.status(201).json(deduction);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create tax deduction' });
  }
});

// Update tax deduction
const updateTaxDeductionSchema = z.object({
  tax_year: z.number().int().min(2020).max(2030).optional(),
  category: z.enum([
    'mileage', 'home_office', 'equipment_tools', 'phone_internet',
    'meals_entertainment', 'health_insurance', 'retirement', 'other',
  ]).optional(),
  description: z.string().optional(),
  amount: z.number().positive().optional(),
  miles: z.number().positive().optional(),
  date: z.string().optional(),
  receipt_url: z.string().optional(),
  notes: z.string().optional(),
}).strict();

router.put('/:id', authenticate, validate(updateTaxDeductionSchema), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = await getCompanyId(req.user!.email);
    const existing = await prisma.taxDeduction.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Tax deduction not found' });
      return;
    }
    if (!companyId || existing.company_id !== companyId) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    if (req.user!.role === 'worker' && existing.worker_email !== req.user!.email) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    const data: any = { ...req.body };
    if (data.date) data.date = new Date(data.date);

    const updated = await prisma.taxDeduction.update({
      where: { id: req.params.id },
      data,
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update tax deduction' });
  }
});

// Delete tax deduction
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const companyId = await getCompanyId(req.user!.email);
    const deduction = await prisma.taxDeduction.findUnique({ where: { id: req.params.id } });
    if (!deduction) {
      res.status(404).json({ error: 'Tax deduction not found' });
      return;
    }
    if (!companyId || deduction.company_id !== companyId) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    if (req.user!.role === 'worker' && deduction.worker_email !== req.user!.email) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    await prisma.taxDeduction.delete({ where: { id: req.params.id } });
    res.json({ message: 'Tax deduction deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete tax deduction' });
  }
});

export default router;
