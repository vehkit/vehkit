-- =====================================================================
-- Extend storage RLS to know about multi-file documents.
--
-- The previous policy `vehicle_docs_read_with_access` (from
-- 20260509000015) only allowed read when storage.objects.name matched
-- a vehicle_documents.storage_path. That works for legacy single-file
-- documents where the storage path is denormalised onto the parent row.
--
-- After 20260510000013 introduced vehicle_document_files, positions 1+
-- of a multi-file document live ONLY in the child table — their storage
-- paths aren't on the parent row. The old policy returned "Object not
-- found" for those paths (Supabase's deliberate response when RLS blocks
-- read), even though the bucket contained the files.
--
-- This migration replaces the policy with one that accepts a match
-- against EITHER the parent's storage_path OR any child file's path,
-- with the same vehicle-access check on the parent.
-- =====================================================================

drop policy if exists "vehicle_docs_read_with_access" on storage.objects;

create policy "vehicle_docs_read_with_access"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'vehicle-docs'
    and (
      -- Match against the parent's single denormalised storage_path
      exists (
        select 1
        from public.vehicle_documents vd
        where vd.storage_path = storage.objects.name
          and vd.archived_at is null
          and (
            public.has_vehicle_access(vd.vehicle_id, 'view')
            or public.agent_has_full_doc_access(vd.vehicle_id)
          )
      )
      -- OR match against any child file row
      or exists (
        select 1
        from public.vehicle_document_files vdf
        join public.vehicle_documents vd on vd.id = vdf.document_id
        where vdf.storage_path = storage.objects.name
          and vd.archived_at is null
          and (
            public.has_vehicle_access(vd.vehicle_id, 'view')
            or public.agent_has_full_doc_access(vd.vehicle_id)
          )
      )
    )
  );

notify pgrst, 'reload schema';
