-- One-shot data heal: re-link Account rows whose company_id was nulled
-- by start.sh's cleanup loop. The loop still runs but no longer
-- includes the accounts table; this script heals rows that were
-- already nulled before that change landed.
--
-- Usage:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/scripts/healAccounts.sql
--
-- Safe to re-run: only updates rows where Account.company_id IS NULL
-- and a matching WorkerProfile.company_id exists.

UPDATE accounts a
   SET company_id = wp.company_id
  FROM worker_profiles wp
 WHERE a.owner_email = wp.user_email
   AND a.company_id IS NULL
   AND wp.company_id IS NOT NULL;

-- Sanity check (informational; comment out if running non-interactively):
-- SELECT count(*) AS still_orphaned FROM accounts WHERE company_id IS NULL;
