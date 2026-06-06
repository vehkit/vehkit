-- =====================================================================
-- Round three of the has_vehicle_access CASCADE cleanup.
--
-- The storage.objects policy `vehicle_docs_read_with_access` from
-- 20260510000014 also called has_vehicle_access(). When that
-- function was dropped in 20260606000002, this policy went with it.
-- Result: every file in the `vehicle-docs` bucket returns "Object
-- not found" because Supabase substitutes that for "blocked by RLS".
--
-- INSERT and DELETE policies on storage.objects for this bucket
-- did NOT use has_vehicle_access (they only check bucket_id + owner),
-- so they survived the cascade. We only restore SELECT here.
-- =====================================================================

drop policy if exists "vehicle_docs_read_with_access" on storage.objects;

create policy "vehicle_docs_read_with_access"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'vehicle-docs'
    and (
      -- Match against the parent vehicle_documents row directly. Path
      -- lives on the parent for legacy single-file documents.
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
      -- Or against any child file row. Multi-file documents store
      -- positions 1+ only in vehicle_document_files.
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
