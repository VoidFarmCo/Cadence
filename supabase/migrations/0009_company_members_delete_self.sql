-- Lets a non-owner member remove themselves from a company.
--
-- The existing company_members_admin policy (`for all to authenticated`)
-- requires user_is_admin_of_company, which excludes plain workers and
-- managers, so without this policy a worker calling
-- `delete from company_members where user_id = auth.uid()` would silently
-- affect 0 rows. Adding an explicit DELETE policy gives them a way out.
--
-- Owners are intentionally excluded: deleting your own owner row would orphan
-- the company. A future ownership-transfer flow will need its own RPC.
drop policy if exists "company_members_delete_self" on public.company_members;
create policy "company_members_delete_self"
  on public.company_members for delete to authenticated
  using (
    user_id = (select auth.uid())
    and role <> 'owner'
  );
