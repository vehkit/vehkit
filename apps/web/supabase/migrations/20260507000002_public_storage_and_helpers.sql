-- =====================================================================
-- Make service-files bucket public-readable (signed paths via random ids
-- still provide obscurity). Inserts remain auth-only.
-- =====================================================================

update storage.buckets set public = true where id = 'service-files';

-- Replace the read policy with a public one
drop policy if exists "auth users read service files" on storage.objects;
create policy "public read service files"
  on storage.objects for select
  using (bucket_id = 'service-files');

-- Allow authenticated users to delete their own uploads
create policy "auth users delete own service files"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'service-files' and owner = auth.uid());
