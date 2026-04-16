import express from 'express';
import cors from 'cors';
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

const app = express();
const server = createServer(app);

// ─── Socket.io Setup ────────────────────────────────────────────────────────

const io = new SocketServer(server, {
  cors: {
    origin: env.APP_URL,
    methods: ['GET', 'POST'],
  },
});

initSocket(io);

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

// ─── Middleware ──────────────────────────────────────────────────────────────

app.use(cors({
  origin: env.APP_URL,
  credentials: true,
}));

// Stripe webhook needs raw body — mount before json parser
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));

// JSON parser for everything else
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Health Check ───────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ─── Routes ─────────────────────────────────────────────────────────────────

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

// ─── Error Handler (must be last) ──────────────────────────────────────────

app.use(errorHandler);

// ─── Start Server ───────────────────────────────────────────────────────────

const PORT = parseInt(env.PORT, 10);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Cadence API running on port ${PORT}`);
  console.log(`Environment: ${env.NODE_ENV}`);
});

export default app;
