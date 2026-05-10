-- ============================================================================
-- 0020_redeem_invite_link_lock_and_email_normalization.sql
-- ============================================================================
-- Addresses Sourcery review on PR #32:
--
-- 1. Race condition on redeem_invite_link: the `select ... where token = ...`
--    followed by `update ... set uses = uses + 1` was not atomic. Two
--    concurrent calls could both pass the max_uses check before either
--    incremented, overshooting max_uses. Fix: take a row-level lock with
--    `select ... for update` so concurrent redemptions serialize on the
--    invite_links row.
--
-- 2. invitations.email is free-form text, but every lookup compares
--    lower(email). Normalize on write via a BEFORE trigger so we can't
--    accidentally store mixed-case duplicates that bypass the unique-ish
--    semantics our queries assume.
--
-- Sourcery also suggested using citext for case-insensitive equality.
-- Declined for now: it's a column-type change with broader implications
-- (would want it consistently across profiles.email, worker_profiles.email,
-- etc.) and the BEFORE trigger covers the immediate correctness concern.
-- Tracked as a future cleanup.
-- ============================================================================


-- 1. redeem_invite_link: lock the row before checking max_uses ---------------

create or replace function public.redeem_invite_link(p_token text)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  link record;
  uid uuid;
begin
  uid := auth.uid();
  if uid is null then raise exception 'must be authenticated'; end if;

  -- FOR UPDATE serializes concurrent redemptions on this invite_links row.
  -- Without this, two parallel calls could both observe uses < max_uses and
  -- both increment, overshooting max_uses by 1+.
  select * into link from public.invite_links
   where token = p_token
   for update;

  if link.id is null then raise exception 'Invalid invite link'; end if;
  if link.revoked then raise exception 'This invite link has been revoked'; end if;
  if link.expires_at is not null and link.expires_at < now() then
    raise exception 'This invite link has expired';
  end if;
  if link.max_uses is not null and link.uses >= link.max_uses then
    raise exception 'This invite link has been used up';
  end if;

  insert into public.company_members (company_id, user_id, role, status)
    values (link.company_id, uid, coalesce(link.role, 'worker'::public.user_role), 'active')
    on conflict (company_id, user_id) do nothing;

  update public.invite_links set uses = uses + 1 where id = link.id;

  return link.company_id;
end $$;

revoke execute on function public.redeem_invite_link(text) from public;
revoke execute on function public.redeem_invite_link(text) from anon;
grant  execute on function public.redeem_invite_link(text) to authenticated;


-- 2. Normalize invitations.email on insert/update ---------------------------

create or replace function public.lowercase_invitation_email()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.email is not null then
    new.email := lower(btrim(new.email));
  end if;
  return new;
end;
$$;

-- Trigger functions don't need EXECUTE on them for callers (they're invoked
-- by the trigger system), but revoke from all roles for hygiene.
revoke execute on function public.lowercase_invitation_email() from public;
revoke execute on function public.lowercase_invitation_email() from anon;
revoke execute on function public.lowercase_invitation_email() from authenticated;

drop trigger if exists invitations_lowercase_email on public.invitations;
create trigger invitations_lowercase_email
  before insert or update on public.invitations
  for each row
  execute function public.lowercase_invitation_email();

-- Backfill any existing rows (defensive — there shouldn't be any yet).
update public.invitations set email = lower(btrim(email))
 where email is not null and email <> lower(btrim(email));
