-- ============================================================================
-- Cadence initial schema
-- ============================================================================
-- Run this in your Supabase SQL Editor (Dashboard -> SQL -> New query -> paste).
-- Safe to re-run: every CREATE uses IF NOT EXISTS or is otherwise idempotent.
--
-- This is the foundation slice (Phase 1) of the move from the custom Express +
-- Prisma + JWT backend to Supabase. It mirrors the structure of WorkHub's
-- migrations: foundation tables + auth wiring here, multitenancy + RLS in 0004.
--
-- Sections:
--   1. Extensions
--   2. Enums (carry across from backend/prisma/schema.prisma)
--   3. profiles (extends auth.users 1:1)
--   4. companies (tenants)
--   5. accounts (one billing record per company)
--   6. sites
--   7. worker_profiles
--   8. Indexes
--   9. Triggers (auto-create profile on signup, updated_at)
-- ============================================================================


-- 1. Extensions ---------------------------------------------------------------
create extension if not exists "uuid-ossp";


-- 2. Enums --------------------------------------------------------------------
-- These come from backend/prisma/schema.prisma. Wrapped in DO blocks so the
-- migration is idempotent.

do $$ begin
  create type public.user_role as enum ('owner', 'payroll_admin', 'manager', 'worker');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.platform_role as enum ('user', 'superadmin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.user_status as enum ('active', 'inactive', 'pending');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.account_status as enum ('trial', 'active', 'locked', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.account_plan as enum ('solo', 'pro', 'business', 'business_pro', 'enterprise');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.billing_interval as enum ('month', 'year');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.lock_reason as enum ('trial_expired', 'payment_failed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.pay_period_type as enum ('weekly', 'biweekly', 'semimonthly', 'monthly');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.workweek_start as enum ('sunday', 'monday');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.worker_type as enum ('employee', 'contractor');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.pay_preference as enum ('direct_deposit', 'paper_check');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.dd_status as enum ('not_setup', 'setup_in_qb');
exception when duplicate_object then null; end $$;


-- 3. profiles -----------------------------------------------------------------
-- Mirrors auth.users 1:1 and adds Cadence-specific identity fields.
-- The Prisma User model's password_hash / invite_token / reset_token columns
-- are intentionally dropped: Supabase Auth owns credentials.
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text unique not null,
  full_name     text not null,
  avatar_url    text,
  platform_role public.platform_role default 'user',
  status        public.user_status default 'active',
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);


-- 4. companies ----------------------------------------------------------------
-- Tenant root. Every workforce row eventually points at a company.
create table if not exists public.companies (
  id                     uuid primary key default uuid_generate_v4(),
  name                   text not null,
  owner_id               uuid references public.profiles(id) on delete set null,
  address                text,
  city                   text,
  state                  text default 'NM',
  zip                    text,
  phone                  text,
  pay_period_type        public.pay_period_type default 'biweekly',
  pay_period_start_date  date,
  workweek_start         public.workweek_start default 'sunday',
  overtime_threshold     int default 40,
  created_at             timestamptz default now(),
  updated_at             timestamptz default now()
);


-- 5. accounts -----------------------------------------------------------------
-- Billing/subscription state. Exactly one per company.
create table if not exists public.accounts (
  id                          uuid primary key default uuid_generate_v4(),
  company_id                  uuid unique references public.companies(id) on delete cascade,
  owner_id                    uuid references public.profiles(id) on delete set null,
  status                      public.account_status default 'trial',
  plan                        public.account_plan default 'solo',
  billing_interval            public.billing_interval default 'month',
  trial_start                 timestamptz default now(),
  trial_end                   timestamptz not null,
  stripe_customer_id          text,
  stripe_subscription_id      text,
  stripe_subscription_status  text,
  user_limit                  int default 5,
  lock_reason                 public.lock_reason,
  reminder_25_sent            boolean default false,
  reminder_29_sent            boolean default false,
  created_at                  timestamptz default now(),
  updated_at                  timestamptz default now()
);


-- 6. sites --------------------------------------------------------------------
-- Physical job sites for geofenced punches.
create table if not exists public.sites (
  id            uuid primary key default uuid_generate_v4(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  name          text not null,
  latitude      double precision,
  longitude     double precision,
  radius_meters int default 200,
  address       text,
  status        public.user_status default 'active',
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);


-- 7. worker_profiles ----------------------------------------------------------
-- One row per worker per company. user_id is nullable: a manager can create a
-- worker_profile by email before that person has signed up; on signup, the
-- handle_new_user trigger (extended in 0004) links it to the auth user.
create table if not exists public.worker_profiles (
  id              uuid primary key default uuid_generate_v4(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  user_id         uuid references auth.users(id) on delete set null,
  email           text not null,
  full_name       text not null,
  phone           text,
  worker_type     public.worker_type default 'employee',
  role            public.user_role default 'worker',
  pay_rate        numeric,
  default_site_id uuid references public.sites(id) on delete set null,
  status          public.user_status default 'pending',
  pay_preference  public.pay_preference default 'paper_check',
  dd_status       public.dd_status default 'not_setup',
  qb_entity_id    text,
  pto_balance     numeric default 0,
  sick_balance    numeric default 0,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  unique (company_id, email)
);


-- 8. Indexes ------------------------------------------------------------------
create index if not exists idx_companies_owner          on public.companies(owner_id);
create index if not exists idx_accounts_company         on public.accounts(company_id);
create index if not exists idx_accounts_status          on public.accounts(status);
create index if not exists idx_accounts_stripe_customer on public.accounts(stripe_customer_id);
create index if not exists idx_sites_company            on public.sites(company_id);
create index if not exists idx_sites_status             on public.sites(status);
create index if not exists idx_worker_profiles_company  on public.worker_profiles(company_id);
create index if not exists idx_worker_profiles_user     on public.worker_profiles(user_id);
create index if not exists idx_worker_profiles_email    on public.worker_profiles(email);
create index if not exists idx_worker_profiles_status   on public.worker_profiles(status);


-- 9. Triggers -----------------------------------------------------------------

-- Auto-create a profile row whenever a new auth user signs up.
-- This is the same pattern as WorkHub's handle_new_user; 0004 extends it to
-- also link any pre-created worker_profiles by email.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Generic updated_at maintenance.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists companies_updated_at on public.companies;
create trigger companies_updated_at
  before update on public.companies
  for each row execute function public.touch_updated_at();

drop trigger if exists accounts_updated_at on public.accounts;
create trigger accounts_updated_at
  before update on public.accounts
  for each row execute function public.touch_updated_at();

drop trigger if exists sites_updated_at on public.sites;
create trigger sites_updated_at
  before update on public.sites
  for each row execute function public.touch_updated_at();

drop trigger if exists worker_profiles_updated_at on public.worker_profiles;
create trigger worker_profiles_updated_at
  before update on public.worker_profiles
  for each row execute function public.touch_updated_at();
