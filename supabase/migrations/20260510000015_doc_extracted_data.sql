-- =====================================================================
-- Extracted data on vehicle documents.
--
-- After upload, we run the doc image through Claude vision to pull out
-- structured fields (plate, VIN, make, model, year, expiry). The
-- extracted JSON is stored on the document row alongside an extraction
-- status so the UI can show progress / errors / "ready to apply" state.
--
-- Shape of extracted_data for mulkiya:
--   { vehicle_make: 'Toyota', vehicle_model: 'Land Cruiser',
--     year: 2021, plate_number: '12345', plate_emirate: 'Dubai',
--     vin: 'WBA8E5C58JK391022', expires_at: '2027-05-12' }
--
-- Status lifecycle:
--   null    — never run
--   pending — extraction queued / running
--   ready   — extraction succeeded, data is populated
--   failed  — extraction failed; see extraction_error for message
--   applied — owner clicked "apply to my car" and we synced fields
-- =====================================================================

alter table public.vehicle_documents
  add column if not exists extracted_data jsonb,
  add column if not exists extraction_status text
    check (extraction_status in ('pending', 'ready', 'failed', 'applied')),
  add column if not exists extraction_error text,
  add column if not exists extracted_at timestamptz;

notify pgrst, 'reload schema';
