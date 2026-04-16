# Cadence Backend API

Custom Node.js + Express + PostgreSQL backend for the Cadence workforce management app.

## Tech Stack

- **Runtime:** Node.js 20+
- **Framework:** Express.js + TypeScript
- **Database:** PostgreSQL with Prisma ORM
- **Auth:** JWT (access + refresh tokens)
- **Real-time:** Socket.io
- **Payments:** Stripe
- **Validation:** Zod

## Setup

```bash
cd backend
npm install
cp .env.example .env  # Fill in your values
npx prisma generate
npx prisma migrate dev  # Run against your database
npm run dev
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Compile TypeScript |
| `npm start` | Start production server |
| `npx prisma studio` | Open Prisma database GUI |
| `npx prisma migrate dev` | Run database migrations |

## API Routes

| Route | Description |
|-------|-------------|
| `POST /api/auth/register` | Register account |
| `POST /api/auth/login` | Login |
| `POST /api/auth/refresh` | Refresh token |
| `GET /api/auth/me` | Current user |
| `POST /api/auth/invite` | Invite user |
| `POST /api/auth/accept-invite` | Accept invite |
| `POST /api/auth/forgot-password` | Request password reset |
| `POST /api/auth/reset-password` | Reset password |
| `GET/PUT /api/accounts` | Account management |
| `GET/PUT /api/companies` | Company settings |
| `GET/POST/PUT/DELETE /api/worker-profiles` | Worker profiles |
| `GET/POST/DELETE /api/punches` | Clock in/out |
| `GET/POST/PUT/DELETE /api/time-entries` | Time entries |
| `POST /api/time-entries/bulk-approve` | Bulk approve |
| `GET/POST/PUT/DELETE /api/shifts` | Shifts |
| `GET/POST/PUT/DELETE /api/sites` | Sites |
| `GET/POST/PUT/DELETE /api/pay-periods` | Pay periods |
| `GET/POST/PUT /api/payroll-runs` | Payroll runs |
| `POST /api/payroll-runs/finalize` | Finalize payroll |
| `GET/POST/PUT/DELETE /api/expenses` | Expenses |
| `GET/POST/DELETE /api/leave-requests` | Leave requests |
| `POST /api/leave-requests/:id/review` | Approve/deny |
| `GET/POST/PUT/DELETE /api/tax-deductions` | Tax deductions |
| `GET/POST/PUT/DELETE /api/tax-forms` | Tax forms |
| `POST /api/tax-forms/:id/respond` | Worker response |
| `GET/POST/DELETE /api/messages` | Messages |
| `POST /api/messages/:id/read` | Mark read |
| `GET/POST/PUT/DELETE /api/worker-documents` | Documents |
| `GET /api/audit-logs` | Audit logs |
| `POST /api/stripe/create-checkout` | Stripe checkout |
| `POST /api/stripe/webhook` | Stripe webhooks |
| `POST /api/stripe/billing-portal` | Billing portal |
| `GET /api/reports/*` | Reports |
| `GET /api/health` | Health check |

## Deployment

Configured for Railway with Dockerfile. Set environment variables in Railway dashboard, then deploy.
