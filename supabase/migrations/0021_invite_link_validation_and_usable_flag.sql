-- ============================================================================
-- 0021_invite_link_validation_and_usable_flag.sql
-- ============================================================================
-- Addresses the two remaining Sourcery review comments on PR #32:
--
-- 1. create_invite_link accepted any integer for p_max_uses, including 0 and
--    negatives. 0 would make an invite immediately unredeemable (since
--    redeem checks `uses >= max_uses` with uses=0). Negative is even more
--    nonsensical. Reject up-front with a clear error.
--
-- 2. peek_invite_link returned the full row even for revoked / expired /
--    used-up invites, so the join page would show a fresh invite that then
--    failed at redeem time. Add an is_usable boolean column so the client
--    can render the company name + a clear "this invite is no longer valid"
--    message in one shot. Keep returning the row (so the company name is
--    available regardless) instead of filtering, which would be a behavioral
--    regression for clients that only want to display the metadata.
-- ============================================================================


-- 1. create_invite_link: reject p_max_uses <= 0 -----------------------------

create or replace function public.create_invite_link(
  p_company_id uuid,
  p_role       public.user_role default 'worker',
  p_max_uses   int default null,
  p_expires_at timestamptz default null
)
returns table (
  id          uuid,
  token       text,
  company_id  uuid,
  role        public.user_role,
  max_uses    int,
  uses        int,
  expires_at  timestamptz,
  revoked     boolean,
  created_by  uuid,
  created_at  timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  uid uuid;
begin
  uid := auth.uid();
  if uid is null then raise exception 'must be authenticated'; end if;
  if not public.user_is_admin_of_company(p_company_id) then
    raise exception 'only company admins can create invite links';
  end if;

  -- A max_uses of 0 would make the link immediately unredeemable; negative
  -- is nonsensical. Pass null to mean unlimited.
  if p_max_uses is not null and p_max_uses <= 0 then
    raise exception 'p_max_uses must be positive (or null for unlimited), got %', p_max_uses;
  end if;

  return query
  insert into public.invite_links (token, company_id, role, max_uses, expires_at, created_by)
  values (
    public.gen_invite_token(),
    p_company_id,
    coalesce(p_role, 'worker'::public.user_role),
    p_max_uses,
    p_expires_at,
    uid
  )
  returning invite_links.id, invite_links.token, invite_links.company_id,
            invite_links.role, invite_links.max_uses, invite_links.uses,
            invite_links.expires_at, invite_links.revoked,
            invite_links.created_by, invite_links.created_at;
end $$;

revoke execute on function public.create_invite_link(uuid, public.user_role, int, timestamptz) from public;
revoke execute on function public.create_invite_link(uuid, public.user_role, int, timestamptz) from anon;
grant  execute on function public.create_invite_link(uuid, public.user_role, int, timestamptz) to authenticated;


-- 2. peek_invite_link: add is_usable flag ----------------------------------
-- Postgres won't change the return type of an existing function via
-- CREATE OR REPLACE, so drop and recreate.

drop function if exists public.peek_invite_link(text);

create function public.peek_invite_link(p_token text)
returns table (
  token        text,
  company_id   uuid,
  company_name text,
  role         public.user_role,
  uses         int,
  max_uses     int,
  expires_at   timestamptz,
  revoked      boolean,
  is_usable    boolean
)
language sql
security definer
set search_path = pg_catalog, public
as $$
  select il.token, il.company_id, c.name, il.role,
         il.uses, il.max_uses, il.expires_at, il.revoked,
         (
           not il.revoked
           and (il.expires_at is null or il.expires_at >= now())
           and (il.max_uses is null or il.uses < il.max_uses)
         ) as is_usable
  from public.invite_links il
  join public.companies c on c.id = il.company_id
  where il.token = p_token
  limit 1;
$$;

grant execute on function public.peek_invite_link(text) to anon, authenticated;
