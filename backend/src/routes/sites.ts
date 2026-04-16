import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { requireMinRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { AuthRequest } from '../types';

const router = Router();

// List sites
router.get('/', authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const sites = await prisma.site.findMany({
      orderBy: { name: 'asc' },
    });
    res.json(sites);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sites' });
  }
});

// Get single site
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const site = await prisma.site.findUnique({ where: { id: req.params.id } });
    if (!site) {
      res.status(404).json({ error: 'Site not found' });
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
      const site = await prisma.site.create({ data: req.body });
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
      await prisma.site.delete({ where: { id: req.params.id } });
      res.json({ message: 'Site deleted' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete site' });
    }
  }
);

export default router;
