-- ============================================================================
-- 0016_consolidate_worker_row_policies.sql
-- ============================================================================
-- Addresses Sourcery review on PR #29: 0013 declared the same 4-policy
-- "worker-row" pattern verbatim on 5 tables (expenses, leave_requests,
-- tax_deductions, tax_forms, worker_documents). The actual checks already
-- used shared helpers, but the policy declarations themselves were duplicated.
--
-- This migration introduces a single helper `can_access_worker_row(email, company)`
-- that combines the two checks, then replaces the 4 policies per table with
-- one `for all to authenticated` policy. Behavior is unchanged — workers can
-- still read/write their own rows, manager+ can still read/write any row in
-- their company. Net effect: 20 policies → 5 policies.
--
-- audit_logs (admin-only) and messages (recipient variant) are left as-is
-- because they don't fit the same pattern.
-- ============================================================================


-- 1. Helper -----------------------------------------------------------------

create or replace function public.can_access_worker_row(
  worker_email_val text,
  company_id_val   text
)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select worker_email_val = public.current_user_email()
      or public.user_is_manager_of_company(public.try_uuid(company_id_val));
$$;

revoke execute on function public.can_access_worker_row(text, text) from public;
revoke execute on function public.can_access_worker_row(text, text) from anon;
grant  execute on function public.can_access_worker_row(text, text) to authenticated;


-- 2. Consolidate policies on the 5 worker-row tables ------------------------

-- expenses
drop policy if exists "expenses_read_self"     on public.expenses;
drop policy if exists "expenses_read_manager"  on public.expenses;
drop policy if exists "expenses_write_self"    on public.expenses;
drop policy if exists "expenses_write_manager" on public.expenses;
drop policy if exists "expenses_self_or_manager" on public.expenses;
create policy "expenses_self_or_manager"
  on public.expenses for all to authenticated
  using (public.can_access_worker_row(worker_email, company_id))
  with check (public.can_access_worker_row(worker_email, company_id));

-- leave_requests
drop policy if exists "leave_requests_read_self"     on public.leave_requests;
drop policy if exists "leave_requests_read_manager"  on public.leave_requests;
drop policy if exists "leave_requests_write_self"    on public.leave_requests;
drop policy if exists "leave_requests_write_manager" on public.leave_requests;
drop policy if exists "leave_requests_self_or_manager" on public.leave_requests;
create policy "leave_requests_self_or_manager"
  on public.leave_requests for all to authenticated
  using (public.can_access_worker_row(worker_email, company_id))
  with check (public.can_access_worker_row(worker_email, company_id));

-- tax_deductions
drop policy if exists "tax_deductions_read_self"     on public.tax_deductions;
drop policy if exists "tax_deductions_read_manager"  on public.tax_deductions;
drop policy if exists "tax_deductions_write_self"    on public.tax_deductions;
drop policy if exists "tax_deductions_write_manager" on public.tax_deductions;
drop policy if exists "tax_deductions_self_or_manager" on public.tax_deductions;
create policy "tax_deductions_self_or_manager"
  on public.tax_deductions for all to authenticated
  using (public.can_access_worker_row(worker_email, company_id))
  with check (public.can_access_worker_row(worker_email, company_id));

-- tax_forms
drop policy if exists "tax_forms_read_self"     on public.tax_forms;
drop policy if exists "tax_forms_read_manager"  on public.tax_forms;
drop policy if exists "tax_forms_write_self"    on public.tax_forms;
drop policy if exists "tax_forms_write_manager" on public.tax_forms;
drop policy if exists "tax_forms_self_or_manager" on public.tax_forms;
create policy "tax_forms_self_or_manager"
  on public.tax_forms for all to authenticated
  using (public.can_access_worker_row(worker_email, company_id))
  with check (public.can_access_worker_row(worker_email, company_id));

-- worker_documents
drop policy if exists "worker_documents_read_self"     on public.worker_documents;
drop policy if exists "worker_documents_read_manager"  on public.worker_documents;
drop policy if exists "worker_documents_write_self"    on public.worker_documents;
drop policy if exists "worker_documents_write_manager" on public.worker_documents;
drop policy if exists "worker_documents_self_or_manager" on public.worker_documents;
create policy "worker_documents_self_or_manager"
  on public.worker_documents for all to authenticated
  using (public.can_access_worker_row(worker_email, company_id))
  with check (public.can_access_worker_row(worker_email, company_id));
