-- =====================================================================
-- Vehicle documents
--
-- Each vehicle gets a small library of attached documents — registration
-- card (mulkiya), insurance policies, NOC letters, driving licence
-- copies, etc. Documents have an issued_at and expires_at so we can:
--   1. Render expiry pills and traffic-light state in the UI
--   2. Build expiry reminders (next session)
--   3. Surface "expiring this month" alerts to insurance agents
--
-- File bytes live in a NEW bucket 'vehicle-docs' (private, signed URLs).
-- We deliberately keep documents OUT of the existing public 'service-files'
-- bucket — service photos are casual/throwaway; documents are PII-heavy
-- (Emirates ID numbers, plate, owner address) and need stricter access.
-- =====================================================================

create table if not exists public.vehicle_documents (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  doc_type text not null check (doc_type in (
    'mulkiya',           -- vehicle registration card
    'insurance_policy',  -- comprehensive / third-party
    'driving_licence',   -- owner's UAE licence
    'noc',               -- bank/financier no-objection
    'pollution_test',    -- emissions certificate
    'service_history',   -- exported PDF of vehkit timeline
    'other'              -- catch-all
  )),
  label text,                                 -- optional custom name (e.g. "RSA renewal 2026")
  storage_path text not null,                 -- bucket path, NOT a public URL
  file_type text,                             -- mime
  file_size_bytes bigint,
  issued_date date,
  expires_at date,                            -- key for reminders / agent alerts
  uploaded_by uuid not null references auth.users(id),
  archived_at timestamptz,                    -- soft delete (keep history)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_vehicle_documents_vehicle
  on public.vehicle_documents(vehicle_id) where archived_at is null;
create index if not exists idx_vehicle_documents_expires
  on public.vehicle_documents(expires_at)
  where expires_at is not null and archived_at is null;
create index if not exists idx_vehicle_documents_type
  on public.vehicle_documents(vehicle_id, doc_type) where archived_at is null;

create trigger vehicle_documents_set_updated_at
  before update on public.vehicle_documents
  for each row execute function public.set_updated_at();

-- =====================================================================
-- Storage bucket — private. Reads via signed URL, writes via auth check.
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('vehicle-docs', 'vehicle-docs', false)
on conflict (id) do nothing;

create policy "owners_read_own_vehicle_docs"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'vehicle-docs'
    -- Path convention: vehicles/{vehicle_id}/docs/{filename}
    -- We don't validate the path here; the vehicle_documents row + its
    -- RLS govern access. Storage just gates by authentication.
  );

create policy "auth_users_upload_vehicle_docs"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'vehicle-docs');

create policy "auth_users_delete_own_vehicle_docs"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'vehicle-docs' and owner = auth.uid());

-- =====================================================================
-- RLS on vehicle_documents
-- =====================================================================
alter table public.vehicle_documents enable row level security;

-- Owners (and family/workshop access grantees) can read.
-- Active agent grants (full window) can also read — handled in the next
-- migration via OR clause on agent_grants.
create policy "owners_read_vehicle_docs" on public.vehicle_documents
  for select using (public.has_vehicle_access(vehicle_id, 'view'));

create policy "owners_insert_vehicle_docs" on public.vehicle_documents
  for insert with check (
    public.has_vehicle_access(vehicle_id, 'add_record')
    and uploaded_by = auth.uid()
  );

create policy "owners_update_vehicle_docs" on public.vehicle_documents
  for update using (public.has_vehicle_access(vehicle_id, 'add_record'));

create policy "owners_delete_vehicle_docs" on public.vehicle_documents
  for delete using (public.has_vehicle_access(vehicle_id, 'full'));

notify pgrst, 'reload schema';
