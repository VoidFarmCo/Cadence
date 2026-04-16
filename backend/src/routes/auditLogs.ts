import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { requireMinRole } from '../middleware/rbac';
import { AuthRequest, qs } from '../types';
import { getCompanyId, parsePagination, paginatedResponse } from '../lib/company';

const router = Router();

// List audit logs
router.get(
  '/',
  authenticate,
  requireMinRole('manager'),
  async (req: AuthRequest, res: Response) => {
    try {
      const entity_type = qs(req.query.entity_type);
      const entity_id = qs(req.query.entity_id);
      const performed_by = qs(req.query.performed_by);
      const action = qs(req.query.action);
      const start_date = qs(req.query.start_date);
      const end_date = qs(req.query.end_date);

      const companyId = await getCompanyId(req.user!.email);
      if (!companyId) { res.json(paginatedResponse([], 0, 1, 50)); return; }

      const where: any = { company_id: companyId };

      if (entity_type) where.entity_type = entity_type;
      if (entity_id) where.entity_id = entity_id;
      if (performed_by) where.performed_by = performed_by;
      if (action) where.action = action;
      if (start_date || end_date) {
        where.created_at = {};
        if (start_date) where.created_at.gte = new Date(start_date);
        if (end_date) where.created_at.lte = new Date(end_date);
      }

      const { skip, take, page, limit } = parsePagination({
        page: qs(req.query.page),
        limit: qs(req.query.limit),
      });

      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          orderBy: { created_at: 'desc' },
          skip,
          take,
          include: {
            performer: {
              select: { email: true, full_name: true },
            },
          },
        }),
        prisma.auditLog.count({ where }),
      ]);

      res.json(paginatedResponse(logs, total, page, limit));
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
  }
);

// Get single audit log
router.get(
  '/:id',
  authenticate,
  requireMinRole('manager'),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = await getCompanyId(req.user!.email);

      const log = await prisma.auditLog.findUnique({
        where: { id: req.params.id },
        include: {
          performer: {
            select: { email: true, full_name: true },
          },
        },
      });
      if (!log) {
        res.status(404).json({ error: 'Audit log not found' });
        return;
      }

      if (!companyId || log.company_id !== companyId) {
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }

      res.json(log);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch audit log' });
    }
  }
);

export default router;
