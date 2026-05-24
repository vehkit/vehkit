-- =====================================================================
-- Owner can confirm a workshop entry early — locks the record before the
-- 24-hour retract window expires and triggers the rate-this-workshop
-- prompt immediately. Zero-friction trust loop close.
-- =====================================================================

alter table public.service_records
  add column if not exists confirmed_at timestamptz;

create index if not exists idx_service_records_confirmed
  on public.service_records(confirmed_at)
  where confirmed_at is not null;

notify pgrst, 'reload schema';
