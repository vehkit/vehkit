-- =====================================================================
-- SECURITY DEFINER RPCs for vehicle owner to confirm/reject workshop entries
--
-- Why: the RLS policy "owner_updates_own_records" only allows UPDATEs on
--      service_records where attestation IN ('owner', 'receipt'). Workshop
--      entries (attestation = 'workshop') are blocked from owner UPDATE,
--      which silently failed both the confirm and the new reject flows.
--
--      We DON'T want to widen that policy to workshop records — it would
--      let the owner mutate ANY field on those records (cost, service_type,
--      odometer, etc.), undermining the workshop's attestation integrity.
--
--      Instead: two narrow SECURITY DEFINER functions that perform the
--      ownership check, validate attestation, and write only the specific
--      timestamp column they're responsible for.
-- =====================================================================

create or replace function public.confirm_service_record(p_record_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_attestation text;
  v_vehicle_id uuid;
  v_rejected_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  -- FOR UPDATE locks the service_records row for the txn — closes the
  -- race between simultaneous confirm/reject calls on the same record.
  select v.owner_id, sr.attestation, sr.vehicle_id, sr.rejected_at
    into v_owner, v_attestation, v_vehicle_id, v_rejected_at
  from public.service_records sr
  join public.vehicles v on v.id = sr.vehicle_id
  where sr.id = p_record_id
  for update of sr;

  if v_owner is null then
    raise exception 'record_not_found' using errcode = 'P0002';
  end if;
  if v_owner <> auth.uid() then
    raise exception 'not_vehicle_owner' using errcode = '42501';
  end if;
  if v_attestation <> 'workshop' then
    raise exception 'not_workshop_record' using errcode = '22023';
  end if;

  update public.service_records
    set confirmed_at = now(),
        -- Confirming a previously rejected record clears rejection
        rejected_at = null
  where id = p_record_id;

  return v_vehicle_id;
end;
$$;

create or replace function public.reject_service_record(p_record_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_attestation text;
  v_vehicle_id uuid;
  v_confirmed_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  -- FOR UPDATE on sr — race-safe under concurrent confirm/reject
  select v.owner_id, sr.attestation, sr.vehicle_id, sr.confirmed_at
    into v_owner, v_attestation, v_vehicle_id, v_confirmed_at
  from public.service_records sr
  join public.vehicles v on v.id = sr.vehicle_id
  where sr.id = p_record_id
  for update of sr;

  if v_owner is null then
    raise exception 'record_not_found' using errcode = 'P0002';
  end if;
  if v_owner <> auth.uid() then
    raise exception 'not_vehicle_owner' using errcode = '42501';
  end if;
  if v_attestation <> 'workshop' then
    raise exception 'not_workshop_record' using errcode = '22023';
  end if;
  if v_confirmed_at is not null then
    raise exception 'already_confirmed' using errcode = '22023';
  end if;

  update public.service_records
    set rejected_at = now()
  where id = p_record_id;

  return v_vehicle_id;
end;
$$;

grant execute on function public.confirm_service_record(uuid) to authenticated;
grant execute on function public.reject_service_record(uuid) to authenticated;

notify pgrst, 'reload schema';
