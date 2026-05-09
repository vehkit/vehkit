-- =====================================================================
-- Workshop owner dashboard — comprehensive data RPCs.
-- Membership-gated; no owner identity exposed.
-- =====================================================================

create or replace function public.workshop_full_stats(p_workshop_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
#variable_conflict use_column
declare
  v_member boolean;
  v_total_entries bigint;
  v_unique_cars bigint;
  v_repeat_cars bigint;
  v_total_revenue numeric;
  v_avg_ticket numeric;
  v_entries_last_30 bigint;
  v_entries_prev_30 bigint;
  v_revenue_last_30 numeric;
  v_revenue_prev_30 numeric;
  v_entries_last_7 bigint;
  v_pending_count bigint;
  v_upcoming_30 bigint;
  v_overdue_on_serviced bigint;
  v_review_count bigint;
  v_avg_rating numeric;
  v_quality_avg numeric;
  v_value_avg numeric;
  v_timeliness_avg numeric;
  v_directory_rank int;
  v_directory_total int;
  v_emirate text;
  v_tier text;
  v_silver_progress numeric;
  v_gold_progress numeric;
begin
  -- Caller is workshop member?
  select exists (
    select 1 from public.workshop_members
    where workshop_id = p_workshop_id and user_id = auth.uid()
  ) into v_member;
  if not v_member then return null; end if;

  -- Workshop meta (emirate + tier)
  select w.emirate, w.verification_tier into v_emirate, v_tier
  from public.workshops w where w.id = p_workshop_id;

  -- Service stats (overall)
  select
    count(*),
    count(distinct vehicle_id),
    coalesce(sum(cost_aed), 0)::numeric,
    coalesce(round(avg(cost_aed)::numeric, 2), 0)
  into v_total_entries, v_unique_cars, v_total_revenue, v_avg_ticket
  from public.service_records
  where workshop_id = p_workshop_id;

  -- Repeat cars (cars with 2+ visits)
  select count(*)
  into v_repeat_cars
  from (
    select vehicle_id
    from public.service_records
    where workshop_id = p_workshop_id
    group by vehicle_id
    having count(*) >= 2
  ) x;

  -- 30-day windows
  select
    count(*) filter (where created_at >= now() - interval '30 days'),
    count(*) filter (where created_at >= now() - interval '60 days'
                       and created_at < now() - interval '30 days'),
    coalesce(sum(cost_aed) filter (where created_at >= now() - interval '30 days'), 0)::numeric,
    coalesce(sum(cost_aed) filter (where created_at >= now() - interval '60 days'
                                     and created_at < now() - interval '30 days'), 0)::numeric,
    count(*) filter (where created_at >= now() - interval '7 days')
  into v_entries_last_30, v_entries_prev_30, v_revenue_last_30, v_revenue_prev_30, v_entries_last_7
  from public.service_records
  where workshop_id = p_workshop_id;

  -- Pending (within 24h)
  select count(*)
  into v_pending_count
  from public.service_records
  where workshop_id = p_workshop_id
    and attestation = 'workshop'
    and created_at > now() - interval '24 hours';

  -- Upcoming + overdue on serviced cars
  select
    count(*) filter (where r.due_date is not null and r.due_date <= current_date + interval '30 days' and not (r.due_date < current_date)),
    count(*) filter (where r.due_date is not null and r.due_date < current_date)
  into v_upcoming_30, v_overdue_on_serviced
  from public.reminders r
  where r.status = 'open'
    and exists (
      select 1 from public.service_records sr
      where sr.vehicle_id = r.vehicle_id and sr.workshop_id = p_workshop_id
    );

  -- Reviews (overall + multi-axis)
  select
    count(*),
    coalesce(round(avg(rating)::numeric, 2), 0),
    case when count(quality_rating) > 0 then round(avg(quality_rating)::numeric, 2) else null end,
    case when count(value_rating) > 0 then round(avg(value_rating)::numeric, 2) else null end,
    case when count(timeliness_rating) > 0 then round(avg(timeliness_rating)::numeric, 2) else null end
  into v_review_count, v_avg_rating, v_quality_avg, v_value_avg, v_timeliness_avg
  from public.workshop_reviews
  where workshop_id = p_workshop_id;

  -- Directory rank (within emirate, by entries desc)
  if v_emirate is not null then
    with ranked as (
      select
        w.id,
        rank() over (
          order by
            case w.verification_tier when 'gold' then 1 when 'silver' then 2 else 3 end,
            (select count(*) from public.service_records sr where sr.workshop_id = w.id) desc
        ) as r,
        count(*) over () as total
      from public.workshops w
      where w.emirate = v_emirate
    )
    select r, total into v_directory_rank, v_directory_total
    from ranked where id = p_workshop_id;
  end if;

  -- Tier progress (rough)
  -- Silver: 10+ entries + license
  -- Gold:   100+ entries + 4.5+ rating + 5+ reviews + license
  v_silver_progress := least(100, (v_total_entries::numeric / 10.0) * 100);
  v_gold_progress := least(
    100,
    (v_total_entries::numeric / 100.0 * 50)
    + (least(v_avg_rating, 5) / 4.5 * 30)
    + (least(v_review_count, 5)::numeric / 5.0 * 20)
  );

  return jsonb_build_object(
    'tier', v_tier,
    'emirate', v_emirate,
    'total_entries', v_total_entries,
    'unique_cars', v_unique_cars,
    'repeat_cars', v_repeat_cars,
    'repeat_rate_pct', case when v_unique_cars > 0
                              then round(v_repeat_cars::numeric / v_unique_cars * 100, 1)
                              else 0 end,
    'total_revenue', v_total_revenue,
    'avg_ticket', v_avg_ticket,
    'entries_last_30', v_entries_last_30,
    'entries_prev_30', v_entries_prev_30,
    'entries_30d_delta_pct', case
      when v_entries_prev_30 > 0
        then round((v_entries_last_30 - v_entries_prev_30)::numeric / v_entries_prev_30 * 100, 1)
      when v_entries_last_30 > 0 then 100
      else 0
    end,
    'revenue_last_30', v_revenue_last_30,
    'revenue_prev_30', v_revenue_prev_30,
    'revenue_30d_delta_pct', case
      when v_revenue_prev_30 > 0
        then round((v_revenue_last_30 - v_revenue_prev_30) / v_revenue_prev_30 * 100, 1)
      when v_revenue_last_30 > 0 then 100
      else 0
    end,
    'entries_last_7', v_entries_last_7,
    'pending_count', v_pending_count,
    'upcoming_30', v_upcoming_30,
    'overdue_on_serviced', v_overdue_on_serviced,
    'review_count', v_review_count,
    'avg_rating', v_avg_rating,
    'quality_avg', v_quality_avg,
    'value_avg', v_value_avg,
    'timeliness_avg', v_timeliness_avg,
    'directory_rank', v_directory_rank,
    'directory_total', v_directory_total,
    'silver_progress_pct', round(v_silver_progress, 0),
    'gold_progress_pct', round(v_gold_progress, 0)
  );
end;
$$;

grant execute on function public.workshop_full_stats(uuid) to authenticated;

-- =====================================================================
-- workshop_weekly_series — 12-week trend of entries + revenue
-- =====================================================================
create or replace function public.workshop_weekly_series(
  p_workshop_id uuid,
  p_weeks int default 12
)
returns table (
  week_start date,
  entries_count bigint,
  revenue numeric,
  unique_cars bigint
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
    with weeks as (
      select generate_series(
        date_trunc('week', current_date - (p_weeks - 1) * interval '1 week')::date,
        date_trunc('week', current_date)::date,
        interval '1 week'
      )::date as wk_start
    ),
    bucket as (
      select
        date_trunc('week', sr.created_at)::date as wk_start,
        count(*)::bigint as entries_count,
        coalesce(sum(sr.cost_aed), 0)::numeric as revenue,
        count(distinct sr.vehicle_id)::bigint as unique_cars
      from public.service_records sr
      where sr.workshop_id = p_workshop_id
        and sr.created_at >= now() - (p_weeks * interval '1 week')
      group by 1
    )
    select
      w.wk_start,
      coalesce(b.entries_count, 0),
      coalesce(b.revenue, 0),
      coalesce(b.unique_cars, 0)
    from weeks w
    left join bucket b on b.wk_start = w.wk_start
    order by w.wk_start asc;
end;
$$;

grant execute on function public.workshop_weekly_series(uuid, int) to authenticated;

-- =====================================================================
-- workshop_service_breakdown — top service types by count + revenue
-- =====================================================================
create or replace function public.workshop_service_breakdown(p_workshop_id uuid)
returns table (
  service_type text,
  count bigint,
  revenue numeric,
  avg_cost numeric
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
      sr.service_type,
      count(*)::bigint,
      coalesce(sum(sr.cost_aed), 0)::numeric,
      coalesce(round(avg(sr.cost_aed)::numeric, 0), 0) as avg_cost
    from public.service_records sr
    where sr.workshop_id = p_workshop_id
    group by sr.service_type
    order by count(*) desc, coalesce(sum(sr.cost_aed), 0) desc
    limit 10;
end;
$$;

grant execute on function public.workshop_service_breakdown(uuid) to authenticated;

-- =====================================================================
-- workshop_top_customers — top vehicles by visit count + total spent
-- =====================================================================
create or replace function public.workshop_top_customers(
  p_workshop_id uuid,
  p_limit int default 5
)
returns table (
  vehicle_id uuid,
  make text,
  model text,
  nickname text,
  plate_number text,
  plate_emirate text,
  visit_count bigint,
  total_spent numeric,
  last_visit date
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
      v.id,
      v.make,
      v.model,
      v.nickname,
      v.plate_number,
      v.plate_emirate,
      count(*)::bigint as visit_count,
      coalesce(sum(sr.cost_aed), 0)::numeric as total_spent,
      max(sr.service_date) as last_visit
    from public.service_records sr
    join public.vehicles v on v.id = sr.vehicle_id
    where sr.workshop_id = p_workshop_id
    group by v.id, v.make, v.model, v.nickname, v.plate_number, v.plate_emirate
    order by count(*) desc, coalesce(sum(sr.cost_aed), 0) desc
    limit p_limit;
end;
$$;

grant execute on function public.workshop_top_customers(uuid, int) to authenticated;

-- =====================================================================
-- workshop_recent_reviews — last N reviews on this workshop, with multi-axis
-- =====================================================================
create or replace function public.workshop_recent_reviews(
  p_workshop_id uuid,
  p_limit int default 5
)
returns table (
  id uuid,
  rating smallint,
  quality_rating smallint,
  value_rating smallint,
  timeliness_rating smallint,
  comment text,
  created_at timestamptz
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
      wr.id,
      wr.rating,
      wr.quality_rating,
      wr.value_rating,
      wr.timeliness_rating,
      wr.comment,
      wr.created_at
    from public.workshop_reviews wr
    where wr.workshop_id = p_workshop_id
    order by wr.created_at desc
    limit p_limit;
end;
$$;

grant execute on function public.workshop_recent_reviews(uuid, int) to authenticated;

notify pgrst, 'reload schema';
