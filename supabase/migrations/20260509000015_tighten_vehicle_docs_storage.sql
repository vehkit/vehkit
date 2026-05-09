-- =====================================================================
-- Tighten storage RLS on the 'vehicle-docs' bucket.
--
-- The original policy `owners_read_own_vehicle_docs` only checked that
-- the request was authenticated + bucket-matched. That meant any
-- authenticated user — including an agent whose full-access window had
-- already closed — could call createSignedUrl on a previously-harvested
-- storage path and download the bytes again. RLS on vehicle_documents
-- gated the row but NOT the underlying object.
--
-- This migration replaces the read policy with one that joins to
-- vehicle_documents and walks back through the same access surface
-- (owner, vehicle_access grant, OR agent in full window).
-- =====================================================================

drop policy if exists "owners_read_own_vehicle_docs" on storage.objects;

create policy "vehicle_docs_read_with_access"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'vehicle-docs'
    and exists (
      select 1
      from public.vehicle_documents vd
      where vd.storage_path = storage.objects.name
        and vd.archived_at is null
        and (
          public.has_vehicle_access(vd.vehicle_id, 'view')
          or public.agent_has_full_doc_access(vd.vehicle_id)
        )
    )
  );

-- Upload policy stays permissive (any authenticated user can upload).
-- The vehicle_documents INSERT RLS still requires has_vehicle_access(
-- vehicle_id, 'add_record'), so an upload without a matching row insert
-- becomes an orphan that nobody can read (the SELECT policy above
-- requires a vehicle_documents row pointing at the path). Orphans are
-- janitor-cleanable later; they're not a security exposure.
