-- =====================================================================
-- Workshop attestation codes — owner-issued one-time codes that let a
-- workshop add a workshop-attested service record without an account.
--
-- Lightweight "trust handshake" — gets workshops touching the platform
-- before we ask them to sign up.
-- =====================================================================

create table public.workshop_codes (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  code text not null unique,
  created_by uuid not null references auth.users(id),
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by_workshop_name text,
  used_for_record_id uuid references public.service_records(id),
  created_at timestamptz not null default now()
);

create index idx_workshop_codes_code on public.workshop_codes(code);
create index idx_workshop_codes_vehicle on public.workshop_codes(vehicle_id);
create index idx_workshop_codes_active
  on public.workshop_codes(vehicle_id, expires_at)
  where used_at is null;

alter table public.workshop_codes enable row level security;

create policy "owner manages workshop codes"
  on public.workshop_codes for all
  using (
    exists (
      select 1 from public.vehicles where id = vehicle_id and owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.vehicles where id = vehicle_id and owner_id = auth.uid()
    )
  );

-- Public lookup (by code) is via service role at /shop route.

grant select, insert, update, delete on table public.workshop_codes to authenticated;
