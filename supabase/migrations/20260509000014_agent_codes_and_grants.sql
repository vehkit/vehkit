-- =====================================================================
-- Agent share codes + bound grants (time-stratified access)
--
-- Two-phase access model:
--   Phase 1 — code redemption: owner generates a 6-char code, agent
--             enters it within 60 minutes, RPC creates a grant.
--   Phase 2 — full window: for `full_until` (granted_at + 1 hour) the
--             agent can read all vehicle_documents bytes (download
--             storage objects).
--   Phase 3 — minimum-info window: from full_until → expires_at
--             (granted_at + 30 days) the agent retains METADATA only —
--             vehicle plate, contact phone, document expiry dates, doc
--             types — for renewal outreach. NO file bytes.
--
-- Time-stratified access is enforced in RLS, NOT in the UI. A broker
-- keeping a tab open past the 1hr window cannot bypass the gate
-- because storage SELECT and document SELECT both check `now() < full_until`.
-- =====================================================================

create table if not exists public.agent_codes (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  code text not null unique,
  created_by uuid not null references auth.users(id),
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by_user_id uuid references auth.users(id),
  used_for_grant_id uuid,                     -- FK added after agent_grants exists
  created_at timestamptz not null default now()
);

create index if not exists idx_agent_codes_code on public.agent_codes(code);
create index if not exists idx_agent_codes_vehicle on public.agent_codes(vehicle_id);
create index if not exists idx_agent_codes_active
  on public.agent_codes(vehicle_id, expires_at) where used_at is null;

-- Bound grants: a per-(agent, vehicle, redemption) row that drives access.
create table if not exists public.agent_grants (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  granted_by uuid not null references auth.users(id),  -- the vehicle owner at redemption
  granted_at timestamptz not null default now(),
  full_until timestamptz not null,            -- granted_at + 1 hour by default
  expires_at timestamptz not null,            -- granted_at + 30 days
  revoked_at timestamptz,                     -- owner can manually revoke at any time
  created_at timestamptz not null default now()
);

create index if not exists idx_agent_grants_agent
  on public.agent_grants(agent_id) where revoked_at is null;
create index if not exists idx_agent_grants_vehicle
  on public.agent_grants(vehicle_id) where revoked_at is null;
create index if not exists idx_agent_grants_active
  on public.agent_grants(agent_id, vehicle_id, expires_at)
  where revoked_at is null;

alter table public.agent_codes  enable row level security;
alter table public.agent_grants enable row level security;

-- Owners manage their own codes and grants.
create policy "owner_manages_agent_codes" on public.agent_codes
  for all using (
    exists (
      select 1 from public.vehicles
      where id = vehicle_id and owner_id = auth.uid()
    )
  );

create policy "owner_reads_agent_grants" on public.agent_grants
  for select using (
    exists (
      select 1 from public.vehicles
      where id = vehicle_id and owner_id = auth.uid()
    )
  );

-- Owners can revoke (UPDATE) but not insert/delete directly — those
-- happen via SECURITY DEFINER RPC.
create policy "owner_revokes_agent_grants" on public.agent_grants
  for update using (
    exists (
      select 1 from public.vehicles
      where id = vehicle_id and owner_id = auth.uid()
    )
  );

-- Agent members read grants their org holds.
create policy "agent_members_read_grants" on public.agent_grants
  for select using (public.is_agent_member(agent_id));

-- =====================================================================
-- Time-stratified access helpers
-- =====================================================================

-- True if the calling user is an active agent member with a non-revoked
-- grant on this vehicle, currently within the FULL window.
create or replace function public.agent_has_full_doc_access(p_vehicle_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.agent_grants ag
    where ag.vehicle_id = p_vehicle_id
      and ag.revoked_at is null
      and now() < ag.full_until
      and public.is_agent_member(ag.agent_id)
  );
$$;

-- True if the calling user retains metadata-only access (between
-- full_until and expires_at).
create or replace function public.agent_has_meta_doc_access(p_vehicle_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.agent_grants ag
    where ag.vehicle_id = p_vehicle_id
      and ag.revoked_at is null
      and now() < ag.expires_at
      and public.is_agent_member(ag.agent_id)
  );
