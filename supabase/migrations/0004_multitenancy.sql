-- ============================================================================
-- Cadence: multi-tenancy + RLS for foundation tables
-- ============================================================================
-- Run this in your Supabase SQL Editor after 0001_initial_schema.sql.
-- Idempotent and safe to re-run.
--
-- This migration:
--   * Creates `company_members` (the tenancy join table).
--   * Adds helper functions: user_can_see_company, user_is_owner_of_company,
--     user_is_admin_of_company, user_is_manager_of_company.
--   * Adds RPC `create_company(name, state)` that creates a company, makes the
--     caller its owner, and bootstraps a 14-day trial account in one shot.
--   * Extends handle_new_user to auto-link pre-created worker_profiles by email.
--   * Enables RLS on every foundation table and installs company-aware policies.
--
-- Workforce-core tables (punches, time_entries, shifts, pay_periods,
-- payroll_runs, expenses, leave_requests, tax_*, messages, worker_documents,
-- audit_logs) get their RLS in their own migrations, reusing the helpers
-- defined here.
-- ============================================================================


-- 1. company_members ---------------------------------------------------------
create table if not exists public.company_members (
  company_id  uuid not null references public.companies(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  role        public.user_role default 'worker',
  status      public.user_status default 'active',
  joined_at   timestamptz default now(),
  primary key (company_id, user_id)
);

create index if not exists idx_company_members_user      on public.company_members(user_id);
create index if not exists idx_company_members_role      on public.company_members(company_id, role);
create index if not exists idx_company_members_active    on public.company_members(company_id) where status = 'active';


-- 2. Helper functions --------------------------------------------------------
-- All marked SECURITY DEFINER so they can read company_members from inside RLS
-- policies without recursing into RLS on company_members itself.

create or replace function public.user_can_see_company(c_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.company_members
    where company_id = c_id
      and user_id = auth.uid()
      and status = 'active'
  );
$$;

create or replace function public.user_is_owner_of_company(c_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.company_members
    where company_id = c_id
      and user_id = auth.uid()
      and role = 'owner'
      and status = 'active'
  );
$$;

-- "admin" = owner OR payroll_admin (i.e. anyone who can touch billing/payroll).
create or replace function public.user_is_admin_of_company(c_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.company_members
    where company_id = c_id
      and user_id = auth.uid()
      and role in ('owner', 'payroll_admin')
      and status = 'active'
  );
$$;

-- "manager" = owner OR payroll_admin OR manager (i.e. anyone who can manage workers).
create or replace function public.user_is_manager_of_company(c_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.company_members
    where company_id = c_id
      and user_id = auth.uid()
      and role in ('owner', 'payroll_admin', 'manager')
      and status = 'active'
  );
$$;


-- 3. create_company RPC ------------------------------------------------------
-- Called from the frontend when a user spins up a new company. Creates the
-- company, makes the caller owner, and bootstraps a trial account.
create or replace function public.create_company(p_name text, p_state text default 'NM')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_company_id uuid;
begin
  if auth.uid() is null then
    raise exception 'must be authenticated';
  end if;
  if p_name is null or btrim(p_name) = '' then
    raise exception 'company name is required';
  end if;

  insert into public.companies (name, owner_id, state)
    values (btrim(p_name), auth.uid(), coalesce(nullif(btrim(p_state), ''), 'NM'))
    returning id into new_company_id;

  insert into public.company_members (company_id, user_id, role, status)
    values (new_company_id, auth.uid(), 'owner', 'active');

  insert into public.accounts (company_id, owner_id, status, plan, trial_end)
    values (new_company_id, auth.uid(), 'trial', 'solo', now() + interval '14 days');

  return new_company_id;
end $$;


-- 4. handle_new_user — auto-link pre-created worker_profiles -----------------
-- A manager can create a worker_profile by email before that worker signs up.
-- On signup we (a) create the profile row, (b) find any worker_profiles whose
-- email matches and stamp them with this user_id, (c) add the user to the
-- corresponding companies as a member with the role from the worker_profile.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  wp record;
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
  on conflict (id) do update
    set email     = excluded.email,
        full_name = coalesce(excluded.full_name, public.profiles.full_name);

  -- Link any worker_profile rows that were pre-created by email.
  for wp in
    select * from public.worker_profiles
     where lower(email) = lower(new.email) and user_id is null
  loop
    update public.worker_profiles
       set user_id = new.id,
           status  = case when status = 'pending' then 'active'::public.user_status else status end
     where id = wp.id;

    insert into public.company_members (company_id, user_id, role, status)
      values (wp.company_id, new.id, wp.role, 'active')
      on conflict (company_id, user_id) do update
        set role   = excluded.role,
            status = excluded.status;
  end loop;

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- 5. RLS ---------------------------------------------------------------------
alter table public.profiles         enable row level security;
alter table public.companies        enable row level security;
alter table public.company_members  enable row level security;
alter table public.accounts         enable row level security;
alter table public.sites            enable row level security;
alter table public.worker_profiles  enable row level security;

-- profiles: every authenticated user can read all profiles (so we can render
-- teammate names and avatars), but only update their own.
drop policy if exists "profiles_read_all"   on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_read_all"
  on public.profiles for select to authenticated using (true);
create policy "profiles_update_own"
  on public.profiles for update to authenticated using (id = auth.uid());

-- companies: visible to members; only admins (owner/payroll_admin) can update;
-- only the owner can delete.
drop policy if exists "companies_read"   on public.companies;
drop policy if exists "companies_insert" on public.companies;
drop policy if exists "companies_update" on public.companies;
drop policy if exists "companies_delete" on public.companies;
create policy "companies_read"
  on public.companies for select to authenticated
  using (public.user_can_see_company(id));
create policy "companies_insert"
  on public.companies for insert to authenticated
  with check (auth.uid() is not null);
create policy "companies_update"
  on public.companies for update to authenticated
  using (public.user_is_admin_of_company(id));
create policy "companies_delete"
  on public.companies for delete to authenticated
  using (public.user_is_owner_of_company(id));

-- company_members: members can read membership of their company; users can
-- always read their own row (so the client knows what they're a member of
-- before any company is selected); admins can manage.
drop policy if exists "company_members_read"  on public.company_members;
drop policy if exists "company_members_self"  on public.company_members;
drop policy if exists "company_members_admin" on public.company_members;
create policy "company_members_read"
  on public.company_members for select to authenticated
  using (user_id = auth.uid() or public.user_can_see_company(company_id));
create policy "company_members_self"
  on public.company_members for insert to authenticated
  with check (user_id = auth.uid());
create policy "company_members_admin"
  on public.company_members for all to authenticated
  using (public.user_is_admin_of_company(company_id))
  with check (public.user_is_admin_of_company(company_id));

-- accounts: billing is sensitive — only company admins read; only owner writes.
drop policy if exists "accounts_read"   on public.accounts;
drop policy if exists "accounts_insert" on public.accounts;
drop policy if exists "accounts_update" on public.accounts;
drop policy if exists "accounts_delete" on public.accounts;
create policy "accounts_read"
  on public.accounts for select to authenticated
  using (public.user_is_admin_of_company(company_id));
create policy "accounts_insert"
  on public.accounts for insert to authenticated
  with check (public.user_is_owner_of_company(company_id));
create policy "accounts_update"
  on public.accounts for update to authenticated
  using (public.user_is_owner_of_company(company_id));
create policy "accounts_delete"
  on public.accounts for delete to authenticated
  using (public.user_is_owner_of_company(company_id));

-- sites: every member of the company can read; manager+ can write.
drop policy if exists "sites_read"  on public.sites;
drop policy if exists "sites_write" on public.sites;
create policy "sites_read"
  on public.sites for select to authenticated
  using (public.user_can_see_company(company_id));
create policy "sites_write"
  on public.sites for all to authenticated
  using (public.user_is_manager_of_company(company_id))
  with check (public.user_is_manager_of_company(company_id));

-- worker_profiles:
--   * A worker can always read their own profile (matched by user_id).
--   * Manager+ can read every worker profile in their company.
--   * Only manager+ can create/update/delete worker profiles.
-- Note: when user_id is NULL (worker hasn't signed up yet), the self-policy
-- evaluates to false — that's correct: only manager+ should see pending rows.
drop policy if exists "worker_profiles_read_self"     on public.worker_profiles;
drop policy if exists "worker_profiles_read_manager"  on public.worker_profiles;
drop policy if exists "worker_profiles_write_manager" on public.worker_profiles;
create policy "worker_profiles_read_self"
  on public.worker_profiles for select to authenticated
  using (user_id = auth.uid());
create policy "worker_profiles_read_manager"
  on public.worker_profiles for select to authenticated
  using (public.user_is_manager_of_company(company_id));
create policy "worker_profiles_write_manager"
  on public.worker_profiles for all to authenticated
  using (public.user_is_manager_of_company(company_id))
  with check (public.user_is_manager_of_company(company_id));
