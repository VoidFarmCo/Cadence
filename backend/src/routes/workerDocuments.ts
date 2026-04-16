import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { requireMinRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { AuthRequest, qs } from '../types';
import { getCompanyWorkerEmails } from '../lib/company';

const router = Router();

// List documents
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const worker_email = qs(req.query.worker_email);
    const doc_type = qs(req.query.doc_type);
    const where: any = {};

    if (req.user!.role === 'worker') {
      where.worker_email = req.user!.email;
    } else {
      const companyEmails = await getCompanyWorkerEmails(req.user!.email);
      where.worker_email = worker_email
        ? (companyEmails.includes(worker_email) ? worker_email : '__none__')
        : { in: companyEmails };
    }

    if (doc_type) where.doc_type = doc_type;

    const documents = await prisma.workerDocument.findMany({
      where,
      orderBy: { created_at: 'desc' },
    });
    res.json(documents);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// Get single document
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const doc = await prisma.workerDocument.findUnique({ where: { id: req.params.id } });
    if (!doc) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    if (req.user!.role === 'worker') {
      if (doc.worker_email !== req.user!.email) {
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }
    } else {
      const companyEmails = await getCompanyWorkerEmails(req.user!.email);
      if (!companyEmails.includes(doc.worker_email)) {
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }
    }

    res.json(doc);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});

// Create document
const createDocumentSchema = z.object({
  worker_email: z.string().email(),
  worker_name: z.string().optional(),
  doc_type: z.enum(['id_document', 'certification', 'contract', 'tax_form', 'policy_acknowledgement', 'other']),
  title: z.string().min(1),
  file_url: z.string().optional(),
  file_name: z.string().optional(),
  notes: z.string().optional(),
  expiry_date: z.string().optional(),
});

router.post(
  '/',
  authenticate,
  requireMinRole('manager'),
  validate(createDocumentSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyEmails = await getCompanyWorkerEmails(req.user!.email);
      if (!companyEmails.includes(req.body.worker_email)) {
        res.status(403).json({ error: 'Worker not found in your company' });
        return;
      }

      const workerProfile = await prisma.workerProfile.findFirst({
        where: { user_email: req.body.worker_email },
      });

      const doc = await prisma.workerDocument.create({
        data: {
          ...req.body,
          worker_name: req.body.worker_name || workerProfile?.full_name || req.body.worker_email,
          uploaded_by: req.user!.email,
          expiry_date: req.body.expiry_date ? new Date(req.body.expiry_date) : undefined,
        },
      });

      res.status(201).json(doc);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create document' });
    }
  }
);

// Update document
const updateDocumentSchema = z.object({
  doc_type: z.enum(['id_document', 'certification', 'contract', 'tax_form', 'policy_acknowledgement', 'other']).optional(),
  title: z.string().min(1).optional(),
  file_url: z.string().optional(),
  file_name: z.string().optional(),
  notes: z.string().optional(),
  expiry_date: z.string().nullable().optional(),
}).strict();

router.put(
  '/:id',
  authenticate,
  requireMinRole('manager'),
  validate(updateDocumentSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const existing = await prisma.workerDocument.findUnique({ where: { id: req.params.id } });
      if (!existing) {
        res.status(404).json({ error: 'Document not found' });
        return;
      }
      const companyEmails = await getCompanyWorkerEmails(req.user!.email);
      if (!companyEmails.includes(existing.worker_email)) {
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }

      const data: any = { ...req.body };
      if (data.expiry_date) data.expiry_date = new Date(data.expiry_date);
      if (data.expiry_date === null) data.expiry_date = null;

      const updated = await prisma.workerDocument.update({
        where: { id: req.params.id },
        data,
      });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update document' });
    }
  }
);

// Delete document
router.delete(
  '/:id',
  authenticate,
  requireMinRole('manager'),
  async (req: AuthRequest, res: Response) => {
    try {
      const doc = await prisma.workerDocument.findUnique({ where: { id: req.params.id } });
      if (!doc) {
        res.status(404).json({ error: 'Document not found' });
        return;
      }
      const companyEmails = await getCompanyWorkerEmails(req.user!.email);
      if (!companyEmails.includes(doc.worker_email)) {
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }
      await prisma.workerDocument.delete({ where: { id: req.params.id } });
      res.json({ message: 'Document deleted' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete document' });
    }
  }
);

export default router;
