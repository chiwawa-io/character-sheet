-- Run once in the Supabase SQL editor. The table is invisible to the public API;
-- the only way in is through two functions that require the long secret sync code.
-- The code itself is never stored, only its SHA-256.

create table if not exists public.sheets (
  id         text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.sheets enable row level security;
revoke all on public.sheets from anon, authenticated;

create or replace function public.get_sheet(p_key text) returns jsonb
language sql security definer set search_path = public as $$
  select data from public.sheets
  where id = encode(sha256(convert_to(p_key, 'utf8')), 'hex')
    and length(p_key) >= 32;
$$;

create or replace function public.put_sheet(p_key text, p_data jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if length(p_key) < 32 then raise exception 'sync code too short'; end if;
  if pg_column_size(p_data) > 2000000 then raise exception 'data too large'; end if;
  insert into public.sheets (id, data, updated_at)
  values (encode(sha256(convert_to(p_key, 'utf8')), 'hex'), p_data, now())
  on conflict (id) do update set data = excluded.data, updated_at = now();
end;
$$;

revoke all on function public.get_sheet(text), public.put_sheet(text, jsonb) from public;
grant execute on function public.get_sheet(text), public.put_sheet(text, jsonb) to anon;
