-- Add company_id foreign key to all models missing it
-- and establish proper Account <-> Company relationship
--
-- IMPORTANT: This migration handles dirty/orphaned data by cleaning up
-- rows with invalid company_id values BEFORE adding FK constraints.

-- ============================================================================
-- PHASE 1: Schema changes — add new columns (nullable, no FK yet)
-- ============================================================================

-- Add owner_email to Company for linking
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "owner_email" TEXT NOT NULL DEFAULT '';

-- Add company_id to Account (one-to-one with Company)
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "company_id" TEXT;
DO $$ BEGIN
  ALTER TABLE "accounts" ADD CONSTRAINT "accounts_company_id_key" UNIQUE ("company_id");
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;

-- Add company_id to all models that need it
ALTER TABLE "punches" ADD COLUMN IF NOT EXISTS "company_id" TEXT;
ALTER TABLE "time_entries" ADD COLUMN IF NOT EXISTS "company_id" TEXT;
ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "company_id" TEXT;
ALTER TABLE "payroll_runs" ADD COLUMN IF NOT EXISTS "company_id" TEXT;
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "company_id" TEXT;
ALTER TABLE "leave_requests" ADD COLUMN IF NOT EXISTS "company_id" TEXT;
ALTER TABLE "tax_deductions" ADD COLUMN IF NOT EXISTS "company_id" TEXT;
ALTER TABLE "tax_forms" ADD COLUMN IF NOT EXISTS "company_id" TEXT;
ALTER TABLE "worker_documents" ADD COLUMN IF NOT EXISTS "company_id" TEXT;
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "company_id" TEXT;

-- ============================================================================
-- PHASE 2: Clean up orphaned data in tables that ALREADY have company_id
-- These tables (worker_profiles, sites, pay_periods, messages) may have
-- company_id values pointing to non-existent companies.
-- ============================================================================

-- Null out company_id where it references a non-existent company
UPDATE "worker_profiles"
SET "company_id" = NULL
WHERE "company_id" IS NOT NULL
  AND "company_id" NOT IN (SELECT "id" FROM "companies");

UPDATE "sites"
SET "company_id" = NULL
WHERE "company_id" IS NOT NULL
  AND "company_id" NOT IN (SELECT "id" FROM "companies");

UPDATE "pay_periods"
SET "company_id" = NULL
WHERE "company_id" IS NOT NULL
  AND "company_id" NOT IN (SELECT "id" FROM "companies");

UPDATE "messages"
SET "company_id" = NULL
WHERE "company_id" IS NOT NULL
  AND "company_id" NOT IN (SELECT "id" FROM "companies");

-- ============================================================================
-- PHASE 3: Backfill company_id from worker_profiles for worker-keyed tables
-- ============================================================================

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

-- Backfill messages from the sender's worker profile
UPDATE "messages" m
SET "company_id" = wp."company_id"
FROM "worker_profiles" wp
WHERE m."sender_email" = wp."user_email" AND wp."company_id" IS NOT NULL AND m."company_id" IS NULL;

-- ============================================================================
-- PHASE 4: Backfill Account <-> Company relationship
-- ============================================================================

-- Link companies to accounts by matching owner_email
UPDATE "companies" c
SET "owner_email" = a."owner_email"
FROM "accounts" a
JOIN "worker_profiles" wp ON wp."user_email" = a."owner_email" AND wp."company_id" = c."id"
WHERE c."owner_email" = '';

UPDATE "accounts" a
SET "company_id" = wp."company_id"
FROM "worker_profiles" wp
WHERE wp."user_email" = a."owner_email" AND wp."company_id" IS NOT NULL AND a."company_id" IS NULL;

-- ============================================================================
-- PHASE 5: Final cleanup — null out any remaining invalid company_id refs
-- across ALL tables before adding FK constraints. This catches edge cases
-- where backfill produced an invalid reference or data was already bad.
-- ============================================================================

UPDATE "accounts"
SET "company_id" = NULL
WHERE "company_id" IS NOT NULL
  AND "company_id" NOT IN (SELECT "id" FROM "companies");

UPDATE "punches"
SET "company_id" = NULL
WHERE "company_id" IS NOT NULL
  AND "company_id" NOT IN (SELECT "id" FROM "companies");

