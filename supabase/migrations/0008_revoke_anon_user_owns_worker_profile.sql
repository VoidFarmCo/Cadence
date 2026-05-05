-- ============================================================================
-- Cadence: revoke EXECUTE on user_owns_worker_profile from anon
-- ============================================================================
-- Supabase's default privileges grant EXECUTE on public functions to anon
-- explicitly (not only via PUBLIC), so 0007's `revoke from public` doesn't
-- close the door by itself. Match the pattern from 0006 by also revoking
-- from anon. Verified with has_function_privilege('anon', oid, 'EXECUTE').
-- ============================================================================

revoke execute on function public.user_owns_worker_profile(uuid) from anon;
