-- =====================================================================
-- PIVOT — Garage loyalty model
--
-- New product positioning: garages onboard for free customer leads,
-- customers find them via verified ratings. The job lifecycle becomes
-- the trust loop: every rating is anchored to a real service_record,
-- so fake reviews require a fake job.
--
-- Two new mechanisms:
--   1. booking_requests   — customer-initiated bookings before arrival
--   2. service_records.status — pending → in_progress → done lifecycle
--
-- service_records was already there. We're adding the lifecycle columns
-- so the dashboard can show "pipeline" stages and the rating prompt can
-- fire at the right moment.
-- =====================================================================

-- ─── booking_requests ─────────────────────────────────────────────────
-- A customer's request to bring their car to a specific workshop.
-- Created via /w/[slug]/book. Workshop accepts → creates a
-- service_record at status=pending. Workshop declines → status=declined.
create table if not exists public.booking_requests (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null
    references public.workshops(id) on delete cascade,
  customer_id uuid not null
    references auth.users(id) on delete cascade,
  vehicle_id uuid
    references public.vehicles(id) on delete set null,
  -- Free-text service category — workshops pick from a curated list
  -- but customers can type freely too.
  service_category text not null,
  preferred_date date,
  message text,
  contact_phone text,
  -- Lifecycle: pending → confirmed (accepted) | declined | converted
  -- 'converted' = workshop accepted AND a service_record exists.
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'declined', 'converted', 'cancelled')),
  -- When the workshop responded
  responded_at timestamptz,
  response_note text,
  -- Once a service_record is created, link it
  service_record_id uuid
    references public.service_records(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_booking_requests_workshop
  on public.booking_requests(workshop_id) where status = 'pending';
create index if not exists idx_booking_requests_customer
  on public.booking_requests(customer_id);
create index if not exists idx_booking_requests_status
  on public.booking_requests(workshop_id, status);

create trigger booking_requests_set_updated_at
  before update on public.booking_requests
  for each row execute function public.set_updated_at();

-- ─── service_records lifecycle ────────────────────────────────────────
-- Add status + transition timestamps so the pipeline dashboard can show
-- pending/in_progress/done and the rating prompt fires on completion.
alter table public.service_records
  add column if not exists status text not null default 'done'
    check (status in ('pending', 'in_progress', 'done')),
  add column if not exists started_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists rating_requested_at timestamptz,
  -- Link back to the booking that spawned this record (nullable for
  -- walk-ins).
  add column if not exists booking_request_id uuid
    references public.booking_requests(id) on delete set null;

-- Existing service_records default to 'done' so the pivot doesn't break
-- historical data — workshop dashboards still show them as completed.

create index if not exists idx_service_records_pipeline
  on public.service_records(workshop_id, status, service_date desc)
  where workshop_id is not null and rejected_at is null;

-- ─── booking_requests RLS ─────────────────────────────────────────────
alter table public.booking_requests enable row level security;

-- Customer sees their own bookings; workshop members see bookings for
-- their workshop.
create policy "booking_select" on public.booking_requests
  for select using (
    customer_id = auth.uid()
    or exists (
      select 1 from public.workshop_members wm
      where wm.user_id = auth.uid()
        and wm.workshop_id = booking_requests.workshop_id
    )
  );

create policy "booking_insert" on public.booking_requests
  for insert with check (
    customer_id = auth.uid()
  );

-- Customer can cancel their own pending booking. Workshop members can
-- update bookings for their workshop (accept/decline).
create policy "booking_update" on public.booking_requests
  for update using (
    (customer_id = auth.uid() and status = 'pending')
    or exists (
      select 1 from public.workshop_members wm
      where wm.user_id = auth.uid()
        and wm.workshop_id = booking_requests.workshop_id
    )
  );

notify pgrst, 'reload schema';
