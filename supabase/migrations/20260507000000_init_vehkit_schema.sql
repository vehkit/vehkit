-- =====================================================================
-- Vehkit — initial schema
-- =====================================================================
-- Tables:
--   profiles           : 1:1 with auth.users
--   workshops          : organizations that can attest service entries
--   workshop_members   : users who act on behalf of a workshop
--   vehicles           : owned by a profile
--   vehicle_access     : sharing with family members or workshops
--   service_records    : the timeline of service / repair entries
--   service_files      : attached invoices, photos, OCR results
--   reminders          : owner-side service / registration / insurance reminders
--   audit_log          : append-only trail of writes (verification chain)
-- =====================================================================

-- Extensions ----------------------------------------------------------
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- Helper: updated_at autosetter --------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =====================================================================
-- profiles
-- =====================================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  full_name text,
  phone text,
  preferred_language text not null default 'en' check (preferred_language in ('en', 'ar')),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create profile row when a new auth user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
-- workshops
-- =====================================================================
create table public.workshops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  emirate text,
  address text,
  phone text,
  email text,
  trade_license text,
  verification_tier text not null default 'unverified'
    check (verification_tier in ('unverified', 'silver', 'gold')),
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger workshops_set_updated_at
  before update on public.workshops
  for each row execute function public.set_updated_at();

create table public.workshop_members (
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (workshop_id, user_id)
);

-- =====================================================================
-- vehicles
-- =====================================================================
create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  vin text,
  plate_number text,
  plate_emirate text,
  make text not null,
  model text not null,
  year smallint check (year between 1900 and extract(year from now())::int + 1),
  color text,
  nickname text,
  current_odometer integer check (current_odometer >= 0),
  current_odometer_at timestamptz,
  registered_at date,
  registration_expires_at date,
  insurance_expires_at date,
  hero_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_vehicles_owner on public.vehicles(owner_id);
create index idx_vehicles_vin on public.vehicles(vin) where vin is not null;
create index idx_vehicles_plate on public.vehicles(plate_number) where plate_number is not null;

create trigger vehicles_set_updated_at
  before update on public.vehicles
  for each row execute function public.set_updated_at();

-- =====================================================================
-- vehicle_access
-- =====================================================================
create table public.vehicle_access (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  granted_to_user_id uuid references public.profiles(id) on delete cascade,
  granted_to_workshop_id uuid references public.workshops(id) on delete cascade,
  access_level text not null check (access_level in ('view', 'add_record', 'full')),
  granted_by uuid not null references auth.users(id),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  -- exactly one of user / workshop must be set
  check ((granted_to_user_id is not null)::int + (granted_to_workshop_id is not null)::int = 1)
);

create index idx_vehicle_access_user on public.vehicle_access(granted_to_user_id) where granted_to_user_id is not null;
create index idx_vehicle_access_workshop on public.vehicle_access(granted_to_workshop_id) where granted_to_workshop_id is not null;
create index idx_vehicle_access_vehicle on public.vehicle_access(vehicle_id);

