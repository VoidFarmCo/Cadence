-- Add company_id foreign key to all models missing it
-- and establish proper Account <-> Company relationship

-- 1. Add owner_email to Company for linking
ALTER TABLE "companies" ADD COLUMN "owner_email" TEXT NOT NULL DEFAULT '';

-- 2. Add company_id FK to Account (one-to-one with Company)
ALTER TABLE "accounts" ADD COLUMN "company_id" TEXT;
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_company_id_key" UNIQUE ("company_id");

-- 3. Add company_id to all models that need it
ALTER TABLE "punches" ADD COLUMN "company_id" TEXT;
ALTER TABLE "time_entries" ADD COLUMN "company_id" TEXT;
ALTER TABLE "shifts" ADD COLUMN "company_id" TEXT;
ALTER TABLE "payroll_runs" ADD COLUMN "company_id" TEXT;
ALTER TABLE "expenses" ADD COLUMN "company_id" TEXT;
ALTER TABLE "leave_requests" ADD COLUMN "company_id" TEXT;
ALTER TABLE "tax_deductions" ADD COLUMN "company_id" TEXT;
ALTER TABLE "tax_forms" ADD COLUMN "company_id" TEXT;
ALTER TABLE "worker_documents" ADD COLUMN "company_id" TEXT;
ALTER TABLE "audit_logs" ADD COLUMN "company_id" TEXT;

-- 4. Backfill company_id from worker_profiles for worker-keyed tables
-- For each worker-keyed table, set company_id from the worker's profile
UPDATE "punches" p
SET "company_id" = wp."company_id"
FROM "worker_profiles" wp
WHERE p."worker_email" = wp."user_email" AND wp."company_id" IS NOT NULL AND p."company_id" IS NULL;

UPDATE "time_entries" te
SET "company_id" = wp."company_id"
FROM "worker_profiles" wp
WHERE te."worker_email" = wp."user_email" AND wp."company_id" IS NOT NULL AND te."company_id" IS NULL;

UPDATE "shifts" s
SET "company_id" = wp."company_id"
FROM "worker_profiles" wp
WHERE s."worker_email" = wp."user_email" AND wp."company_id" IS NOT NULL AND s."company_id" IS NULL;

UPDATE "expenses" e
SET "company_id" = wp."company_id"
FROM "worker_profiles" wp
WHERE e."worker_email" = wp."user_email" AND wp."company_id" IS NOT NULL AND e."company_id" IS NULL;

UPDATE "leave_requests" lr
SET "company_id" = wp."company_id"
FROM "worker_profiles" wp
WHERE lr."worker_email" = wp."user_email" AND wp."company_id" IS NOT NULL AND lr."company_id" IS NULL;

UPDATE "tax_deductions" td
SET "company_id" = wp."company_id"
FROM "worker_profiles" wp
WHERE td."worker_email" = wp."user_email" AND wp."company_id" IS NOT NULL AND td."company_id" IS NULL;

UPDATE "tax_forms" tf
SET "company_id" = wp."company_id"
FROM "worker_profiles" wp
WHERE tf."worker_email" = wp."user_email" AND wp."company_id" IS NOT NULL AND tf."company_id" IS NULL;

UPDATE "worker_documents" wd
SET "company_id" = wp."company_id"
FROM "worker_profiles" wp
WHERE wd."worker_email" = wp."user_email" AND wp."company_id" IS NOT NULL AND wd."company_id" IS NULL;

-- Backfill payroll_runs from their pay_period's company_id
UPDATE "payroll_runs" pr
SET "company_id" = pp."company_id"
FROM "pay_periods" pp
WHERE pr."pay_period_id" = pp."id" AND pp."company_id" IS NOT NULL AND pr."company_id" IS NULL;

-- Backfill audit_logs from the performer's worker profile
UPDATE "audit_logs" al
SET "company_id" = wp."company_id"
FROM "users" u
JOIN "worker_profiles" wp ON wp."user_email" = u."email"
WHERE al."performed_by" = u."id" AND wp."company_id" IS NOT NULL AND al."company_id" IS NULL;

-- Backfill Account <-> Company relationship
-- Link accounts to companies by matching owner_email
UPDATE "companies" c
SET "owner_email" = a."owner_email"
FROM "accounts" a
JOIN "worker_profiles" wp ON wp."user_email" = a."owner_email" AND wp."company_id" = c."id"
WHERE c."owner_email" = '';

UPDATE "accounts" a
SET "company_id" = wp."company_id"
FROM "worker_profiles" wp
WHERE wp."user_email" = a."owner_email" AND wp."company_id" IS NOT NULL AND a."company_id" IS NULL;

-- 5. Add foreign key constraints
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "punches" ADD CONSTRAINT "punches_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tax_deductions" ADD CONSTRAINT "tax_deductions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tax_forms" ADD CONSTRAINT "tax_forms_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "messages" ADD CONSTRAINT "messages_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "worker_documents" ADD CONSTRAINT "worker_documents_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 6. Add indexes for company_id on all new columns
CREATE INDEX "accounts_company_id_idx" ON "accounts"("company_id");
CREATE INDEX "punches_company_id_idx" ON "punches"("company_id");
CREATE INDEX "time_entries_company_id_idx" ON "time_entries"("company_id");
CREATE INDEX "shifts_company_id_idx" ON "shifts"("company_id");
CREATE INDEX "payroll_runs_company_id_idx" ON "payroll_runs"("company_id");
CREATE INDEX "expenses_company_id_idx" ON "expenses"("company_id");
CREATE INDEX "leave_requests_company_id_idx" ON "leave_requests"("company_id");
CREATE INDEX "tax_deductions_company_id_idx" ON "tax_deductions"("company_id");
CREATE INDEX "tax_forms_company_id_idx" ON "tax_forms"("company_id");
CREATE INDEX "messages_company_id_idx" ON "messages"("company_id");
CREATE INDEX "worker_documents_company_id_idx" ON "worker_documents"("company_id");
CREATE INDEX "audit_logs_company_id_idx" ON "audit_logs"("company_id");
CREATE INDEX "companies_owner_email_idx" ON "companies"("owner_email");
