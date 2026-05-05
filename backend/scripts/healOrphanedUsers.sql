-- One-shot cleanup: delete User rows that were left behind by the
-- pre-fix workerProfile delete behavior (which only set status='inactive'
-- and kept the row, blocking re-invites with the same email).
--
-- Safe — only removes Users that:
--   (a) have no WorkerProfile (so they're not a member of any company)
--   (b) never set a real password (password_hash empty/null)
-- These are abandoned never-redeemed invitees with no audit relevance.
--
-- Usage:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/scripts/healOrphanedUsers.sql

DELETE FROM users u
 WHERE (u.password_hash IS NULL OR u.password_hash = '')
   AND NOT EXISTS (
     SELECT 1 FROM worker_profiles wp WHERE wp.user_email = u.email
   );

-- Sanity check (informational):
-- SELECT count(*) AS still_orphaned FROM users u
--  WHERE (u.password_hash IS NULL OR u.password_hash = '')
--    AND NOT EXISTS (SELECT 1 FROM worker_profiles wp WHERE wp.user_email = u.email);
