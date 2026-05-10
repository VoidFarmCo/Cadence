-- Pin search_path on try_uuid (advisor warn 0011_function_search_path_mutable)
-- and re-revoke from public/anon (defense in depth, idempotent).
create or replace function public.try_uuid(t text)
returns uuid
language plpgsql immutable
set search_path = public
as $$
begin
  return t::uuid;
exception when others then
  return null;
end;
$$;

revoke execute on function public.try_uuid(text) from public;
revoke execute on function public.try_uuid(text) from anon;
grant  execute on function public.try_uuid(text) to authenticated;
