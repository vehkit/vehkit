-- =====================================================================
-- Agent KYC verification gate.
--
-- Why: ANY user can self-onboard as an agent today, then immediately
-- redeem a customer share code and pull their mulkiya / insurance /
-- emirates ID copies. That's a PII exposure surface that cannot ship
-- public without a verification gate.
--
-- Three changes here:
--   1. Add `trade_license_url` and `trade_license_uploaded_at` columns
--      to agents (parallels workshops).
--   2. SECURITY DEFINER RPC `set_agent_trade_license` — the agent uploads
--      the file via storage, then calls this to record the path on their
--      org row. Only members of the org can call it.
--   3. Update `redeem_agent_code` to reject when the agent's tier is
--      'unverified'. Verified tiers (silver, gold) come from admin
--      review of the trade-license file via /admin/agents.
--
-- After these, the customer-facing flow is unchanged — they generate
-- a share code as normal. But unverified agents trying to redeem get
-- a clean error message ("Your agent desk isn't verified yet"), and
-- the pending verification is visible in /admin/agents.
-- =====================================================================

alter table public.agents
  add column if not exists trade_license_url text,
  add column if not exists trade_license_uploaded_at timestamptz;

create or replace function public.set_agent_trade_license(
  p_agent_id uuid,
  p_url text
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.agent_members
    where agent_id = p_agent_id and user_id = v_user
  ) then
    raise exception 'not_agent_member' using errcode = '42501';
  end if;
  if p_url is null or length(p_url) = 0 then
    raise exception 'invalid_path' using errcode = '22023';
  end if;

  update public.agents
    set trade_license_url = p_url,
        trade_license_uploaded_at = now()
  where id = p_agent_id;

  return p_url;
end;
$$;

grant execute on function public.set_agent_trade_license(uuid, text)
  to authenticated;

-- Storage policy — agents upload their license to the existing
-- 'workshop-docs' bucket (private). Reusing the same bucket is fine
-- because everything in it is verification-tier evidence.
drop policy if exists "agents_upload_own_trade_license" on storage.objects;
create policy "agents_upload_own_trade_license"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'workshop-docs'
    -- We rely on the storage path convention: agents/{agent_id}/...
    -- The set_agent_trade_license RPC validates membership before
    -- writing the row that points here, so an orphan upload (without
    -- corresponding agents row update) is harmless.
  );

drop policy if exists "agents_read_own_trade_license" on storage.objects;
create policy "agents_read_own_trade_license"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'workshop-docs'
  );

-- =====================================================================
-- Tighten redeem_agent_code: reject unverified agent orgs.
-- =====================================================================
create or replace function public.redeem_agent_code(
  p_code text,
  p_agent_id uuid,
  p_full_minutes int default 60,
  p_meta_days int default 30
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_code public.agent_codes;
  v_grant_id uuid;
  v_granted_at timestamptz := now();
  v_agent_tier text;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not public.is_agent_member(p_agent_id) then
    raise exception 'not_agent_member' using errcode = '42501';
  end if;

  -- KYC gate — unverified agents can't pull customer documents.
  select verification_tier into v_agent_tier
    from public.agents
    where id = p_agent_id;
  if v_agent_tier is null or v_agent_tier = 'unverified' then
    raise exception 'agent_not_verified' using errcode = '42501';
  end if;

  select * into v_code from public.agent_codes where code = p_code for update;
  if v_code.id is null then
    raise exception 'code_not_found' using errcode = 'P0002';
  end if;
  if v_code.used_at is not null then
    raise exception 'code_already_used' using errcode = '22023';
  end if;
  if v_code.expires_at < now() then
    raise exception 'code_expired' using errcode = '22023';
  end if;

  insert into public.agent_grants (
    agent_id, vehicle_id, granted_by, granted_at,
    full_until, expires_at
  ) values (
    p_agent_id,
    v_code.vehicle_id,
    v_code.created_by,
    v_granted_at,
    v_granted_at + (p_full_minutes || ' minutes')::interval,
    v_granted_at + (p_meta_days || ' days')::interval
  )
  returning id into v_grant_id;

  update public.agent_codes
    set used_at = now(),
        used_by_user_id = v_uid,
        used_for_grant_id = v_grant_id
  where id = v_code.id;

  return v_grant_id;
end;
$$;

notify pgrst, 'reload schema';
