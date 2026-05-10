-- ============================================================================
-- 0013_enable_rls_on_hermes_tables.sql
-- ============================================================================
-- CRITICAL SECURITY FIX. Tables created by 0011_missing_tables and granted
-- to anon by 0012_grant_new_tables had RLS disabled, so every row was
-- readable / writable by anyone holding the anon key. This migration:
--
--   1. Revokes anon's direct grants on those 7 tables (anon never needs
--      them; legitimate access is always via authenticated).
--   2. Enables RLS on each.
--   3. Adds policies modelled on the foundation pattern in 0004 / 0007:
--      - Workers can read/write rows where worker_email matches their own.
--      - Manager+ in the company can read/write any row.
--      - audit_logs is admin-read-only (system writes only — no user policy).
--      - messages also lets recipients read.
--
-- Helpers added:
--   * current_user_email() — caller's profiles.email; null for anon.
--     Backed by SECURITY DEFINER so RLS doesn't recurse into profiles.
--   * try_uuid(text) — defensive cast. Returns null if `company_id` (text in
--     Hermes's tables) isn't a valid UUID. Without this, malformed IDs from
--     the legacy backend would raise an exception inside an RLS policy.
-- ============================================================================


-- 1. Helpers ----------------------------------------------------------------

create or replace function public.current_user_email()
returns text
language sql stable security definer
set search_path = public
as $$
  select email from public.profiles where id = auth.uid();
$$;

revoke execute on function public.current_user_email() from public;
revoke execute on function public.current_user_email() from anon;
grant  execute on function public.current_user_email() to authenticated;

create or replace function public.try_uuid(t text)
returns uuid
language plpgsql immutable
as $$
begin
  return t::uuid;
exception when others then
  return null;
end;
$$;

revoke execute on function public.try_uuid(text) from public;
revoke execute on function public.try_uuid(text) from anon;
grant  execute on function public.try_uuid(text) to authenticated;


-- 2. Revoke anon grants from 0012 -------------------------------------------

revoke all on table public.audit_logs       from anon;
revoke all on table public.expenses         from anon;
revoke all on table public.leave_requests   from anon;
revoke all on table public.messages         from anon;
revoke all on table public.tax_deductions   from anon;
revoke all on table public.tax_forms        from anon;
revoke all on table public.worker_documents from anon;


-- 3. Enable RLS -------------------------------------------------------------

alter table public.audit_logs       enable row level security;
alter table public.expenses         enable row level security;
alter table public.leave_requests   enable row level security;
alter table public.messages         enable row level security;
alter table public.tax_deductions   enable row level security;
alter table public.tax_forms        enable row level security;
alter table public.worker_documents enable row level security;


-- 4. Policies ---------------------------------------------------------------

-- audit_logs: admin-only read. No user-write policy — these rows should be
-- inserted by service_role / SECURITY DEFINER triggers, not by the client.
drop policy if exists "audit_logs_read_admin" on public.audit_logs;
create policy "audit_logs_read_admin"
  on public.audit_logs for select to authenticated
  using (public.user_is_admin_of_company(public.try_uuid(company_id)));


-- expenses
drop policy if exists "expenses_read_self"     on public.expenses;
drop policy if exists "expenses_read_manager"  on public.expenses;
drop policy if exists "expenses_write_self"    on public.expenses;
drop policy if exists "expenses_write_manager" on public.expenses;
create policy "expenses_read_self"
  on public.expenses for select to authenticated
  using (worker_email = public.current_user_email());
create policy "expenses_read_manager"
  on public.expenses for select to authenticated
  using (public.user_is_manager_of_company(public.try_uuid(company_id)));
create policy "expenses_write_self"
  on public.expenses for all to authenticated
  using (worker_email = public.current_user_email())
  with check (worker_email = public.current_user_email());
create policy "expenses_write_manager"
  on public.expenses for all to authenticated
  using (public.user_is_manager_of_company(public.try_uuid(company_id)))
  with check (public.user_is_manager_of_company(public.try_uuid(company_id)));


-- leave_requests
drop policy if exists "leave_requests_read_self"     on public.leave_requests;
drop policy if exists "leave_requests_read_manager"  on public.leave_requests;
drop policy if exists "leave_requests_write_self"    on public.leave_requests;
drop policy if exists "leave_requests_write_manager" on public.leave_requests;
create policy "leave_requests_read_self"
  on public.leave_requests for select to authenticated
  using (worker_email = public.current_user_email());
create policy "leave_requests_read_manager"
  on public.leave_requests for select to authenticated
  using (public.user_is_manager_of_company(public.try_uuid(company_id)));
create policy "leave_requests_write_self"
  on public.leave_requests for all to authenticated
  using (worker_email = public.current_user_email())
  with check (worker_email = public.current_user_email());
create policy "leave_requests_write_manager"
  on public.leave_requests for all to authenticated
  using (public.user_is_manager_of_company(public.try_uuid(company_id)))
  with check (public.user_is_manager_of_company(public.try_uuid(company_id)));


-- messages: sender + recipient + manager+ can read; sender + manager+ can write.
drop policy if exists "messages_read_sender"    on public.messages;
drop policy if exists "messages_read_recipient" on public.messages;
drop policy if exists "messages_read_manager"   on public.messages;
drop policy if exists "messages_write_sender"   on public.messages;
drop policy if exists "messages_write_manager"  on public.messages;
create policy "messages_read_sender"
  on public.messages for select to authenticated
  using (sender_email = public.current_user_email());
create policy "messages_read_recipient"
  on public.messages for select to authenticated
  using (public.current_user_email() = ANY(recipient_emails));
create policy "messages_read_manager"
  on public.messages for select to authenticated
  using (public.user_is_manager_of_company(public.try_uuid(company_id)));
create policy "messages_write_sender"
  on public.messages for all to authenticated
  using (sender_email = public.current_user_email())
  with check (sender_email = public.current_user_email());
create policy "messages_write_manager"
  on public.messages for all to authenticated
  using (public.user_is_manager_of_company(public.try_uuid(company_id)))
  with check (public.user_is_manager_of_company(public.try_uuid(company_id)));


-- tax_deductions
drop policy if exists "tax_deductions_read_self"     on public.tax_deductions;
drop policy if exists "tax_deductions_read_manager"  on public.tax_deductions;
drop policy if exists "tax_deductions_write_self"    on public.tax_deductions;
drop policy if exists "tax_deductions_write_manager" on public.tax_deductions;
create policy "tax_deductions_read_self"
  on public.tax_deductions for select to authenticated
  using (worker_email = public.current_user_email());
create policy "tax_deductions_read_manager"
  on public.tax_deductions for select to authenticated
  using (public.user_is_manager_of_company(public.try_uuid(company_id)));
create policy "tax_deductions_write_self"
  on public.tax_deductions for all to authenticated
  using (worker_email = public.current_user_email())
  with check (worker_email = public.current_user_email());
create policy "tax_deductions_write_manager"
  on public.tax_deductions for all to authenticated
  using (public.user_is_manager_of_company(public.try_uuid(company_id)))
  with check (public.user_is_manager_of_company(public.try_uuid(company_id)));


-- tax_forms
drop policy if exists "tax_forms_read_self"     on public.tax_forms;
drop policy if exists "tax_forms_read_manager"  on public.tax_forms;
drop policy if exists "tax_forms_write_self"    on public.tax_forms;
drop policy if exists "tax_forms_write_manager" on public.tax_forms;
create policy "tax_forms_read_self"
  on public.tax_forms for select to authenticated
  using (worker_email = public.current_user_email());
create policy "tax_forms_read_manager"
  on public.tax_forms for select to authenticated
  using (public.user_is_manager_of_company(public.try_uuid(company_id)));
create policy "tax_forms_write_self"
  on public.tax_forms for all to authenticated
  using (worker_email = public.current_user_email())
  with check (worker_email = public.current_user_email());
create policy "tax_forms_write_manager"
  on public.tax_forms for all to authenticated
  using (public.user_is_manager_of_company(public.try_uuid(company_id)))
  with check (public.user_is_manager_of_company(public.try_uuid(company_id)));


-- worker_documents
drop policy if exists "worker_documents_read_self"     on public.worker_documents;
drop policy if exists "worker_documents_read_manager"  on public.worker_documents;
drop policy if exists "worker_documents_write_self"    on public.worker_documents;
drop policy if exists "worker_documents_write_manager" on public.worker_documents;
create policy "worker_documents_read_self"
  on public.worker_documents for select to authenticated
  using (worker_email = public.current_user_email());
create policy "worker_documents_read_manager"
  on public.worker_documents for select to authenticated
  using (public.user_is_manager_of_company(public.try_uuid(company_id)));
create policy "worker_documents_write_self"
  on public.worker_documents for all to authenticated
  using (worker_email = public.current_user_email())
  with check (worker_email = public.current_user_email());
create policy "worker_documents_write_manager"
  on public.worker_documents for all to authenticated
  using (public.user_is_manager_of_company(public.try_uuid(company_id)))
  with check (public.user_is_manager_of_company(public.try_uuid(company_id)));
