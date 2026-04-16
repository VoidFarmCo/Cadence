import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { env } from './config/env';
import { initSocket } from './lib/socket';
import { errorHandler } from './middleware/errorHandler';

// Route imports
import authRoutes from './routes/auth';
import accountRoutes from './routes/accounts';
import companyRoutes from './routes/companies';
import workerProfileRoutes from './routes/workerProfiles';
import punchRoutes from './routes/punches';
import timeEntryRoutes from './routes/timeEntries';
import shiftRoutes from './routes/shifts';
import siteRoutes from './routes/sites';
import payPeriodRoutes from './routes/payPeriods';
import payrollRunRoutes from './routes/payrollRuns';
import expenseRoutes from './routes/expenses';
import leaveRequestRoutes from './routes/leaveRequests';
import taxDeductionRoutes from './routes/taxDeductions';
import taxFormRoutes from './routes/taxForms';
import messageRoutes from './routes/messages';
import workerDocumentRoutes from './routes/workerDocuments';
import auditLogRoutes from './routes/auditLogs';
import stripeRoutes from './routes/stripe';
import reportRoutes from './routes/reports';
import adminRoutes from './routes/admin';
import { processTrialReminders } from './services/trial.service';

const app = express();
const server = createServer(app);

// ─── Socket.io Setup ────────────────────────────────────────────────────────

const ALLOWED_ORIGINS = [env.APP_URL, env.APP_URL.replace('https://', 'https://www.')];

const io = new SocketServer(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

initSocket(io);

io.use((socket, next) => {
  // Accept token from cookie or auth handshake
  const cookieHeader = socket.handshake.headers.cookie || '';
  const cookieToken = cookieHeader.split(';').find(c => c.trim().startsWith('accessToken='))?.split('=')[1];
  const token = cookieToken || socket.handshake.auth.token;
  if (!token) return next(new Error('Authentication required'));
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    (socket as any).user = decoded;
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

// ─── Middleware ──────────────────────────────────────────────────────────────

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false, // API only — no HTML served
}));

app.use(cors({
  origin: ALLOWED_ORIGINS,
  credentials: true,
}));

// Rate limiters
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});

const strictLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});

// Stripe webhook needs raw body — mount before json parser
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));

// JSON parser for everything else
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ─── Health Check ───────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ─── Routes ─────────────────────────────────────────────────────────────────

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', strictLimiter);
app.use('/api/auth/reset-password', strictLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/worker-profiles', workerProfileRoutes);
app.use('/api/punches', punchRoutes);
app.use('/api/time-entries', timeEntryRoutes);
app.use('/api/shifts', shiftRoutes);
app.use('/api/sites', siteRoutes);
app.use('/api/pay-periods', payPeriodRoutes);
app.use('/api/payroll-runs', payrollRunRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/leave-requests', leaveRequestRoutes);
app.use('/api/tax-deductions', taxDeductionRoutes);
app.use('/api/tax-forms', taxFormRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/worker-documents', workerDocumentRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/stripe', stripeRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/admin', adminRoutes);

// ─── Error Handler (must be last) ──────────────────────────────────────────

app.use(errorHandler);

// ─── Trial Reminder Cron (runs every 6 hours) ────────────────────────────────

setInterval(async () => {
  try {
    const result = await processTrialReminders();
    if (result.reminded > 0 || result.locked > 0) {
      console.log(`Trial cron: ${result.reminded} reminded, ${result.locked} locked`);
    }
  } catch (err) {
    console.error('Trial cron error:', err);
  }
}, 6 * 60 * 60 * 1000); // every 6 hours

// ─── Start Server ───────────────────────────────────────────────────────────

const PORT = parseInt(env.PORT, 10);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Cadence API running on port ${PORT}`);
  console.log(`Environment: ${env.NODE_ENV}`);
});

export default app;
