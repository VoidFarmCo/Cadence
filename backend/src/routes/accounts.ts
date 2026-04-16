import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { AuthRequest } from '../types';
import { createAuditLog } from '../services/audit.service';
import { getCompanyId } from '../lib/company';

const router = Router();

// Get current account
router.get('/', authenticate, requireRole('owner'), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = await getCompanyId(req.user!.email);
    const account = await prisma.account.findFirst({
      where: companyId ? { company_id: companyId } : { owner_email: req.user!.email },
    });
    if (!account) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }
    res.json(account);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch account' });
  }
});

// Update account (plan/billing_interval are managed by Stripe webhooks only)
const updateAccountSchema = z.object({
  owner_name: z.string().min(1).optional(),
}).strict();

router.put(
  '/',
  authenticate,
  requireRole('owner'),
  validate(updateAccountSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const account = await prisma.account.findFirst({
        where: { owner_email: req.user!.email },
      });
      if (!account) {
        res.status(404).json({ error: 'Account not found' });
        return;
      }

      const updated = await prisma.account.update({
        where: { id: account.id },
        data: req.body,
      });

      await createAuditLog({
        action: 'update',
        entityType: 'account',
        entityId: account.id,
        performedBy: req.user!.userId,
        oldValue: account,
        newValue: updated,
      });

      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update account' });
    }
  }
);

export default router;
