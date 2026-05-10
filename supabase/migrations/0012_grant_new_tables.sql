-- ============================================================================
-- 0012_grant_new_tables.sql
-- ============================================================================
-- Captures the GRANT ALL applied directly to the live Supabase project by
-- the earlier Hermes agent. Recorded here verbatim so repo and live DB agree
-- on migration history.
--
-- WARNING: granting ALL to anon was a mistake — it bypassed Supabase's
-- intended RLS gate. 0013 immediately revokes the anon grants and enables
-- RLS with proper policies. Always run 0011 → 0012 → 0013 in order;
-- never deploy 0011/0012 alone.
-- ============================================================================

GRANT ALL ON TABLE public.audit_logs       TO authenticated, anon, service_role;
GRANT ALL ON TABLE public.expenses         TO authenticated, anon, service_role;
GRANT ALL ON TABLE public.leave_requests   TO authenticated, anon, service_role;
GRANT ALL ON TABLE public.messages         TO authenticated, anon, service_role;
GRANT ALL ON TABLE public.tax_deductions   TO authenticated, anon, service_role;
GRANT ALL ON TABLE public.tax_forms        TO authenticated, anon, service_role;
GRANT ALL ON TABLE public.worker_documents TO authenticated, anon, service_role;
