-- =====================================================================
-- Vehicle document files — multi-file documents.
--
-- The mulkiya has a front and a back. Insurance policies arrive as
-- two-page PDFs or scattered scans. Service contracts come in multiple
-- attachments. The original vehicle_documents shape (one row = one file)
-- forced users into "Mulkiya — front" and a separate "Mulkiya — back" as
-- different documents, which is wrong: that's one document, two files.
--
-- This migration introduces a child table `vehicle_document_files` that
-- holds the individual files. `vehicle_documents` becomes the logical
-- document (a Mulkiya), the child rows are the actual files (front, back).
--
-- The legacy `storage_path` / `file_type` / `file_size_bytes` columns on
-- vehicle_documents stay for backward compatibility — we backfill the
-- existing single-file docs into the child table and treat the parent
-- columns as a denormalised "primary file" pointer. A follow-up cleanup
-- can drop them once the rest of the app reads exclusively from the
-- child table.
-- =====================================================================

create table if not exists public.vehicle_document_files (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null
    references public.vehicle_documents(id) on delete cascade,
  vehicle_id uuid not null
    references public.vehicles(id) on delete cascade,
  storage_path text not null,
  file_type text,
  file_size_bytes bigint,
  -- Display order within the document. 0 = first file the user uploaded
  -- (typically the "front" of the mulkiya); enforced by the unique index
  -- below so two files in the same document can't share a slot.
  position smallint not null default 0,
  uploaded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_vehicle_document_files_document
  on public.vehicle_document_files(document_id);
create index if not exists idx_vehicle_document_files_vehicle
  on public.vehicle_document_files(vehicle_id);
create unique index if not exists ux_vehicle_document_files_position
  on public.vehicle_document_files(document_id, position);

-- =====================================================================
-- Backfill — every existing vehicle_documents row with a storage_path
-- gets a corresponding child file row at position 0.
-- =====================================================================
insert into public.vehicle_document_files (
  document_id, vehicle_id, storage_path, file_type, file_size_bytes,
  position, uploaded_by, created_at
)
select
  d.id, d.vehicle_id, d.storage_path, d.file_type, d.file_size_bytes,
  0, d.uploaded_by, d.created_at
from public.vehicle_documents d
where d.storage_path is not null
  and not exists (
    select 1 from public.vehicle_document_files f where f.document_id = d.id
  );

-- =====================================================================
-- RLS — files inherit access from their parent document.
-- =====================================================================
alter table public.vehicle_document_files enable row level security;

create policy "owners_read_document_files" on public.vehicle_document_files
  for select using (
    exists (
      select 1 from public.vehicle_documents d
      where d.id = vehicle_document_files.document_id
        and public.has_vehicle_access(d.vehicle_id, 'view')
    )
  );

create policy "owners_insert_document_files" on public.vehicle_document_files
  for insert with check (
    public.has_vehicle_access(vehicle_id, 'add_record')
    and uploaded_by = auth.uid()
    and exists (
      select 1 from public.vehicle_documents d
      where d.id = document_id and d.vehicle_id = vehicle_document_files.vehicle_id
    )
  );

create policy "owners_delete_document_files" on public.vehicle_document_files
  for delete using (
    exists (
      select 1 from public.vehicle_documents d
      where d.id = vehicle_document_files.document_id
        and public.has_vehicle_access(d.vehicle_id, 'full')
    )
  );

notify pgrst, 'reload schema';
