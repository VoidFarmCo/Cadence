-- ============================================================================
-- 0017_tighten_security_definer_search_path.sql
-- ============================================================================
-- Sourcery review on PR #30 flagged that SECURITY DEFINER functions should
-- resolve built-ins via pg_catalog first to prevent shadow-name attacks
-- (someone with CREATE permission on public defining a function/operator
-- that overrides a built-in, then waiting for our SECURITY DEFINER function
-- to invoke it).
--
-- Sourcery only called this out on can_access_worker_row, but the same
-- argument applies to every SECURITY DEFINER function we own. Fixing all
-- of them here keeps the codebase consistent.
--
-- Uses ALTER FUNCTION ... SET to change only the search_path attribute,
-- leaving each function's body unchanged.
-- ============================================================================

alter function public.current_user_email()              set search_path = pg_catalog, public;
alter function public.user_can_see_company(uuid)        set search_path = pg_catalog, public;
alter function public.user_is_owner_of_company(uuid)    set search_path = pg_catalog, public;
alter function public.user_is_admin_of_company(uuid)    set search_path = pg_catalog, public;
alter function public.user_is_manager_of_company(uuid)  set search_path = pg_catalog, public;
alter function public.user_owns_worker_profile(uuid)    set search_path = pg_catalog, public;
alter function public.can_access_worker_row(text, text) set search_path = pg_catalog, public;
alter function public.create_company(text, text)        set search_path = pg_catalog, public;
alter function public.handle_new_user()                 set search_path = pg_catalog, public;

-- try_uuid is IMMUTABLE not SECURITY DEFINER but pin it anyway for consistency.
alter function public.try_uuid(text) set search_path = pg_catalog, public;
