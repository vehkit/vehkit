-- =====================================================================
-- SECURITY DEFINER RPC: workshop members attach photos to a service record
--
-- Why: the service_files INSERT policy `uploader_inserts_files` requires
--      `has_vehicle_access(vehicle_id, 'add_record')`. Workshop members
--      who submitted a service entry via /shop/[code] do NOT have a
--      vehicle_access grant — so direct INSERT is RLS-blocked.
--
--      We trust them enough to write the service_record (via the
--      SECURITY DEFINER redeem_workshop_code RPC). This function is the
--      file-row analogue: it validates that the caller is either the
--      record's creator OR a member of the workshop the record is
--      attributed to, then inserts the file row.
--
--      The actual file BYTES live in the 'service-files' storage bucket
--      and are gated by bucket policies. This RPC only authorises the
--      service_files row that points to those bytes.
-- =====================================================================

create or replace function public.add_service_record_photo(
  p_record_id uuid,
  p_storage_path text,
  p_file_type text,
  p_file_size_bytes bigint
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_record_workshop uuid;
  v_record_vehicle uuid;
  v_record_creator uuid;
  v_record_attestation text;
  v_file_id uuid;
begin
  if v_caller is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if p_storage_path is null or length(p_storage_path) = 0 then
    raise exception 'invalid_storage_path' using errcode = '22023';
  end if;

  select sr.workshop_id, sr.vehicle_id, sr.created_by, sr.attestation
    into v_record_workshop, v_record_vehicle, v_record_creator, v_record_attestation
  from public.service_records sr
  where sr.id = p_record_id;

  if v_record_vehicle is null then
    raise exception 'record_not_found' using errcode = 'P0002';
  end if;
  if v_record_attestation <> 'workshop' then
    raise exception 'not_workshop_record' using errcode = '22023';
  end if;

  -- Authorisation: caller must be either the record's original creator
  -- (the workshop member who submitted via /shop/[code]) OR an active
  -- member of the workshop the record is attributed to.
  if v_caller <> v_record_creator
     and (
       v_record_workshop is null
       or not public.is_workshop_member(v_record_workshop)
     )
  then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  insert into public.service_files (
    service_record_id,
    vehicle_id,
    storage_path,
    file_type,
    file_size_bytes,
    uploaded_by
  ) values (
    p_record_id,
    v_record_vehicle,
    p_storage_path,
    p_file_type,
    p_file_size_bytes,
    v_caller
  )
  returning id into v_file_id;

  return v_file_id;
end;
$$;

grant execute on function public.add_service_record_photo(uuid, text, text, bigint)
  to authenticated;

notify pgrst, 'reload schema';
