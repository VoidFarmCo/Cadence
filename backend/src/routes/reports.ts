import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { requireMinRole } from '../middleware/rbac';
import { AuthRequest } from '../types';
import { getCompanyWorkerEmails } from '../lib/company';

const router = Router();

// Payroll summary report
router.get(
  '/payroll-summary',
  authenticate,
  requireMinRole('payroll_admin'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { pay_period_id, start_date, end_date } = req.query;
      const companyEmails = await getCompanyWorkerEmails(req.user!.email);
      const where: any = { worker_email: { in: companyEmails } };

      if (pay_period_id) {
        where.pay_period_id = pay_period_id;
      }
      if (start_date || end_date) {
        where.date = {};
        if (start_date) where.date.gte = new Date(start_date as string);
        if (end_date) where.date.lte = new Date(end_date as string);
      }

      const entries = await prisma.timeEntry.findMany({
        where: { ...where, status: { in: ['approved', 'submitted'] } },
      });

      // Group by worker
      const byWorker: Record<string, {
        worker_email: string;
        worker_name: string;
        regular_hours: number;
        overtime_hours: number;
        total_hours: number;
        entries: number;
      }> = {};

      for (const entry of entries) {
        if (!byWorker[entry.worker_email]) {
          byWorker[entry.worker_email] = {
            worker_email: entry.worker_email,
            worker_name: entry.worker_name,
            regular_hours: 0,
            overtime_hours: 0,
            total_hours: 0,
            entries: 0,
          };
        }
        const w = byWorker[entry.worker_email];
        w.regular_hours += entry.regular_hours || 0;
        w.overtime_hours += entry.overtime_hours || 0;
        w.total_hours += entry.total_hours || 0;
        w.entries++;
      }

      const workers = Object.values(byWorker);
      const totals = workers.reduce(
        (acc, w) => ({
          regular_hours: acc.regular_hours + w.regular_hours,
          overtime_hours: acc.overtime_hours + w.overtime_hours,
          total_hours: acc.total_hours + w.total_hours,
          worker_count: acc.worker_count + 1,
        }),
        { regular_hours: 0, overtime_hours: 0, total_hours: 0, worker_count: 0 }
      );

      res.json({ workers, totals });
    } catch (error) {
      res.status(500).json({ error: 'Failed to generate payroll summary' });
    }
  }
);

// Time entry report
router.get(
  '/time-entries',
  authenticate,
  requireMinRole('manager'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { worker_email, site_id, start_date, end_date, status } = req.query;
      const companyEmails = await getCompanyWorkerEmails(req.user!.email);

      const where: any = { worker_email: { in: companyEmails } };

      if (worker_email) {
        const wEmail = worker_email as string;
        where.worker_email = companyEmails.includes(wEmail) ? wEmail : '__none__';
      }
      if (site_id) where.site_id = site_id;
      if (status) where.status = status;
      if (start_date || end_date) {
        where.date = {};
        if (start_date) where.date.gte = new Date(start_date as string);
        if (end_date) where.date.lte = new Date(end_date as string);
      }

      const entries = await prisma.timeEntry.findMany({
        where,
        orderBy: [{ date: 'asc' }, { worker_email: 'asc' }],
      });

      res.json(entries);
    } catch (error) {
      res.status(500).json({ error: 'Failed to generate time entry report' });
    }
  }
);

// Expense report
router.get(
  '/expenses',
  authenticate,
  requireMinRole('manager'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { worker_email, category, start_date, end_date, status } = req.query;
      const companyEmails = await getCompanyWorkerEmails(req.user!.email);

      const where: any = { worker_email: { in: companyEmails } };

      if (worker_email) {
        const wEmail = worker_email as string;
        where.worker_email = companyEmails.includes(wEmail) ? wEmail : '__none__';
      }
      if (category) where.category = category;
      if (status) where.status = status;
      if (start_date || end_date) {
        where.date = {};
        if (start_date) where.date.gte = new Date(start_date as string);
        if (end_date) where.date.lte = new Date(end_date as string);
      }

      const expenses = await prisma.expense.findMany({
        where,
        orderBy: { date: 'desc' },
      });

      const totalAmount = expenses.reduce((sum: number, e: { amount: number }) => sum + e.amount, 0);
      const byCategory: Record<string, number> = {};
      for (const e of expenses) {
        byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
      }

      res.json({ expenses, totalAmount, byCategory });
    } catch (error) {
      res.status(500).json({ error: 'Failed to generate expense report' });
    }
  }
);

// Worker attendance report
router.get(
  '/attendance',
  authenticate,
  requireMinRole('manager'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { start_date, end_date } = req.query;
      const companyEmails = await getCompanyWorkerEmails(req.user!.email);

      const where: any = { worker_email: { in: companyEmails } };

      if (start_date || end_date) {
        where.timestamp = {};
        if (start_date) where.timestamp.gte = new Date(start_date as string);
        if (end_date) where.timestamp.lte = new Date(end_date as string);
      }

      const punches = await prisma.punch.findMany({
        where,
        orderBy: { timestamp: 'desc' },
      });

      // Group by worker
      const byWorker: Record<string, {
        worker_email: string;
        worker_name: string;
        clock_ins: number;
        clock_outs: number;
        out_of_geofence: number;
      }> = {};

      for (const punch of punches) {
        if (!byWorker[punch.worker_email]) {
          byWorker[punch.worker_email] = {
            worker_email: punch.worker_email,
            worker_name: punch.worker_name,
            clock_ins: 0,
            clock_outs: 0,
            out_of_geofence: 0,
          };
        }
        const w = byWorker[punch.worker_email];
        if (punch.punch_type === 'clock_in') w.clock_ins++;
        if (punch.punch_type === 'clock_out') w.clock_outs++;
        if (punch.out_of_geofence) w.out_of_geofence++;
      }

      res.json({ workers: Object.values(byWorker) });
    } catch (error) {
      res.status(500).json({ error: 'Failed to generate attendance report' });
    }
  }
);

export default router;
