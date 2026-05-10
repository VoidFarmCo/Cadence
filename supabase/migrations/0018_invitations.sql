-- ============================================================================
-- 0018_invitations.sql
-- ============================================================================
-- Admin-driven invitations: an owner/payroll_admin of a company creates an
-- invitation by email, with a chosen user_role. When the invited user signs
-- up (or already exists), they're added to company_members with that role.
--
-- Adapted from WorkHub's 0003_invitations.sql:
--   * Company-scoped (company_id is NOT NULL) — Cadence is company-first.
--   * Uses public.user_role enum instead of a free-form `role` text + a
--     separate `permissions` enum.
--   * Drops `space_ids` — Cadence has no spaces.
--   * Extends Cadence's existing handle_new_user (worker_profile linker) to
--     also consume pending invitations on signup.
-- ============================================================================


-- 1. Table -------------------------------------------------------------------

create table if not exists public.invitations (
  id          uuid primary key default uuid_generate_v4(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  email       text not null,
  role        public.user_role default 'worker',
  invited_by  uuid references public.profiles(id) on delete set null,
  status      text default 'pending' check (status in ('pending','accepted','revoked')),
  accepted_at timestamptz,
  created_at  timestamptz default now()
);

create index if not exists idx_invitations_company on public.invitations(company_id);
create index if not exists idx_invitations_email   on public.invitations(lower(email));
create index if not exists idx_invitations_status  on public.invitations(status);
create index if not exists idx_invitations_invited_by on public.invitations(invited_by);


-- 2. RLS ---------------------------------------------------------------------

alter table public.invitations enable row level security;

drop policy if exists "invitations_admin_all" on public.invitations;
drop policy if exists "invitations_self_read" on public.invitations;

create policy "invitations_admin_all"
  on public.invitations for all to authenticated
  using (public.user_is_admin_of_company(company_id))
  with check (public.user_is_admin_of_company(company_id));

-- A user can read invitations addressed to their own email (so a frontend
-- can show "you have a pending invite" before the trigger consumes it).
create policy "invitations_self_read"
  on public.invitations for select to authenticated
  using (lower(email) = lower(public.current_user_email()));


-- 3. Extend handle_new_user to consume pending invitations ------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  wp record;
  inv record;
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

  -- 3a. Existing behavior: link pre-created worker_profiles by email.
  --     These give the user their "default" role for the company.
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

  -- 3b. New: consume pending invitations addressed to this email.
  --     Run after worker_profiles so an invite can promote a worker to a
  --     higher role (manager/payroll_admin/owner) by overwriting via the
  --     ON CONFLICT update.
  for inv in
    select * from public.invitations
     where lower(email) = lower(new.email)
       and status = 'pending'
  loop
    insert into public.company_members (company_id, user_id, role, status)
      values (inv.company_id, new.id, inv.role, 'active')
      on conflict (company_id, user_id) do update
        set role   = excluded.role,
            status = excluded.status;

    update public.invitations
       set status = 'accepted', accepted_at = now()
     where id = inv.id;
  end loop;

  return new;
end $$;


-- 4. apply_invitation_for(email) — retroactive RPC ---------------------------
-- Useful when the invited user signed up BEFORE the invite was created.
-- Only company admins can apply invitations for their company.

create or replace function public.apply_invitation_for(target_email text)
returns int
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  applied int := 0;
  uid uuid;
  inv record;
begin
  if auth.uid() is null then
    raise exception 'must be authenticated';
  end if;

  select id into uid
    from public.profiles
   where lower(email) = lower(target_email)
   limit 1;
  if uid is null then return 0; end if;

  for inv in
    select * from public.invitations
     where lower(email) = lower(target_email)
       and status = 'pending'
  loop
    if not public.user_is_admin_of_company(inv.company_id) then
      continue;
    end if;

    insert into public.company_members (company_id, user_id, role, status)
      values (inv.company_id, uid, inv.role, 'active')
      on conflict (company_id, user_id) do update
        set role   = excluded.role,
            status = excluded.status;

    update public.invitations
       set status = 'accepted', accepted_at = now()
     where id = inv.id;

    applied := applied + 1;
  end loop;

  return applied;
end $$;

revoke execute on function public.apply_invitation_for(text) from public;
revoke execute on function public.apply_invitation_for(text) from anon;
grant  execute on function public.apply_invitation_for(text) to authenticated;
