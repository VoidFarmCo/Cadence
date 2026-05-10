-- ============================================================================
-- 0011_missing_tables.sql
-- ============================================================================
-- Captures the table creation that an earlier agent (Hermes) applied directly
-- to the live Supabase project but never committed to this repo. Recorded
-- here verbatim so the repo and the live DB agree on migration history.
--
-- IMPORTANT: these tables intentionally do NOT match the foundation pattern
-- in 0001/0007 (which uses uuid PKs + foreign keys to companies/worker_profiles).
-- They use text PKs and denormalized worker_email/company_id strings, mirroring
-- the legacy Prisma schema in backend/prisma/schema.prisma. This is a known
-- inconsistency that we'll address in a future slice; for now we keep what
-- production has so live data continues to read/write.
--
-- 0012 grants ALL on these to anon/authenticated/service_role; 0013 then
-- revokes the anon grant and enables RLS with proper policies. Run them
-- in order on any fresh deploy.
-- ============================================================================

create table if not exists public.audit_logs (
  id           text primary key,
  action       text not null,
  entity_type  text not null,
  entity_id    text,
  performed_by text not null,
  reason       text,
  old_value    text,
  new_value    text,
  details      text,
  created_at   timestamptz default now(),
  company_id   text
);

create table if not exists public.expenses (
  id           text primary key,
  worker_email text not null,
  worker_name  text not null,
  category     text not null,
  amount       numeric not null,
  date         date not null,
  site_id      text,
  site_name    text,
  notes        text,
  receipt_url  text,
  status       text default 'pending',
  created_at   timestamptz default now(),
  updated_at   timestamptz,
  company_id   text
);

create table if not exists public.leave_requests (
  id            text primary key,
  worker_email  text not null,
  worker_name   text not null,
  leave_type    text not null,
  start_date    date not null,
  end_date      date not null,
  total_days    numeric,
  total_hours   numeric,
  notes         text,
  status        text default 'pending',
  reviewed_by   text,
  reviewed_at   timestamptz,
  denial_reason text,
  created_at    timestamptz default now(),
  updated_at    timestamptz,
  company_id    text
);

create table if not exists public.messages (
  id               text primary key,
  type             text not null,
  sender_email     text not null,
  sender_name      text not null,
  recipient_emails text[],
  subject          text,
  content          text not null,
  category         text default 'general',
  is_read          boolean default false,
  read_by          text[] default array[]::text[],
  created_at       timestamptz default now(),
  updated_at       timestamptz,
  company_id       text
);

create table if not exists public.tax_deductions (
  id           text primary key,
  worker_email text not null,
  worker_name  text not null,
  tax_year     integer not null,
  category     text not null,
  description  text,
  amount       numeric,
  miles        numeric,
  date         date,
  receipt_url  text,
  notes        text,
  created_at   timestamptz default now(),
  updated_at   timestamptz,
  company_id   text
);

create table if not exists public.tax_forms (
  id            text primary key,
  title         text not null,
  form_type     text not null,
  description   text,
  worker_email  text not null,
  worker_name   text not null,
  status        text default 'pending',
  sent_by       text,
  sent_at       timestamptz,
  due_date      date,
  completed_at  timestamptz,
  response_data text,
  fields_config text,
  created_at    timestamptz default now(),
  updated_at    timestamptz,
  company_id    text
);

create table if not exists public.worker_documents (
  id           text primary key,
  worker_email text not null,
  worker_name  text not null,
  doc_type     text not null,
  title        text not null,
  file_url     text,
  file_name    text,
  notes        text,
  uploaded_by  text,
  expiry_date  date,
  created_at   timestamptz default now(),
  updated_at   timestamptz,
  company_id   text
);
