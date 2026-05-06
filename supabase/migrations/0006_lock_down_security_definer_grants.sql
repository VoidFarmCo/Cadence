-- ============================================================================
-- Cadence: lock down EXECUTE grants on foundation SECURITY DEFINER functions
-- ============================================================================
-- 0005 revoked EXECUTE from `anon` directly, but PostgreSQL grants EXECUTE to
-- PUBLIC on functions by default and `anon` inherits through PUBLIC. To truly
-- cut anon off we have to revoke from PUBLIC and re-grant to authenticated.
--
-- The `authenticated_security_definer_function_executable` lints that remain
-- after this are intentional:
--   * create_company — signed-in users invoke it to create their company.
--   * user_can_see_company / user_is_*_of_company — RLS policies invoke them;
--     direct calls only ever return true/false for the caller's own
--     membership, no info leak.
-- ============================================================================

-- create_company: signed-in users only.
revoke execute on function public.create_company(text, text) from public;
grant  execute on function public.create_company(text, text) to authenticated;

-- RLS helper functions: signed-in users + RLS evaluation only.
revoke execute on function public.user_can_see_company(uuid)       from public;
revoke execute on function public.user_is_owner_of_company(uuid)   from public;
revoke execute on function public.user_is_admin_of_company(uuid)   from public;
revoke execute on function public.user_is_manager_of_company(uuid) from public;
grant  execute on function public.user_can_see_company(uuid)       to authenticated;
grant  execute on function public.user_is_owner_of_company(uuid)   to authenticated;
grant  execute on function public.user_is_admin_of_company(uuid)   to authenticated;
grant  execute on function public.user_is_manager_of_company(uuid) to authenticated;
