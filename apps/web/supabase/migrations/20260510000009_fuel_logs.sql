-- =====================================================================
-- fuel_logs — owner-logged fill-ups. Lightweight: enough data to compute
-- consumption (km/L) and spend over time, not a full POS receipt.
--
-- Why a separate table (not just a service_records row):
--   - Service records are workshop-attestable. Fuel fills are owner-only.
--   - Different cardinality (fills are weekly, services are quarterly).
--   - Different intelligence — consumption curves vs. service intervals.
-- =====================================================================

create table if not exists public.fuel_logs (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  logged_at timestamptz not null default now(),
  odometer_km integer,
  liters numeric(6, 2) not null check (liters > 0),
  total_aed numeric(8, 2) check (total_aed is null or total_aed >= 0),
  fuel_grade text check (fuel_grade in ('special', 'super', 'e_plus', 'diesel') or fuel_grade is null),
  station_name text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_fuel_logs_vehicle_logged_at
  on public.fuel_logs (vehicle_id, logged_at desc);

alter table public.fuel_logs enable row level security;

-- Owner of the vehicle reads + writes own fuel logs.
create policy "owner_read_own_fuel_logs"
  on public.fuel_logs for select
  using (
    exists (
      select 1 from public.vehicles v
      where v.id = fuel_logs.vehicle_id
        and v.owner_id = auth.uid()
    )
  );

create policy "owner_insert_own_fuel_logs"
  on public.fuel_logs for insert
  with check (
    exists (
      select 1 from public.vehicles v
      where v.id = fuel_logs.vehicle_id
        and v.owner_id = auth.uid()
    )
    and created_by = auth.uid()
  );

create policy "owner_update_own_fuel_logs"
  on public.fuel_logs for update
  using (
    exists (
      select 1 from public.vehicles v
      where v.id = fuel_logs.vehicle_id
        and v.owner_id = auth.uid()
    )
  );

create policy "owner_delete_own_fuel_logs"
  on public.fuel_logs for delete
  using (
    exists (
      select 1 from public.vehicles v
      where v.id = fuel_logs.vehicle_id
        and v.owner_id = auth.uid()
    )
  );

notify pgrst, 'reload schema';
