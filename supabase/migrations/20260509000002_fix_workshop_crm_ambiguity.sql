-- =====================================================================
-- Fix: column "vehicle_id" is ambiguous · 42702
--
-- The RETURNS TABLE output params collide with column names inside the
-- CTE queries. plpgsql defaults to ambiguous-error; we want column refs
-- to win. `#variable_conflict use_column` does exactly that.
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
#variable_conflict use_column
declare v_member boolean;
begin
  select exists (
    select 1 from public.workshop_members
    where workshop_id = p_workshop_id and user_id = auth.uid()
  ) into v_member;
  if not v_member then return; end if;

  return query
    with last_records as (
      select distinct on (sr.vehicle_id)
        sr.vehicle_id as v_id,
        sr.service_date,
        sr.service_type,
        sr.created_at
      from public.service_records sr
      where sr.workshop_id = p_workshop_id
      order by sr.vehicle_id, sr.service_date desc, sr.created_at desc
    ),
    visit_stats as (
      select
        sr.vehicle_id as v_id,
        count(*)::bigint as total_visits,
        coalesce(sum(sr.cost_aed), 0)::numeric as total_spent
      from public.service_records sr
      where sr.workshop_id = p_workshop_id
      group by sr.vehicle_id
    ),
    pending_stats as (
      select
        sr.vehicle_id as v_id,
        count(*)::bigint as pending_count
      from public.service_records sr
      where sr.workshop_id = p_workshop_id
        and sr.attestation = 'workshop'
        and sr.created_at > now() - interval '24 hours'
      group by sr.vehicle_id
    ),
    open_reminders as (
      select distinct r.vehicle_id as v_id
      from public.reminders r
      where r.status = 'open'
        and (
          (r.due_date is not null and r.due_date <= current_date + interval '60 days')
          or (r.due_at_km is not null)
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
      (orem.v_id is not null) as has_due_reminder,
      v.allow_workshop_outreach
    from last_records lr
    join public.vehicles v on v.id = lr.v_id
    left join visit_stats vs on vs.v_id = lr.v_id
    left join pending_stats ps on ps.v_id = lr.v_id
    left join open_reminders orem on orem.v_id = lr.v_id
    order by lr.service_date desc, lr.created_at desc;
end;
$$;

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
#variable_conflict use_column
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
        when r.due_date is not null then (r.due_date - current_date)::int
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
#variable_conflict use_column
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

notify pgrst, 'reload schema';
