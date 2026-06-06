-- =====================================================================
-- Recovery migration.
--
-- The previous migration (20260606000002) dropped has_vehicle_access()
-- because it referenced the now-removed vehicle_access table. CASCADE
-- on the function drop also took every RLS policy that called the
-- function. That left these tables unwritable by owners:
--
--   vehicle_documents       (insert / update / delete all denied)
--   service_records         (read denied for non-owners, workshop
--                            insert denied for everyone)
--   service_files           (read + insert denied)
--   vehicles                ("shared_vehicle_view" select gone, but
--                            owner_full_vehicle_access still works)
--
-- This migration:
--   1. Recreates has_vehicle_access() backed by agent_grants instead
--      of the dropped vehicle_access table.
--   2. Recreates every dropped policy.
-- =====================================================================

-- 1. Restore the access-check helper. Same signature, new backend.
create or replace function public.has_vehicle_access(
  vehicle_uuid uuid,
  required_level text default 'view'
)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    -- Owner always has every level.
    select 1 from public.vehicles
    where id = vehicle_uuid and owner_id = auth.uid()
  ) or exists (
    -- Active agent grant. Replaces the dropped vehicle_access table.
    --   view        any unexpired, unrevoked grant
    --   add_record  same conditions (agent grants are flat today;
    --               full vs metadata window is a future tier)
    --   full        only inside the full window
    select 1
    from public.agent_grants ag
    join public.agent_members am on am.agent_id = ag.agent_id
    where ag.vehicle_id = vehicle_uuid
      and am.user_id = auth.uid()
      and ag.revoked_at is null
      and ag.expires_at > now()
      and (
        required_level = 'view'
        or required_level = 'add_record'
        or (required_level = 'full' and ag.full_until > now())
      )
  );
$$;

-- 2. Recreate dropped policies. Each block guards against duplicates
--    so the migration is safe to re-run on environments where the
--    policy somehow survived.

-- vehicles
drop policy if exists "shared_vehicle_view" on public.vehicles;
create policy "shared_vehicle_view" on public.vehicles
  for select using (public.has_vehicle_access(id, 'view'));

-- service_records
drop policy if exists "read_service_records_with_access" on public.service_records;
create policy "read_service_records_with_access" on public.service_records
  for select using (public.has_vehicle_access(vehicle_id, 'view'));

drop policy if exists "workshop_inserts_attested_records" on public.service_records;
create policy "workshop_inserts_attested_records" on public.service_records
  for insert with check (
    public.has_vehicle_access(vehicle_id, 'add_record')
    and attestation = 'workshop'
    and workshop_id is not null
    and public.is_workshop_member(workshop_id)
    and created_by = auth.uid()
  );

-- service_files
drop policy if exists "read_files_with_vehicle_access" on public.service_files;
create policy "read_files_with_vehicle_access" on public.service_files
  for select using (public.has_vehicle_access(vehicle_id, 'view'));

drop policy if exists "uploader_inserts_files" on public.service_files;
create policy "uploader_inserts_files" on public.service_files
  for insert with check (
    uploaded_by = auth.uid()
    and public.has_vehicle_access(vehicle_id, 'add_record')
  );

-- vehicle_documents
drop policy if exists "owners_read_vehicle_docs" on public.vehicle_documents;
create policy "owners_read_vehicle_docs" on public.vehicle_documents
  for select using (public.has_vehicle_access(vehicle_id, 'view'));

drop policy if exists "owners_insert_vehicle_docs" on public.vehicle_documents;
create policy "owners_insert_vehicle_docs" on public.vehicle_documents
  for insert with check (
    public.has_vehicle_access(vehicle_id, 'add_record')
    and uploaded_by = auth.uid()
  );

drop policy if exists "owners_update_vehicle_docs" on public.vehicle_documents;
create policy "owners_update_vehicle_docs" on public.vehicle_documents
  for update using (public.has_vehicle_access(vehicle_id, 'add_record'));

drop policy if exists "owners_delete_vehicle_docs" on public.vehicle_documents;
create policy "owners_delete_vehicle_docs" on public.vehicle_documents
  for delete using (public.has_vehicle_access(vehicle_id, 'full'));

notify pgrst, 'reload schema';
