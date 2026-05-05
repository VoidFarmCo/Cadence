-- Supabase default grants give EXECUTE to `anon` explicitly (not only via
-- PUBLIC), so 0007's `revoke from public` doesn't lock anon out by itself.
-- Same pattern as 0006: also revoke from anon directly. Confirmed via
-- has_function_privilege() before applying.
revoke execute on function public.user_owns_worker_profile(uuid) from anon;
