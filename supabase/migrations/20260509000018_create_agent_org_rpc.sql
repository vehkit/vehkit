-- =====================================================================
-- create_agent_org RPC — atomic self-service onboarding.
--
-- Why this exists: the original onboarding action did two ROW-LEVEL
-- inserts (agents, then agent_members) from the user's session client.
-- The first insert chained `.select('id')`, which PostgREST runs as a
-- SELECT under RLS. The SELECT policy `members_read_own_agent` checks
-- is_agent_member(id), which is false at that moment because the
-- membership row isn't inserted yet. Result: the round-trip fails with
-- a misleading "new row violates row-level security policy" — actually
-- the SELECT-after-INSERT being denied.
--
-- This RPC encapsulates the whole onboarding transaction with
-- SECURITY DEFINER. It validates auth.uid(), inserts both rows, and
-- returns the new agent id without ever needing a user-level SELECT
-- policy on the freshly-created row.
-- =====================================================================

create or replace function public.create_agent_org(
  p_name text,
  p_category text default 'insurance',
  p_emirate text default null,
  p_phone text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_slug text;
  v_agent_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'invalid_name' using errcode = '22023';
  end if;
  if p_category not in ('insurance', 'fleet', 'leasing', 'other') then
    raise exception 'invalid_category' using errcode = '22023';
  end if;

  -- Slug: lower-case, hyphenate, append 4 random chars to dodge collisions
  v_slug := regexp_replace(lower(p_name), '[^a-z0-9]+', '-', 'g');
  v_slug := regexp_replace(v_slug, '^-+|-+$', '', 'g');
  if length(v_slug) = 0 then v_slug := 'agent'; end if;
  v_slug := substring(v_slug, 1, 40)
    || '-'
    || substring(md5(random()::text || clock_timestamp()::text), 1, 4);

  insert into public.agents (name, slug, category, emirate, phone)
  values (trim(p_name), v_slug, p_category, p_emirate, p_phone)
  returning id into v_agent_id;

  insert into public.agent_members (agent_id, user_id, role)
  values (v_agent_id, v_uid, 'owner');

  return v_agent_id;
end;
$$;

grant execute on function public.create_agent_org(text, text, text, text)
  to authenticated;

notify pgrst, 'reload schema';
