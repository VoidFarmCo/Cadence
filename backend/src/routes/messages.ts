import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { requireMinRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { AuthRequest, qs } from '../types';
import { emitToCompany } from '../lib/socket';
import { getCompanyId, parsePagination, paginatedResponse } from '../lib/company';

const router = Router();

// List messages
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const type = qs(req.query.type);
    const category = qs(req.query.category);

    const companyId = await getCompanyId(req.user!.email);
    if (!companyId) { res.json(paginatedResponse([], 0, 1, 50)); return; }

    const where: any = { company_id: companyId };
    if (req.user!.role === 'worker') {
      where.OR = [
        { sender_email: req.user!.email },
        { recipient_emails: { has: req.user!.email } },
        { type: 'broadcast' },
      ];
    }

    if (type) where.type = type;
    if (category) where.category = category;

    const { skip, take, page, limit } = parsePagination({
      page: qs(req.query.page),
      limit: qs(req.query.limit),
    });

    const [messages, total] = await Promise.all([
      prisma.message.findMany({ where, orderBy: { created_at: 'desc' }, skip, take }),
      prisma.message.count({ where }),
    ]);

    res.json(paginatedResponse(messages, total, page, limit));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Get single message
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const companyId = await getCompanyId(req.user!.email);
    const message = await prisma.message.findUnique({ where: { id: req.params.id } });
    if (!message) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }
    if (!companyId || message.company_id !== companyId) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    // Workers can only see their own messages
    if (req.user!.role === 'worker') {
      if (message.sender_email !== req.user!.email &&
          !message.recipient_emails.includes(req.user!.email) &&
          message.type !== 'broadcast') {
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }
    }
    res.json(message);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch message' });
  }
});

// Create message
const createMessageSchema = z.object({
  type: z.enum(['broadcast', 'direct']),
  recipient_emails: z.array(z.string().email()).min(1),
  subject: z.string().optional(),
  content: z.string().min(1),
  category: z.enum(['announcement', 'schedule_change', 'urgent', 'general']).optional(),
});

router.post(
  '/',
  authenticate,
  requireMinRole('manager'),
  validate(createMessageSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = await getCompanyId(req.user!.email);
      const senderProfile = await prisma.workerProfile.findFirst({
        where: { user_email: req.user!.email },
      });

      const message = await prisma.message.create({
        data: {
          ...req.body,
          sender_email: req.user!.email,
          sender_name: senderProfile?.full_name || req.user!.email,
          company_id: companyId,
        },
      });

      emitToCompany(companyId, 'message:new', message);

      res.status(201).json(message);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create message' });
    }
  }
);

// Mark message as read
router.post('/:id/read', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const companyId = await getCompanyId(req.user!.email);
    const message = await prisma.message.findUnique({ where: { id: req.params.id } });
    if (!message) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }
    if (!companyId || message.company_id !== companyId) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    const readBy = new Set(message.read_by);
    readBy.add(req.user!.email);

    const updated = await prisma.message.update({
      where: { id: req.params.id },
      data: {
        read_by: Array.from(readBy),
        is_read: true,
      },
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark message as read' });
  }
});

// Delete message
router.delete(
  '/:id',
  authenticate,
  requireMinRole('manager'),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = await getCompanyId(req.user!.email);
      const message = await prisma.message.findUnique({ where: { id: req.params.id } });
      if (!message) {
        res.status(404).json({ error: 'Message not found' });
        return;
      }
      if (!companyId || message.company_id !== companyId) {
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }
      await prisma.message.delete({ where: { id: req.params.id } });
      res.json({ message: 'Message deleted' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete message' });
    }
  }
);

export default router;