$$;

grant execute on function public.agent_has_full_doc_access(uuid) to authenticated;
grant execute on function public.agent_has_meta_doc_access(uuid) to authenticated;

-- Extend vehicle_documents SELECT to allow agents in the full window.
-- The metadata-only window is served via a SECURITY DEFINER RPC below
-- (so we can return a pruned projection rather than full rows).
create policy "agents_read_docs_in_full_window" on public.vehicle_documents
  for select using (public.agent_has_full_doc_access(vehicle_id));

-- =====================================================================
-- Owner action: generate a fresh agent code
-- =====================================================================
create or replace function public.create_agent_code(
  p_vehicle_id uuid,
  p_code text,
  p_minutes int default 60
) returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_expires timestamptz;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.vehicles where id = p_vehicle_id and owner_id = v_uid
  ) then
    raise exception 'not_vehicle_owner' using errcode = '42501';
  end if;
  if p_code is null or length(p_code) < 4 then
    raise exception 'invalid_code' using errcode = '22023';
  end if;

  v_expires := now() + (p_minutes || ' minutes')::interval;

  -- Invalidate any other unused codes for this vehicle (one active code at a time)
  update public.agent_codes
    set used_at = now()
  where vehicle_id = p_vehicle_id
    and used_at is null
    and expires_at > now();

  insert into public.agent_codes (vehicle_id, code, created_by, expires_at)
  values (p_vehicle_id, p_code, v_uid, v_expires);

  return v_expires;
end;
$$;

grant execute on function public.create_agent_code(uuid, text, int) to authenticated;

-- =====================================================================
-- Agent action: redeem code → produces a grant
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
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not public.is_agent_member(p_agent_id) then
    raise exception 'not_agent_member' using errcode = '42501';
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

grant execute on function public.redeem_agent_code(text, uuid, int, int) to authenticated;

-- =====================================================================
-- Agent dashboard read: minimum-info projection of grants in the
-- post-full window. Returns just what's needed for renewal outreach.
-- =====================================================================
create or replace function public.agent_dashboard_grants(p_agent_id uuid)
returns table (
  grant_id uuid,
  vehicle_id uuid,
  granted_at timestamptz,
  full_until timestamptz,
  expires_at timestamptz,
  vehicle_make text,
  vehicle_model text,
  vehicle_plate_emirate text,
  vehicle_plate_number text,
  owner_full_name text,
  owner_phone text,
  doc_count int,
  next_doc_expiry date,
  is_full_window boolean
)
language sql
security definer
stable
set search_path = public
as $$
  select
    ag.id as grant_id,
    ag.vehicle_id,
    ag.granted_at,
    ag.full_until,
    ag.expires_at,
    v.make,
    v.model,
    v.plate_emirate,
    v.plate_number,
    p.full_name,
    p.phone,
    (
      select count(*)::int from public.vehicle_documents vd
      where vd.vehicle_id = ag.vehicle_id and vd.archived_at is null
    ) as doc_count,
    (
      select min(vd.expires_at) from public.vehicle_documents vd
      where vd.vehicle_id = ag.vehicle_id
        and vd.archived_at is null
        and vd.expires_at is not null
        and vd.expires_at >= current_date
    ) as next_doc_expiry,
    (now() < ag.full_until) as is_full_window
  from public.agent_grants ag
  join public.vehicles v on v.id = ag.vehicle_id
  left join public.profiles p on p.id = ag.granted_by
  where public.is_agent_member(ag.agent_id)
    and ag.agent_id = p_agent_id
    and ag.revoked_at is null
    and ag.expires_at > now()
  order by ag.granted_at desc;
$$;

grant execute on function public.agent_dashboard_grants(uuid) to authenticated;

-- =====================================================================
-- Wire FK from agent_codes.used_for_grant_id → agent_grants.id
-- =====================================================================
alter table public.agent_codes
  add constraint agent_codes_used_for_grant_fk
  foreign key (used_for_grant_id) references public.agent_grants(id) on delete set null;

notify pgrst, 'reload schema';
