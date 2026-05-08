-- =====================================================================
-- Owner approval window for workshop-attested service entries.
--
-- Workshop entries are immutable after 24 hours.
-- Within the 24-hour window, the owner can retract (delete) them.
-- =====================================================================

-- DELETE policy on service_records was missing. Add it now with the
-- approval-window logic baked in.
create policy "owner_deletes_records_with_window"
  on public.service_records for delete
  using (
    exists (
      select 1 from public.vehicles
      where id = vehicle_id and owner_id = auth.uid()
    )
    and (
      attestation in ('owner', 'receipt')
      or (
        attestation = 'workshop'
        and created_at > now() - interval '24 hours'
      )
    )
  );
