-- ============================================================================
-- 0019_invite_links.sql
-- ============================================================================
-- Shareable invite-link flow: admins generate a token-based URL, anyone who
-- visits it (after sign-in) auto-joins the company with the link's pre-set
-- role. Adapted from WorkHub's 0005_invite_links.sql + 0013 (stale-space
-- hardening — not needed here since Cadence has no spaces).
--
-- Differences from WorkHub:
--   * Uses public.user_role enum instead of free-form text + permissions.
--   * Drops space_ids (Cadence has no spaces).
--   * All SECURITY DEFINER functions use search_path = pg_catalog, public
--     (matching the 0017 hardening).
-- ============================================================================


-- 1. Table -------------------------------------------------------------------

create table if not exists public.invite_links (
  id           uuid primary key default uuid_generate_v4(),
  token        text not null unique,
  company_id   uuid not null references public.companies(id) on delete cascade,
  role         public.user_role default 'worker',
  max_uses     int,                              -- null = unlimited
  uses         int default 0,
  expires_at   timestamptz,                      -- null = never
  revoked      boolean default false,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz default now()
);

create index if not exists idx_invite_links_company    on public.invite_links(company_id);
create index if not exists idx_invite_links_token      on public.invite_links(token);
create index if not exists idx_invite_links_created_by on public.invite_links(created_by);


-- 2. RLS ---------------------------------------------------------------------

alter table public.invite_links enable row level security;

drop policy if exists "invite_links_admin" on public.invite_links;
create policy "invite_links_admin"
  on public.invite_links for all to authenticated
  using (public.user_is_admin_of_company(company_id))
  with check (public.user_is_admin_of_company(company_id));


-- 3. Functions ---------------------------------------------------------------

-- 32-char hex token (~128 bits of entropy from gen_random_uuid, which is
-- in pg_catalog on Postgres 13+ so no extension dependency).
create or replace function public.gen_invite_token()
returns text
language sql
set search_path = pg_catalog, public
as $$
  select replace(gen_random_uuid()::text, '-', '');
$$;

revoke execute on function public.gen_invite_token() from public;
revoke execute on function public.gen_invite_token() from anon;
grant  execute on function public.gen_invite_token() to authenticated;


-- peek_invite_link: read-only preview, callable by anon so the join page
-- can show the company name before sign-in completes. Intentionally returns
-- only non-sensitive fields. SECURITY DEFINER so it bypasses RLS on
-- invite_links + companies for this single read.
create or replace function public.peek_invite_link(p_token text)
returns table (
  token        text,
  company_id   uuid,
  company_name text,
  role         public.user_role,
  uses         int,
  max_uses     int,
  expires_at   timestamptz,
  revoked      boolean
)
language sql
security definer
set search_path = pg_catalog, public
as $$
  select il.token, il.company_id, c.name, il.role,
         il.uses, il.max_uses, il.expires_at, il.revoked
  from public.invite_links il
  join public.companies c on c.id = il.company_id
  where il.token = p_token
  limit 1;
$$;

grant execute on function public.peek_invite_link(text) to anon, authenticated;


-- redeem_invite_link: caller becomes a member of the link's company.
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

  select * into link from public.invite_links where token = p_token;
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


-- create_invite_link: convenience RPC. Admins could INSERT directly thanks to
-- RLS, but exposing an RPC keeps token generation server-side.
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
