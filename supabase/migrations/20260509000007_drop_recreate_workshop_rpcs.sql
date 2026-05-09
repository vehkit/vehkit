-- =====================================================================
-- Postgres rejects CREATE OR REPLACE that changes a function's return
-- signature. The 0005 fix tried to change `year int` → `year smallint`
-- via CREATE OR REPLACE, which fails. Drop and recreate cleanly.
-- =====================================================================

drop function if exists public.workshop_customer_vehicles(uuid);
drop function if exists public.workshop_upcoming_visits(uuid, int);

-- ---------------------------------------------------------------------
create function public.workshop_customer_vehicles(p_workshop_id uuid)
returns table (
  vehicle_id uuid,
  make text,
  model text,
  year smallint,
  color text,
  nickname text,
  plate_number text,
  plate_emirate text,
  current_odometer integer,
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
      coalesce(vs.total_visits, 0::bigint),
      coalesce(vs.total_spent, 0::numeric),
      coalesce(ps.pending_count, 0::bigint),
      (orem.v_id is not null),
      coalesce(v.allow_workshop_outreach, false)
    from last_records lr
    join public.vehicles v on v.id = lr.v_id
    left join visit_stats vs on vs.v_id = lr.v_id
    left join pending_stats ps on ps.v_id = lr.v_id
    left join open_reminders orem on orem.v_id = lr.v_id
    order by lr.service_date desc, lr.created_at desc;
end;
$$;

grant execute on function public.workshop_customer_vehicles(uuid) to authenticated;

-- ---------------------------------------------------------------------
create function public.workshop_upcoming_visits(
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
  current_odometer integer,
  reminder_type text,
  due_date date,
  due_at_km integer,
  km_remaining integer,
  days_remaining integer,
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
          then (r.due_at_km - v.current_odometer)
        else null
      end,
      case
        when r.due_date is not null then (r.due_date - current_date)
        else null
      end,
      (
        (r.due_date is not null and r.due_date < current_date)
        or (
          r.due_at_km is not null
          and v.current_odometer is not null
          and r.due_at_km <= v.current_odometer
        )
      ),
      coalesce(v.allow_workshop_outreach, false),
      (r.suggested_by_workshop_id = p_workshop_id)
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
      ((r.due_date is not null and r.due_date < current_date)
        or (r.due_at_km is not null and v.current_odometer is not null and r.due_at_km <= v.current_odometer)) desc,
      r.due_date asc nulls last;
end;
$$;

grant execute on function public.workshop_upcoming_visits(uuid, int) to authenticated;

notify pgrst, 'reload schema';
