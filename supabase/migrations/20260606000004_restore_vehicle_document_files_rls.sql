-- =====================================================================
-- Round two of the has_vehicle_access CASCADE cleanup.
--
-- vehicle_document_files (the child table for multi-file documents)
-- had three policies that also called has_vehicle_access(). They were
-- dropped along with the parent function in migration 20260606000002,
-- and 20260606000003 missed restoring them. Restoring now.
-- =====================================================================

drop policy if exists "owners_read_document_files"
  on public.vehicle_document_files;
create policy "owners_read_document_files"
  on public.vehicle_document_files
  for select using (
    exists (
      select 1 from public.vehicle_documents d
      where d.id = vehicle_document_files.document_id
        and public.has_vehicle_access(d.vehicle_id, 'view')
    )
  );

drop policy if exists "owners_insert_document_files"
  on public.vehicle_document_files;
create policy "owners_insert_document_files"
  on public.vehicle_document_files
  for insert with check (
    public.has_vehicle_access(vehicle_id, 'add_record')
    and uploaded_by = auth.uid()
    and exists (
      select 1 from public.vehicle_documents d
      where d.id = document_id
        and d.vehicle_id = vehicle_document_files.vehicle_id
    )
  );

drop policy if exists "owners_delete_document_files"
  on public.vehicle_document_files;
create policy "owners_delete_document_files"
  on public.vehicle_document_files
  for delete using (
    exists (
      select 1 from public.vehicle_documents d
      where d.id = vehicle_document_files.document_id
        and public.has_vehicle_access(d.vehicle_id, 'full')
    )
  );

notify pgrst, 'reload schema';