-- =====================================================================
-- service_records
-- =====================================================================
create table public.service_records (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  service_type text not null,
  service_date date not null,
  odometer integer check (odometer >= 0),
  cost_aed numeric(10,2),
  workshop_id uuid references public.workshops(id),
  workshop_name_freetext text,
  notes text,
  parts jsonb,
  next_service_at_km integer,
  next_service_at_date date,
  attestation text not null default 'owner'
    check (attestation in ('owner', 'receipt', 'workshop')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_service_records_vehicle on public.service_records(vehicle_id, service_date desc);
create index idx_service_records_workshop on public.service_records(workshop_id) where workshop_id is not null;

create trigger service_records_set_updated_at
  before update on public.service_records
  for each row execute function public.set_updated_at();

-- =====================================================================
-- service_files
-- =====================================================================
create table public.service_files (
  id uuid primary key default gen_random_uuid(),
  service_record_id uuid references public.service_records(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  storage_path text not null,
  file_type text,
  file_size_bytes bigint,
  ocr_extracted jsonb,
  uploaded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index idx_service_files_record on public.service_files(service_record_id);
create index idx_service_files_vehicle on public.service_files(vehicle_id);

-- =====================================================================
-- reminders
-- =====================================================================
create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  reminder_type text not null,
  due_date date,
  due_at_km integer,
  notes text,
  status text not null default 'open' check (status in ('open', 'snoozed', 'done')),
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_reminders_vehicle_status on public.reminders(vehicle_id, status);
create index idx_reminders_due_date on public.reminders(due_date) where status = 'open';

create trigger reminders_set_updated_at
  before update on public.reminders
  for each row execute function public.set_updated_at();

-- =====================================================================
-- audit_log (append-only)
-- =====================================================================
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id),
  workshop_id uuid references public.workshops(id),
  entity_type text not null,
  entity_id uuid not null,
  action text not null check (action in ('insert', 'update', 'delete')),
  changes jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index idx_audit_entity on public.audit_log(entity_type, entity_id);
create index idx_audit_actor on public.audit_log(actor_id, created_at desc);

-- Block UPDATE / DELETE on audit_log
create or replace function public.audit_log_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_log is append-only';
end;
$$;

create trigger audit_log_no_update before update on public.audit_log
  for each row execute function public.audit_log_immutable();
create trigger audit_log_no_delete before delete on public.audit_log
  for each row execute function public.audit_log_immutable();

-- =====================================================================
-- Helper functions for RLS
-- =====================================================================
create or replace function public.is_workshop_member(workshop_uuid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.workshop_members
    where workshop_id = workshop_uuid
      and user_id = auth.uid()
  );
$$;

create or replace function public.has_vehicle_access(vehicle_uuid uuid, required_level text default 'view')
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.vehicles
    where id = vehicle_uuid and owner_id = auth.uid()
  ) or exists (
    select 1 from public.vehicle_access va
    where va.vehicle_id = vehicle_uuid
      and (va.expires_at is null or va.expires_at > now())
      and (
        va.granted_to_user_id = auth.uid()
        or (va.granted_to_workshop_id is not null and public.is_workshop_member(va.granted_to_workshop_id))
      )
      and (
        required_level = 'view'
        or (required_level = 'add_record' and va.access_level in ('add_record', 'full'))
        or (required_level = 'full' and va.access_level = 'full')
      )
  );
$$;

-- =====================================================================
-- RLS — enable on every table
-- =====================================================================
alter table public.profiles         enable row level security;
alter table public.workshops        enable row level security;
alter table public.workshop_members enable row level security;
alter table public.vehicles         enable row level security;
alter table public.vehicle_access   enable row level security;
alter table public.service_records  enable row level security;
alter table public.service_files    enable row level security;
alter table public.reminders        enable row level security;
alter table public.audit_log        enable row level security;

-- profiles ----------------------------------------------------------------
create policy "users_read_own_profile" on public.profiles
  for select using (id = auth.uid());

create policy "users_update_own_profile" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- workshops ---------------------------------------------------------------
create policy "anyone_reads_workshops" on public.workshops
  for select using (true);

create policy "workshop_owner_updates" on public.workshops
  for update using (
    exists (
      select 1 from public.workshop_members wm
      where wm.workshop_id = workshops.id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  );

-- workshop_members --------------------------------------------------------
create policy "members_see_own_workshop_team" on public.workshop_members
  for select using (public.is_workshop_member(workshop_id));

-- vehicles ----------------------------------------------------------------
create policy "owner_full_vehicle_access" on public.vehicles
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "shared_vehicle_view" on public.vehicles
  for select using (public.has_vehicle_access(id, 'view'));

-- vehicle_access ----------------------------------------------------------
create policy "owner_manages_vehicle_access" on public.vehicle_access
  for all using (
    exists (select 1 from public.vehicles where id = vehicle_id and owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.vehicles where id = vehicle_id and owner_id = auth.uid())
  );

create policy "grantees_see_own_grants" on public.vehicle_access
  for select using (
    granted_to_user_id = auth.uid()
    or (granted_to_workshop_id is not null and public.is_workshop_member(granted_to_workshop_id))
  );

-- service_records ---------------------------------------------------------
create policy "read_service_records_with_access" on public.service_records
  for select using (public.has_vehicle_access(vehicle_id, 'view'));

create policy "owner_inserts_owner_records" on public.service_records
  for insert with check (
    exists (select 1 from public.vehicles where id = vehicle_id and owner_id = auth.uid())
    and attestation in ('owner', 'receipt')
    and created_by = auth.uid()
  );

create policy "owner_updates_own_records" on public.service_records
  for update using (
    exists (select 1 from public.vehicles where id = vehicle_id and owner_id = auth.uid())
    and attestation in ('owner', 'receipt')
  );

create policy "workshop_inserts_attested_records" on public.service_records
  for insert with check (
    public.has_vehicle_access(vehicle_id, 'add_record')
    and attestation = 'workshop'
    and workshop_id is not null
    and public.is_workshop_member(workshop_id)
    and created_by = auth.uid()
  );

-- service_files -----------------------------------------------------------
create policy "read_files_with_vehicle_access" on public.service_files
  for select using (public.has_vehicle_access(vehicle_id, 'view'));

create policy "uploader_inserts_files" on public.service_files
  for insert with check (
    uploaded_by = auth.uid()
    and public.has_vehicle_access(vehicle_id, 'add_record')
  );

-- reminders ---------------------------------------------------------------
create policy "owner_manages_reminders" on public.reminders
  for all using (
    exists (select 1 from public.vehicles where id = vehicle_id and owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.vehicles where id = vehicle_id and owner_id = auth.uid())
  );

-- audit_log ---------------------------------------------------------------
-- Reads: vehicle owners can see audits for their vehicles
create policy "vehicle_owner_reads_audit" on public.audit_log
  for select using (
    entity_type = 'vehicle' and exists (
      select 1 from public.vehicles where id = audit_log.entity_id and owner_id = auth.uid()
    )
  );

-- No insert / update / delete policies = no client-side writes.
-- Audit rows are written via security-definer functions or triggers only.

-- =====================================================================
-- Storage bucket for service files
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('service-files', 'service-files', false)
on conflict (id) do nothing;

-- Storage RLS: only authenticated users access, scoped via app logic + signed URLs
create policy "auth users read service files"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'service-files');

create policy "auth users upload service files"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'service-files');
