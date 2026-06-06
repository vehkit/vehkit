-- =====================================================================
-- Allow doc_type='auto' on vehicle_documents
-- =====================================================================
-- The new upload flow stops asking the user "what is this document?".
-- Every fresh upload comes in as doc_type='auto'. The extraction
-- pipeline classifies it via vision and may promote it to one of the
-- existing enum values when confidence is high; otherwise it stays
-- 'auto' and the detected type lives inside extracted_data.
--
-- We drop the original CHECK and recreate it with 'auto' added rather
-- than dropping the constraint entirely — keeps the column shape
-- self-documenting and protects against typos from any future caller.
-- =====================================================================

alter table public.vehicle_documents
  drop constraint if exists vehicle_documents_doc_type_check;

alter table public.vehicle_documents
  add constraint vehicle_documents_doc_type_check
  check (doc_type in (
    'auto',              -- uploaded via the no-question FAB flow
    'mulkiya',
    'insurance_policy',
    'driving_licence',
    'noc',
    'pollution_test',
    'service_history',
    'other'
  ));
