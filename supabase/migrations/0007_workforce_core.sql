-- ============================================================================
-- Cadence: workforce-core tables (punches, time_entries, shifts, pay_periods,
-- payroll_runs)
-- ============================================================================
-- Each table is company-scoped via a NOT NULL company_id and uses worker_profile_id
-- (FK to worker_profiles) as the canonical worker reference. RLS reuses the
-- helpers from 0004 (user_can_see_company / user_is_manager_of_company /
-- user_is_admin_of_company) plus a new user_owns_worker_profile helper.
-- ============================================================================


-- 1. Enums --------------------------------------------------------------------

do $$ begin
  create type public.punch_type as enum ('clock_in', 'break_start', 'break_end', 'clock_out');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.oof_reason as enum ('gps_unavailable', 'outside_radius', 'no_site_assigned');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.time_entry_status as enum ('pending', 'submitted', 'approved', 'rejected', 'corrected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.shift_status as enum ('scheduled', 'confirmed', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.pay_period_status as enum ('open', 'locked', 'paid');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payroll_run_status as enum ('draft', 'reviewing', 'submitted', 'completed', 'failed');
exception when duplicate_object then null; end $$;


-- 2. pay_periods (referenced by time_entries & payroll_runs, so first) -------

create table if not exists public.pay_periods (
  id                    uuid primary key default uuid_generate_v4(),
  company_id            uuid not null references public.companies(id) on delete cascade,
  start_date            date not null,
  end_date              date not null,
  status                public.pay_period_status default 'open',
  locked_at             timestamptz,
  locked_by             uuid references public.profiles(id) on delete set null,
  unlock_reason         text,
  total_regular_hours   numeric default 0,
  total_overtime_hours  numeric default 0,
  worker_count          int default 0,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

create index if not exists idx_pay_periods_company   on public.pay_periods(company_id);
create index if not exists idx_pay_periods_status    on public.pay_periods(status);
create index if not exists idx_pay_periods_dates     on public.pay_periods(start_date, end_date);
create index if not exists idx_pay_periods_locked_by on public.pay_periods(locked_by);


-- 3. punches -----------------------------------------------------------------

create table if not exists public.punches (
  id                       uuid primary key default uuid_generate_v4(),
  company_id               uuid not null references public.companies(id) on delete cascade,
  worker_profile_id        uuid not null references public.worker_profiles(id) on delete cascade,
  worker_name              text not null,
  punch_type               public.punch_type not null,
  timestamp                timestamptz default now(),
  device_timestamp         timestamptz,
  latitude                 double precision,
  longitude                double precision,
  gps_accuracy             double precision,
  site_id                  uuid references public.sites(id) on delete set null,
  site_name                text,
  out_of_geofence          boolean default false,
  out_of_geofence_reason   public.oof_reason,
  note                     text,
  offline_captured         boolean default false,
  synced_at                timestamptz,
  created_at               timestamptz default now()
);

create index if not exists idx_punches_company    on public.punches(company_id);
create index if not exists idx_punches_worker     on public.punches(worker_profile_id);
create index if not exists idx_punches_site       on public.punches(site_id);
create index if not exists idx_punches_timestamp  on public.punches(timestamp desc);


-- 4. time_entries ------------------------------------------------------------

create table if not exists public.time_entries (
  id                  uuid primary key default uuid_generate_v4(),
  company_id          uuid not null references public.companies(id) on delete cascade,
  worker_profile_id   uuid not null references public.worker_profiles(id) on delete cascade,
  worker_name         text not null,
  date                date not null,
  clock_in            timestamptz,
  clock_out           timestamptz,
  break_minutes       int default 0,
  total_hours         numeric,
  regular_hours       numeric,
  overtime_hours      numeric default 0,
  site_id             uuid references public.sites(id) on delete set null,
  site_name           text,
  status              public.time_entry_status default 'pending',
  pay_period_id       uuid references public.pay_periods(id) on delete set null,
  has_exception       boolean default false,
  exception_notes     text,
  edit_reason         text,
  clock_in_latitude   double precision,
  clock_in_longitude  double precision,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

create index if not exists idx_time_entries_company    on public.time_entries(company_id);
create index if not exists idx_time_entries_worker     on public.time_entries(worker_profile_id);
create index if not exists idx_time_entries_date       on public.time_entries(date desc);
create index if not exists idx_time_entries_status     on public.time_entries(status);
create index if not exists idx_time_entries_pay_period on public.time_entries(pay_period_id);
create index if not exists idx_time_entries_site       on public.time_entries(site_id);


-- 5. shifts ------------------------------------------------------------------

create table if not exists public.shifts (
  id                uuid primary key default uuid_generate_v4(),
  company_id        uuid not null references public.companies(id) on delete cascade,
  worker_profile_id uuid not null references public.worker_profiles(id) on delete cascade,
  worker_name       text not null,
  site_id           uuid references public.sites(id) on delete set null,
  site_name         text,
  date              date not null,
  start_time        text not null,
  end_time          text not null,
  status            public.shift_status default 'scheduled',
  notes             text,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

create index if not exists idx_shifts_company on public.shifts(company_id);
create index if not exists idx_shifts_worker  on public.shifts(worker_profile_id);
create index if not exists idx_shifts_site    on public.shifts(site_id);
create index if not exists idx_shifts_date    on public.shifts(date);


-- 6. payroll_runs ------------------------------------------------------------

create table if not exists public.payroll_runs (
  id                    uuid primary key default uuid_generate_v4(),
  company_id            uuid not null references public.companies(id) on delete cascade,
  pay_period_id         uuid not null references public.pay_periods(id) on delete cascade,
  pay_period_label      text,
  status                public.payroll_run_status default 'draft',
  total_regular_hours   numeric default 0,
  total_overtime_hours  numeric default 0,
  worker_count          int default 0,
  submitted_at          timestamptz,
  submitted_by          uuid references public.profiles(id) on delete set null,
  worker_results        jsonb,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

create index if not exists idx_payroll_runs_company      on public.payroll_runs(company_id);
create index if not exists idx_payroll_runs_pay_period   on public.payroll_runs(pay_period_id);
create index if not exists idx_payroll_runs_status       on public.payroll_runs(status);
create index if not exists idx_payroll_runs_submitted_by on public.payroll_runs(submitted_by);


-- 7. updated_at triggers ----------------------------------------------------

drop trigger if exists pay_periods_updated_at on public.pay_periods;
create trigger pay_periods_updated_at
  before update on public.pay_periods
  for each row execute function public.touch_updated_at();

drop trigger if exists time_entries_updated_at on public.time_entries;
create trigger time_entries_updated_at
  before update on public.time_entries
  for each row execute function public.touch_updated_at();

drop trigger if exists shifts_updated_at on public.shifts;
create trigger shifts_updated_at
  before update on public.shifts
  for each row execute function public.touch_updated_at();

drop trigger if exists payroll_runs_updated_at on public.payroll_runs;
create trigger payroll_runs_updated_at
  before update on public.payroll_runs
  for each row execute function public.touch_updated_at();


-- 8. Helper: does the calling user own this worker_profile? -----------------
-- True iff worker_profiles.user_id = auth.uid(). Used in RLS so workers can
-- read/write their own punches without giving them company-wide access.

create or replace function public.user_owns_worker_profile(wp_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.worker_profiles
    where id = wp_id and user_id = auth.uid()
  );
$$;

revoke execute on function public.user_owns_worker_profile(uuid) from public;
grant  execute on function public.user_owns_worker_profile(uuid) to authenticated;


-- 9. RLS --------------------------------------------------------------------

alter table public.pay_periods   enable row level security;
alter table public.punches       enable row level security;
alter table public.time_entries  enable row level security;
alter table public.shifts        enable row level security;
alter table public.payroll_runs  enable row level security;


-- pay_periods: members read; admins (owner/payroll_admin) write.
drop policy if exists "pay_periods_read"  on public.pay_periods;
drop policy if exists "pay_periods_write" on public.pay_periods;
create policy "pay_periods_read"
  on public.pay_periods for select to authenticated
  using (public.user_can_see_company(company_id));
create policy "pay_periods_write"
  on public.pay_periods for all to authenticated
  using (public.user_is_admin_of_company(company_id))
  with check (public.user_is_admin_of_company(company_id));


-- punches:
--   * Worker reads/writes their own punches (own worker_profile)
--   * Manager+ reads/writes any punch in their company
drop policy if exists "punches_read"  on public.punches;
drop policy if exists "punches_write" on public.punches;
create policy "punches_read"
  on public.punches for select to authenticated
  using (
    public.user_can_see_company(company_id)
    and (public.user_is_manager_of_company(company_id) or public.user_owns_worker_profile(worker_profile_id))
  );
create policy "punches_write"
  on public.punches for all to authenticated
  using (
    public.user_can_see_company(company_id)
    and (public.user_is_manager_of_company(company_id) or public.user_owns_worker_profile(worker_profile_id))
  )
  with check (
    public.user_can_see_company(company_id)
    and (public.user_is_manager_of_company(company_id) or public.user_owns_worker_profile(worker_profile_id))
  );


-- time_entries:
--   * Worker reads their own (computed from their punches)
--   * Manager+ reads/writes any
drop policy if exists "time_entries_read_self"     on public.time_entries;
drop policy if exists "time_entries_read_manager"  on public.time_entries;
drop policy if exists "time_entries_write_manager" on public.time_entries;
create policy "time_entries_read_self"
  on public.time_entries for select to authenticated
  using (
    public.user_can_see_company(company_id)
    and public.user_owns_worker_profile(worker_profile_id)
  );
create policy "time_entries_read_manager"
  on public.time_entries for select to authenticated
  using (public.user_is_manager_of_company(company_id));
create policy "time_entries_write_manager"
  on public.time_entries for all to authenticated
  using (public.user_is_manager_of_company(company_id))
  with check (public.user_is_manager_of_company(company_id));


-- shifts:
--   * All members read (workers need to see their own schedule)
--   * Manager+ writes
drop policy if exists "shifts_read"  on public.shifts;
drop policy if exists "shifts_write" on public.shifts;
create policy "shifts_read"
  on public.shifts for select to authenticated
  using (public.user_can_see_company(company_id));
create policy "shifts_write"
  on public.shifts for all to authenticated
  using (public.user_is_manager_of_company(company_id))
  with check (public.user_is_manager_of_company(company_id));


-- payroll_runs: admin-only (read + write)
drop policy if exists "payroll_runs_read"  on public.payroll_runs;
drop policy if exists "payroll_runs_write" on public.payroll_runs;
create policy "payroll_runs_read"
  on public.payroll_runs for select to authenticated
  using (public.user_is_admin_of_company(company_id));
create policy "payroll_runs_write"
  on public.payroll_runs for all to authenticated
  using (public.user_is_admin_of_company(company_id))
  with check (public.user_is_admin_of_company(company_id));
