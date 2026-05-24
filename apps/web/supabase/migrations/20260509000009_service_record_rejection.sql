-- Soft-retract for service records.
--
-- Why: when a customer rejects a workshop's pending entry, we want to
--   (a) preserve the audit trail (the workshop attempted a log)
--   (b) capture a workshop_review for that rejection (negative signal)
-- The previous behavior — hard delete — destroyed both, because
-- workshop_reviews.service_record_id is NOT NULL ON DELETE CASCADE.
--
-- Soft-retract sets rejected_at; the row stays, the review can attach.

alter table public.service_records
  add column if not exists rejected_at timestamptz null;

-- Partial index — only rows with rejected_at set are interesting to filter
-- (vast majority of records will never be rejected).
create index if not exists idx_service_records_rejected_at
  on public.service_records(rejected_at)
  where rejected_at is not null;

comment on column public.service_records.rejected_at is
  'Timestamp set when the vehicle owner retracts a pending workshop entry. The record stays for audit + review attachment; UI may display it dimmed.';

notify pgrst, 'reload schema';
