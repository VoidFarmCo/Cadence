import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { requireMinRole } from '../middleware/rbac';
import { AuthRequest, qs } from '../types';
import { getCompanyWorkerEmails } from '../lib/company';

const router = Router();

async function getCompanyUserIds(userEmail: string): Promise<string[]> {
  const companyEmails = await getCompanyWorkerEmails(userEmail);
  const users = await prisma.user.findMany({
    where: { email: { in: companyEmails } },
    select: { id: true },
  });
  return users.map((u: { id: string }) => u.id);
}

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

      const companyUserIds = await getCompanyUserIds(req.user!.email);
      const where: any = { performed_by: { in: companyUserIds } };

      if (entity_type) where.entity_type = entity_type;
      if (entity_id) where.entity_id = entity_id;
      if (performed_by) {
        // Only allow filtering to a user within the company
        where.performed_by = companyUserIds.includes(performed_by) ? performed_by : '__none__';
      }
      if (action) where.action = action;
      if (start_date || end_date) {
        where.created_at = {};
        if (start_date) where.created_at.gte = new Date(start_date);
        if (end_date) where.created_at.lte = new Date(end_date);
      }

      const page = parseInt(qs(req.query.page) || '0', 10) || 1;
      const limit = Math.min(parseInt(qs(req.query.limit) || '0', 10) || 50, 200);

      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          orderBy: { created_at: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            performer: {
              select: { email: true, full_name: true },
            },
          },
        }),
        prisma.auditLog.count({ where }),
      ]);

      res.json({
        data: logs,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
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
      const companyUserIds = await getCompanyUserIds(req.user!.email);

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

      if (!companyUserIds.includes(log.performed_by)) {
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
