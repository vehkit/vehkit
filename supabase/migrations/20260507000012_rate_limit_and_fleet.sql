-- =====================================================================
-- (1) Rate limiting on /shop/[code] — defends against brute-force
-- (2) Fleet mode foundation — orgs that own multiple vehicles
-- =====================================================================

-- =====================================================================
-- 1. SHOP ATTEMPTS RATE LIMITING
-- =====================================================================

create table public.shop_attempts (
  id uuid primary key default gen_random_uuid(),
  ip_address inet not null,
  code_attempted text,
  succeeded boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_shop_attempts_ip_time on public.shop_attempts(ip_address, created_at desc);

alter table public.shop_attempts enable row level security;
-- No public access. Functions use SECURITY DEFINER.

create or replace function public.check_and_track_shop_attempt(
  p_ip inet,
  p_code text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recent_failed int;
begin
  if p_ip is null then
    -- Can't track without an IP; allow but don't track
    return true;
  end if;

  select count(*)::int into v_recent_failed
  from public.shop_attempts
  where ip_address = p_ip
    and succeeded = false
    and created_at > now() - interval '10 minutes';

  if v_recent_failed >= 10 then
    return false;
  end if;

  insert into public.shop_attempts (ip_address, code_attempted, succeeded)
  values (p_ip, p_code, false);

  return true;
end;
$$;

grant execute on function public.check_and_track_shop_attempt(inet, text)
  to anon, authenticated;

create or replace function public.mark_shop_attempt_success(p_ip inet, p_code text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.shop_attempts
     set succeeded = true
   where ip_address = p_ip
     and code_attempted = p_code
     and created_at > now() - interval '5 minutes'
     and not succeeded;
$$;

grant execute on function public.mark_shop_attempt_success(inet, text)
  to anon, authenticated;

-- =====================================================================
-- 2. FLEET ORGS — foundation for B2B multi-vehicle accounts
-- =====================================================================

create table public.fleet_orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  emirate text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger fleet_orgs_set_updated_at
  before update on public.fleet_orgs
  for each row execute function public.set_updated_at();

create table public.fleet_members (
  org_id uuid not null references public.fleet_orgs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create index idx_fleet_members_user on public.fleet_members(user_id);

-- Vehicles can optionally be tagged to a fleet org
alter table public.vehicles
  add column if not exists fleet_org_id uuid references public.fleet_orgs(id);

create index if not exists idx_vehicles_fleet on public.vehicles(fleet_org_id)
  where fleet_org_id is not null;

-- =====================================================================
-- RLS for fleet
-- =====================================================================
alter table public.fleet_orgs enable row level security;
alter table public.fleet_members enable row level security;

-- Helper: is the caller a member of this org?
create or replace function public.is_fleet_member(p_org_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.fleet_members
    where org_id = p_org_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_fleet_admin(p_org_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.fleet_members
    where org_id = p_org_id and user_id = auth.uid() and role = 'admin'
  );
$$;

-- fleet_orgs policies
create policy "members read own org" on public.fleet_orgs
  for select using (public.is_fleet_member(id));

create policy "admins update own org" on public.fleet_orgs
  for update using (public.is_fleet_admin(id))
  with check (public.is_fleet_admin(id));

create policy "creator inserts org" on public.fleet_orgs
  for insert with check (created_by = auth.uid());

create policy "admins delete own org" on public.fleet_orgs
  for delete using (public.is_fleet_admin(id));

-- fleet_members policies
create policy "members see own team" on public.fleet_members
  for select using (public.is_fleet_member(org_id));

create policy "admins manage team" on public.fleet_members
  for all using (public.is_fleet_admin(org_id))
  with check (public.is_fleet_admin(org_id));

-- Allow fleet members to read fleet vehicles
create policy "fleet member reads fleet vehicle" on public.vehicles
  for select using (
    fleet_org_id is not null and public.is_fleet_member(fleet_org_id)
  );

-- Fleet admins can update fleet vehicles
create policy "fleet admin updates fleet vehicle" on public.vehicles
  for update using (
    fleet_org_id is not null and public.is_fleet_admin(fleet_org_id)
  ) with check (
    fleet_org_id is not null and public.is_fleet_admin(fleet_org_id)
  );

grant select, insert, update, delete on public.fleet_orgs to authenticated;
grant select, insert, update, delete on public.fleet_members to authenticated;

-- =====================================================================
-- Atomic create-org-with-creator-as-admin
-- =====================================================================
create or replace function public.create_fleet_org(
  p_name text,
  p_emirate text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
  v_slug text;
begin
  if v_user is null then
    raise exception 'Not authenticated' using errcode = 'P0001';
  end if;

  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'Name required' using errcode = 'P0001';
  end if;

  v_slug := lower(regexp_replace(trim(p_name), '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := trim(both '-' from v_slug);
  if v_slug = '' then v_slug := 'fleet'; end if;
  v_slug := v_slug || '-' || lower(substring(md5(random()::text || clock_timestamp()::text) from 1 for 5));

  insert into public.fleet_orgs (name, slug, emirate, created_by)
  values (trim(p_name), v_slug, p_emirate, v_user)
  returning id into v_id;

  insert into public.fleet_members (org_id, user_id, role)
  values (v_id, v_user, 'admin');

  return v_id;
end;
$$;

grant execute on function public.create_fleet_org(text, text) to authenticated;

-- Stats RPC for fleet dashboard
create or replace function public.fleet_org_stats(p_org_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_member boolean := public.is_fleet_member(p_org_id);
  v_vehicles bigint;
  v_members bigint;
  v_total_km bigint;
begin
  if not v_member then return null; end if;

  select count(*)::bigint, coalesce(sum(current_odometer), 0)::bigint
    into v_vehicles, v_total_km
  from public.vehicles
  where fleet_org_id = p_org_id;

  select count(*)::bigint into v_members
  from public.fleet_members
  where org_id = p_org_id;

  return jsonb_build_object(
    'vehicle_count', v_vehicles,
    'member_count', v_members,
    'total_km', v_total_km
  );
end;
$$;

grant execute on function public.fleet_org_stats(uuid) to authenticated;
