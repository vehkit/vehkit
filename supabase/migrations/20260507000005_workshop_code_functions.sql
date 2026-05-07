-- =====================================================================
-- Public-callable functions for workshop code preview and redemption.
--
-- These run with SECURITY DEFINER so they don't depend on the calling
-- role having direct table access. Eliminates the service-role-key
-- dependency on the public /shop route.
-- =====================================================================

-- Preview a workshop code — returns the vehicle info for display.
-- Returns empty if code doesn't exist; caller checks used_at / expires_at.
create or replace function public.preview_workshop_code(p_code text)
returns table (
  vehicle_id uuid,
  expires_at timestamptz,
  used_at timestamptz,
  vehicle_make text,
  vehicle_model text,
  vehicle_nickname text,
  vehicle_year smallint,
  vehicle_color text,
  vehicle_plate_number text,
  vehicle_plate_emirate text,
  vehicle_current_odometer integer
)
language sql
security definer
stable
set search_path = public
as $$
  select
    wc.vehicle_id,
    wc.expires_at,
    wc.used_at,
    v.make,
    v.model,
    v.nickname,
    v.year,
    v.color,
    v.plate_number,
    v.plate_emirate,
    v.current_odometer
  from public.workshop_codes wc
  join public.vehicles v on v.id = wc.vehicle_id
  where wc.code = p_code
  limit 1;
$$;

grant execute on function public.preview_workshop_code(text) to anon, authenticated;

-- Atomic redemption — validates the code, inserts the service record,
-- marks the code used, and updates the vehicle odometer.
-- Returns the inserted service_record id.
create or replace function public.redeem_workshop_code(
  p_code text,
  p_workshop_name text,
  p_service_type text,
  p_service_date date,
  p_odometer integer default null,
  p_cost_aed numeric default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code_id uuid;
  v_vehicle_id uuid;
  v_created_by uuid;
  v_record_id uuid;
begin
  -- Look up the code with row lock to prevent race conditions
  select wc.id, wc.vehicle_id, wc.created_by
    into v_code_id, v_vehicle_id, v_created_by
  from public.workshop_codes wc
  where wc.code = p_code
    and wc.used_at is null
    and wc.expires_at > now()
  for update;

  if not found then
    raise exception 'Code is invalid, already used, or expired'
      using errcode = 'P0001';
  end if;

  -- Insert workshop-attested service record
  insert into public.service_records (
    vehicle_id, service_type, service_date, odometer, cost_aed,
    workshop_name_freetext, notes, attestation, created_by
  ) values (
    v_vehicle_id, p_service_type, p_service_date, p_odometer, p_cost_aed,
    p_workshop_name, p_notes, 'workshop', v_created_by
  )
  returning id into v_record_id;

  -- Mark code as used
  update public.workshop_codes
     set used_at = now(),
         used_by_workshop_name = p_workshop_name,
         used_for_record_id = v_record_id
   where id = v_code_id;

  -- Update vehicle odometer if reading provided
  if p_odometer is not null then
    update public.vehicles
       set current_odometer = p_odometer,
           current_odometer_at = now()
     where id = v_vehicle_id;
  end if;

  return v_record_id;
end;
$$;

grant execute on function public.redeem_workshop_code(text, text, text, date, integer, numeric, text) to anon, authenticated;
