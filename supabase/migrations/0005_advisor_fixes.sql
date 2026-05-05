-- ============================================================================
-- Cadence: advisor fixes for 0001 + 0004
-- ============================================================================
-- Addresses the WARN-level lints from `get_advisors` after the foundation
-- migrations: function search_path, over-broad EXECUTE grants on SECURITY
-- DEFINER functions, missing FK indexes, and per-row auth.uid() re-evaluation
-- in RLS policies.
-- ============================================================================


-- 1. touch_updated_at: pin search_path -------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end $$;


-- 2. handle_new_user is a trigger function only --------------------------------
-- It runs as supabase_auth_admin via the on_auth_user_created trigger; nobody
-- should be able to call it as an RPC. Lock it down.
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.handle_new_user() from anon;
revoke execute on function public.handle_new_user() from authenticated;


-- 3. RLS helper functions: revoke execute from anon ------------------------
-- Authenticated keeps EXECUTE because RLS policies invoke these. Anon doesn't
-- need them (and would only ever get `false` back), so revoke for hygiene.
-- (0006 follow-up tightens this further by also revoking from PUBLIC.)
revoke execute on function public.user_can_see_company(uuid)       from anon;
revoke execute on function public.user_is_owner_of_company(uuid)   from anon;
revoke execute on function public.user_is_admin_of_company(uuid)   from anon;
revoke execute on function public.user_is_manager_of_company(uuid) from anon;


-- 4. create_company: authenticated only ------------------------------------
revoke execute on function public.create_company(text, text) from anon;


-- 5. Missing FK indexes ----------------------------------------------------
create index if not exists idx_accounts_owner               on public.accounts(owner_id);
create index if not exists idx_worker_profiles_default_site on public.worker_profiles(default_site_id);


-- 6. Wrap auth.uid() in subselects to avoid per-row re-evaluation ----------
-- See https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()));

drop policy if exists "companies_insert" on public.companies;
create policy "companies_insert"
  on public.companies for insert to authenticated
  with check ((select auth.uid()) is not null);

drop policy if exists "company_members_read" on public.company_members;
create policy "company_members_read"
  on public.company_members for select to authenticated
  using (user_id = (select auth.uid()) or public.user_can_see_company(company_id));

drop policy if exists "company_members_self" on public.company_members;
create policy "company_members_self"
  on public.company_members for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "worker_profiles_read_self" on public.worker_profiles;
create policy "worker_profiles_read_self"
  on public.worker_profiles for select to authenticated
  using (user_id = (select auth.uid()));