UPDATE "time_entries"
SET "company_id" = NULL
WHERE "company_id" IS NOT NULL
  AND "company_id" NOT IN (SELECT "id" FROM "companies");

UPDATE "shifts"
SET "company_id" = NULL
WHERE "company_id" IS NOT NULL
  AND "company_id" NOT IN (SELECT "id" FROM "companies");

UPDATE "payroll_runs"
SET "company_id" = NULL
WHERE "company_id" IS NOT NULL
  AND "company_id" NOT IN (SELECT "id" FROM "companies");

UPDATE "expenses"
SET "company_id" = NULL
WHERE "company_id" IS NOT NULL
  AND "company_id" NOT IN (SELECT "id" FROM "companies");

UPDATE "leave_requests"
SET "company_id" = NULL
WHERE "company_id" IS NOT NULL
  AND "company_id" NOT IN (SELECT "id" FROM "companies");

UPDATE "tax_deductions"
SET "company_id" = NULL
WHERE "company_id" IS NOT NULL
  AND "company_id" NOT IN (SELECT "id" FROM "companies");

UPDATE "tax_forms"
SET "company_id" = NULL
WHERE "company_id" IS NOT NULL
  AND "company_id" NOT IN (SELECT "id" FROM "companies");

UPDATE "messages"
SET "company_id" = NULL
WHERE "company_id" IS NOT NULL
  AND "company_id" NOT IN (SELECT "id" FROM "companies");

UPDATE "worker_documents"
SET "company_id" = NULL
WHERE "company_id" IS NOT NULL
  AND "company_id" NOT IN (SELECT "id" FROM "companies");

UPDATE "audit_logs"
SET "company_id" = NULL
WHERE "company_id" IS NOT NULL
  AND "company_id" NOT IN (SELECT "id" FROM "companies");

-- ============================================================================
-- PHASE 6: Add foreign key constraints (safe now — all values are valid)
-- ============================================================================

-- Tables that ALREADY had company_id but no FK constraint
DO $$ BEGIN
  ALTER TABLE "worker_profiles" ADD CONSTRAINT "worker_profiles_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "sites" ADD CONSTRAINT "sites_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "pay_periods" ADD CONSTRAINT "pay_periods_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Tables that got company_id added in this migration
DO $$ BEGIN
  ALTER TABLE "accounts" ADD CONSTRAINT "accounts_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "punches" ADD CONSTRAINT "punches_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "shifts" ADD CONSTRAINT "shifts_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "expenses" ADD CONSTRAINT "expenses_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "tax_deductions" ADD CONSTRAINT "tax_deductions_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "tax_forms" ADD CONSTRAINT "tax_forms_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "messages" ADD CONSTRAINT "messages_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "worker_documents" ADD CONSTRAINT "worker_documents_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- PHASE 7: Create indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS "accounts_company_id_idx" ON "accounts"("company_id");
CREATE INDEX IF NOT EXISTS "punches_company_id_idx" ON "punches"("company_id");
CREATE INDEX IF NOT EXISTS "time_entries_company_id_idx" ON "time_entries"("company_id");
CREATE INDEX IF NOT EXISTS "shifts_company_id_idx" ON "shifts"("company_id");
CREATE INDEX IF NOT EXISTS "payroll_runs_company_id_idx" ON "payroll_runs"("company_id");
CREATE INDEX IF NOT EXISTS "expenses_company_id_idx" ON "expenses"("company_id");
CREATE INDEX IF NOT EXISTS "leave_requests_company_id_idx" ON "leave_requests"("company_id");
CREATE INDEX IF NOT EXISTS "tax_deductions_company_id_idx" ON "tax_deductions"("company_id");
CREATE INDEX IF NOT EXISTS "tax_forms_company_id_idx" ON "tax_forms"("company_id");
CREATE INDEX IF NOT EXISTS "messages_company_id_idx" ON "messages"("company_id");
CREATE INDEX IF NOT EXISTS "worker_documents_company_id_idx" ON "worker_documents"("company_id");
CREATE INDEX IF NOT EXISTS "audit_logs_company_id_idx" ON "audit_logs"("company_id");
CREATE INDEX IF NOT EXISTS "companies_owner_email_idx" ON "companies"("owner_email");
