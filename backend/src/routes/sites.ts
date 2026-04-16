import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { requireMinRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { AuthRequest, qs } from '../types';
import { getCompanyId, parsePagination, paginatedResponse } from '../lib/company';

const router = Router();

// List sites
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const companyId = await getCompanyId(req.user!.email);
    if (!companyId) {
      res.json(paginatedResponse([], 0, 1, 50));
      return;
    }

    const where: any = { company_id: companyId };

    const { skip, take, page, limit } = parsePagination({
      page: qs(req.query.page),
      limit: qs(req.query.limit),
    });

    const [sites, total] = await Promise.all([
      prisma.site.findMany({ where, orderBy: { name: 'asc' }, skip, take }),
      prisma.site.count({ where }),
    ]);

    res.json(paginatedResponse(sites, total, page, limit));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sites' });
  }
});

// Get single site
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const companyId = await getCompanyId(req.user!.email);
    const site = await prisma.site.findUnique({ where: { id: req.params.id } });
    if (!site) {
      res.status(404).json({ error: 'Site not found' });
      return;
    }
    if (!companyId || site.company_id !== companyId) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    res.json(site);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch site' });
  }
});

// Create site
const createSiteSchema = z.object({
  name: z.string().min(1),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  radius_meters: z.number().int().positive().optional(),
  address: z.string().optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

router.post(
  '/',
  authenticate,
  requireMinRole('manager'),
  validate(createSiteSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = await getCompanyId(req.user!.email);
      if (!companyId) {
        res.status(400).json({ error: 'Company not found' });
        return;
      }
      const site = await prisma.site.create({ data: { ...req.body, company_id: companyId } });
      res.status(201).json(site);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create site' });
    }
  }
);

// Update site
const updateSiteSchema = z.object({
  name: z.string().min(1).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  radius_meters: z.number().int().positive().optional(),
  address: z.string().optional(),
  status: z.enum(['active', 'inactive']).optional(),
}).strict();

router.put(
  '/:id',
  authenticate,
  requireMinRole('manager'),
  validate(updateSiteSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = await getCompanyId(req.user!.email);
      const site = await prisma.site.findUnique({ where: { id: req.params.id } });
      if (!site) {
        res.status(404).json({ error: 'Site not found' });
        return;
      }
      if (!companyId || site.company_id !== companyId) {
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }
      const updated = await prisma.site.update({
        where: { id: req.params.id },
        data: req.body,
      });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update site' });
    }
  }
);

// Delete site
router.delete(
  '/:id',
  authenticate,
  requireMinRole('owner'),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = await getCompanyId(req.user!.email);
      const site = await prisma.site.findUnique({ where: { id: req.params.id } });
      if (!site) {
        res.status(404).json({ error: 'Site not found' });
        return;
      }
      if (!companyId || site.company_id !== companyId) {
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }
      await prisma.site.delete({ where: { id: req.params.id } });
      res.json({ message: 'Site deleted' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete site' });
    }
  }
);

export default router;
