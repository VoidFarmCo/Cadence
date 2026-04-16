import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { requireMinRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { AuthRequest, qs } from '../types';
import { getIO } from '../lib/socket';
import { getCompanyWorkerEmails } from '../lib/company';
import { checkGeofenceAndAlert } from '../services/geofence.service';

const router = Router();

// List punches
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const worker_email = qs(req.query.worker_email);
    const site_id = qs(req.query.site_id);
    const punch_type = qs(req.query.punch_type);
    const start_date = qs(req.query.start_date);
    const end_date = qs(req.query.end_date);
    const where: any = {};

    if (req.user!.role === 'worker') {
      where.worker_email = req.user!.email;
    } else {
      const companyEmails = await getCompanyWorkerEmails(req.user!.email);
      where.worker_email = worker_email
        ? (companyEmails.includes(worker_email) ? worker_email : '__none__')
        : { in: companyEmails };
    }

    if (site_id) where.site_id = site_id;
    if (punch_type) where.punch_type = punch_type;
    if (start_date || end_date) {
      where.timestamp = {};
      if (start_date) where.timestamp.gte = new Date(start_date);
      if (end_date) where.timestamp.lte = new Date(end_date);
    }

    const punches = await prisma.punch.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: 500,
    });
    res.json(punches);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch punches' });
  }
});

// Get single punch
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const punch = await prisma.punch.findUnique({ where: { id: req.params.id } });
    if (!punch) {
      res.status(404).json({ error: 'Punch not found' });
      return;
    }

    if (req.user!.role === 'worker' && punch.worker_email !== req.user!.email) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    res.json(punch);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch punch' });
  }
});

// Create punch
const createPunchSchema = z.object({
  punch_type: z.enum(['clock_in', 'break_start', 'break_end', 'clock_out']),
  timestamp: z.string().datetime().optional(),
  device_timestamp: z.string().datetime().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  gps_accuracy: z.number().optional(),
  site_id: z.string().uuid().optional(),
  site_name: z.string().optional(),
  out_of_geofence: z.boolean().optional(),
  out_of_geofence_reason: z.enum(['gps_unavailable', 'outside_radius', 'no_site_assigned']).optional(),
  note: z.string().optional(),
  offline_captured: z.boolean().optional(),
});

router.post('/', authenticate, validate(createPunchSchema), async (req: AuthRequest, res: Response) => {
  try {
    const workerProfile = await prisma.workerProfile.findFirst({
      where: { user_email: req.user!.email },
    });

    const punch = await prisma.punch.create({
      data: {
        ...req.body,
        worker_email: req.user!.email,
        worker_name: workerProfile?.full_name || req.user!.email,
        timestamp: req.body.timestamp ? new Date(req.body.timestamp) : new Date(),
        device_timestamp: req.body.device_timestamp ? new Date(req.body.device_timestamp) : undefined,
        synced_at: req.body.offline_captured ? new Date() : undefined,
      },
    });

    // Emit real-time event
    try {
      getIO().emit('punch:created', punch);
    } catch {}

    // Check geofence and alert asynchronously
    if (punch.out_of_geofence) {
      checkGeofenceAndAlert(punch.id).catch(console.error);
    }

    res.status(201).json(punch);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create punch' });
  }
});

// Delete punch (admin only)
router.delete(
  '/:id',
  authenticate,
  requireMinRole('manager'),
  async (req: AuthRequest, res: Response) => {
    try {
      await prisma.punch.delete({ where: { id: req.params.id } });
      res.json({ message: 'Punch deleted' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete punch' });
    }
  }
);

export default router;
