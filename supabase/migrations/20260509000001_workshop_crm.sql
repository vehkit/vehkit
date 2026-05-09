-- =====================================================================
-- Workshop CRM helpers — give workshops visibility into the cars they've
-- serviced (read-only, privacy-preserving) without exposing owner contact.
--
-- Privacy contract:
--   * Workshops see vehicle context (make, model, plate, year, color)
--   * Workshops never see owner email/phone/full_name
--   * "Suggest reminder" only works when owner opts in via
--     vehicles.allow_workshop_outreach
-- =====================================================================

-- 1. Owner opt-in toggle for workshop outreach
alter table public.vehicles
  add column if not exists allow_workshop_outreach boolean not null default false;

-- 2. Track which workshop suggested a reminder (audit trail + UI badging)
alter table public.reminders
  add column if not exists suggested_by_workshop_id uuid
    references public.workshops(id) on delete set null;

create index if not exists idx_reminders_suggested_by
  on public.reminders(suggested_by_workshop_id)
  where suggested_by_workshop_id is not null;

-- =====================================================================
-- workshop_customer_vehicles — distinct vehicles this workshop has
-- serviced, with last-visit metadata + due-soon flags.
-- =====================================================================
create or replace function public.workshop_customer_vehicles(p_workshop_id uuid)
returns table (
  vehicle_id uuid,
  make text,
  model text,
  year int,
  color text,
  nickname text,
  plate_number text,
  plate_emirate text,
  current_odometer int,
  last_visit_date date,
  last_service_type text,
  total_visits bigint,
  total_spent_aed numeric,
  pending_count bigint,
  has_due_reminder boolean,
  allow_outreach boolean
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_member boolean;
begin
  -- Caller must be a member of this workshop
  select exists (
    select 1 from public.workshop_members
    where workshop_id = p_workshop_id and user_id = auth.uid()
  ) into v_member;
  if not v_member then return; end if;

  return query
    with last_records as (
      select distinct on (vehicle_id)
        vehicle_id, service_date, service_type, created_at
      from public.service_records
      where workshop_id = p_workshop_id
      order by vehicle_id, service_date desc, created_at desc
    ),
    visit_stats as (
      select
        vehicle_id,
        count(*)::bigint as total_visits,
        coalesce(sum(cost_aed), 0)::numeric as total_spent
      from public.service_records
      where workshop_id = p_workshop_id
      group by vehicle_id
    ),
    pending_stats as (
      select
        vehicle_id,
        count(*)::bigint as pending_count
      from public.service_records
      where workshop_id = p_workshop_id
        and attestation = 'workshop'
        and created_at > now() - interval '24 hours'
      group by vehicle_id
    ),
    open_reminders as (
      select distinct vehicle_id
      from public.reminders
      where status = 'open'
        and (
          (due_date is not null and due_date <= current_date + interval '60 days')
          or (due_at_km is not null)
        )
    )
    select
      v.id,
      v.make,
      v.model,
      v.year,
      v.color,
      v.nickname,
      v.plate_number,
      v.plate_emirate,
      v.current_odometer,
      lr.service_date,
      lr.service_type,
      coalesce(vs.total_visits, 0),
      coalesce(vs.total_spent, 0),
      coalesce(ps.pending_count, 0),
      (orem.vehicle_id is not null) as has_due_reminder,
      v.allow_workshop_outreach
    from last_records lr
    join public.vehicles v on v.id = lr.vehicle_id
    left join visit_stats vs on vs.vehicle_id = lr.vehicle_id
    left join pending_stats ps on ps.vehicle_id = lr.vehicle_id
    left join open_reminders orem on orem.vehicle_id = lr.vehicle_id
    order by lr.service_date desc, lr.created_at desc;
end;
$$;

grant execute on function public.workshop_customer_vehicles(uuid) to authenticated;

-- =====================================================================
-- workshop_upcoming_visits — open reminders on cars THIS workshop has
-- serviced, due within N days. Privacy-preserving (no owner identity).
-- =====================================================================
create or replace function public.workshop_upcoming_visits(
  p_workshop_id uuid,
  p_days_ahead int default 30
)
returns table (
  reminder_id uuid,
  vehicle_id uuid,
  make text,
  model text,
  nickname text,
  plate_number text,
  plate_emirate text,
  current_odometer int,
  reminder_type text,
  due_date date,
  due_at_km int,
  km_remaining int,
  days_remaining int,
  is_overdue boolean,
  allow_outreach boolean,
  suggested_by_us boolean
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare v_member boolean;
begin
  select exists (
    select 1 from public.workshop_members
    where workshop_id = p_workshop_id and user_id = auth.uid()
  ) into v_member;
  if not v_member then return; end if;

  return query
    select
      r.id,
      v.id,
      v.make,
      v.model,
      v.nickname,
      v.plate_number,
      v.plate_emirate,
      v.current_odometer,
      r.reminder_type,
      r.due_date,
      r.due_at_km,
      case
        when r.due_at_km is not null and v.current_odometer is not null
          then r.due_at_km - v.current_odometer
        else null
      end as km_remaining,
      case
        when r.due_date is not null
          then (r.due_date - current_date)::int
        else null
      end as days_remaining,
      (
        (r.due_date is not null and r.due_date < current_date)
        or (
          r.due_at_km is not null
          and v.current_odometer is not null
          and r.due_at_km <= v.current_odometer
        )
      ) as is_overdue,
      v.allow_workshop_outreach,
      (r.suggested_by_workshop_id = p_workshop_id) as suggested_by_us
    from public.reminders r
    join public.vehicles v on v.id = r.vehicle_id
    where r.status = 'open'
      and exists (
        select 1 from public.service_records sr
        where sr.vehicle_id = v.id
          and sr.workshop_id = p_workshop_id
      )
      and (
        (r.due_date is not null and r.due_date <= current_date + (p_days_ahead || ' days')::interval)
        or (
          r.due_at_km is not null
          and v.current_odometer is not null
          and (r.due_at_km - v.current_odometer) <= 2000
        )
      )
    order by
      is_overdue desc,
      r.due_date asc nulls last,
      km_remaining asc nulls last;
end;
$$;

grant execute on function public.workshop_upcoming_visits(uuid, int) to authenticated;

-- =====================================================================
-- workshop_pending_entries — entries this workshop logged within last
-- 24h that owner hasn't confirmed/retracted yet.
-- =====================================================================
create or replace function public.workshop_pending_entries(p_workshop_id uuid)
returns table (
  record_id uuid,
  vehicle_id uuid,
  make text,
  model text,
  nickname text,
  plate_number text,
  service_type text,
  service_date date,
  cost_aed numeric,
  created_at timestamptz,
  hours_left int
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare v_member boolean;
begin
  select exists (
    select 1 from public.workshop_members
    where workshop_id = p_workshop_id and user_id = auth.uid()
  ) into v_member;
  if not v_member then return; end if;

  return query
    select
      sr.id,
      v.id,
      v.make,
      v.model,
      v.nickname,
      v.plate_number,
      sr.service_type,
      sr.service_date,
      sr.cost_aed,
      sr.created_at,
      greatest(
        0,
        ceil(extract(epoch from (sr.created_at + interval '24 hours' - now())) / 3600)::int
      ) as hours_left
    from public.service_records sr
    join public.vehicles v on v.id = sr.vehicle_id
    where sr.workshop_id = p_workshop_id
      and sr.attestation = 'workshop'
      and sr.created_at > now() - interval '24 hours'
    order by sr.created_at desc;
end;
$$;

grant execute on function public.workshop_pending_entries(uuid) to authenticated;

-- =====================================================================
-- workshop_suggest_reminder — workshop plants a reminder on a customer
-- vehicle. Owner sees it in their notifications. No direct messaging.
-- Gated by vehicles.allow_workshop_outreach.
-- =====================================================================
create or replace function public.workshop_suggest_reminder(
  p_workshop_id uuid,
  p_vehicle_id uuid,
  p_reminder_type text,
  p_due_date date default null,
  p_due_at_km int default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_member boolean;
  v_outreach_allowed boolean;
  v_serviced boolean;
  v_reminder_id uuid;
begin
  if v_user is null then
    raise exception 'Not authenticated' using errcode = 'P0001';
  end if;

  -- 1. Caller is workshop member
  select exists (
    select 1 from public.workshop_members
    where workshop_id = p_workshop_id and user_id = v_user
  ) into v_member;
  if not v_member then
    raise exception 'Not a member of this workshop' using errcode = 'P0001';
  end if;

  -- 2. Owner has opted in
  select allow_workshop_outreach into v_outreach_allowed
  from public.vehicles where id = p_vehicle_id;
  if v_outreach_allowed is null then
    raise exception 'Vehicle not found' using errcode = 'P0001';
  end if;
  if not v_outreach_allowed then
    raise exception 'Owner has not enabled workshop outreach' using errcode = 'P0001';
  end if;

  -- 3. This workshop has serviced this vehicle before
  select exists (
    select 1 from public.service_records
    where vehicle_id = p_vehicle_id and workshop_id = p_workshop_id
  ) into v_serviced;
  if not v_serviced then
    raise exception 'No service history with this vehicle' using errcode = 'P0001';
  end if;

  -- 4. Need at least one of date or km
  if p_due_date is null and p_due_at_km is null then
    raise exception 'Provide due_date or due_at_km' using errcode = 'P0001';
  end if;

  insert into public.reminders (
    vehicle_id,
    reminder_type,
    due_date,
    due_at_km,
    notes,
    status,
    suggested_by_workshop_id
  ) values (
    p_vehicle_id,
    p_reminder_type,
    p_due_date,
    p_due_at_km,
    p_notes,
    'open',
    p_workshop_id
  )
  returning id into v_reminder_id;

  return v_reminder_id;
end;
$$;

grant execute on function public.workshop_suggest_reminder(uuid, uuid, text, date, int, text)
  to authenticated;

notify pgrst, 'reload schema';
