-- =====================================================================
-- Scoring system — vehicle passport score + workshop multi-axis ratings.
--
-- Vehicle score (0–100): 4 components
--   * Verification (40 pts): verified entry count + workshop diversity + tier bonus
--   * Compliance (30 pts): completed reminders / (completed + missed)
--   * Consistency (20 pts): services per year of vehicle age
--   * Recency (10 pts): last service within 6mo / 12mo / older
--
-- Workshop score: existing rating stays as primary, plus three optional axes:
--   * quality_rating, value_rating, timeliness_rating (all 1–5, NULL = skipped)
-- =====================================================================

-- 1. Add multi-axis review columns (all optional)
alter table public.workshop_reviews
  add column if not exists quality_rating smallint
    check (quality_rating between 1 and 5),
  add column if not exists value_rating smallint
    check (value_rating between 1 and 5),
  add column if not exists timeliness_rating smallint
    check (timeliness_rating between 1 and 5);

-- =====================================================================
-- compute_vehicle_score — 0-100 with breakdown
-- =====================================================================
create or replace function public.compute_vehicle_score(p_vehicle_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
#variable_conflict use_column
declare
  v_total_records bigint;
  v_workshop_verified bigint;
  v_distinct_workshops bigint;
  v_silver_gold_count bigint;
  v_completed_reminders bigint;
  v_missed_reminders bigint;
  v_open_overdue bigint;
  v_last_service_date date;
  v_vehicle_age_days int;
  v_vehicle_created timestamptz;
  v_verification_pts numeric;
  v_compliance_pts numeric;
  v_consistency_pts numeric;
  v_recency_pts numeric;
  v_score int;
begin
  select created_at into v_vehicle_created
  from public.vehicles where id = p_vehicle_id;
  if v_vehicle_created is null then return null; end if;

  v_vehicle_age_days := greatest(
    1,
    extract(epoch from (now() - v_vehicle_created))::int / 86400
  );

  -- Service stats
  select
    count(*),
    count(*) filter (where attestation = 'workshop' and workshop_id is not null),
    count(distinct workshop_id) filter (where workshop_id is not null),
    max(service_date)
  into v_total_records, v_workshop_verified, v_distinct_workshops, v_last_service_date
  from public.service_records
  where vehicle_id = p_vehicle_id;

  -- Silver/Gold-tier verifications (anti-gaming via tier bonus)
  select count(*)
  into v_silver_gold_count
  from public.service_records sr
  join public.workshops w on w.id = sr.workshop_id
  where sr.vehicle_id = p_vehicle_id
    and w.verification_tier in ('silver', 'gold');

  -- Reminder stats
  select
    count(*) filter (where status = 'done'),
    count(*) filter (where status = 'open' and due_date is not null and due_date < current_date),
    count(*) filter (where status = 'open')
  into v_completed_reminders, v_missed_reminders, v_open_overdue
  from public.reminders
  where vehicle_id = p_vehicle_id;

  -- Insufficient data: no services yet
  if v_total_records = 0 then
    return jsonb_build_object(
      'score', null,
      'verification_pts', 0,
      'compliance_pts', 0,
      'consistency_pts', 0,
      'recency_pts', 0,
      'total_records', 0,
      'workshop_verified', 0,
      'distinct_workshops', 0,
      'silver_gold_count', 0,
      'completed_reminders', 0,
      'missed_reminders', 0,
      'open_overdue', 0,
      'last_service_date', null,
      'vehicle_age_days', v_vehicle_age_days,
      'message', 'No service history yet — score begins after the first verified entry.'
    );
  end if;

  -- Verification (40 pts)
  --   30 pts: linear with verified count, capped at 10 entries (3 pts each)
  --    5 pts: workshop diversity (2 distinct = full)
  --    5 pts: silver/gold tier verifications (3+ = full)
  v_verification_pts :=
    least(30, v_workshop_verified * 3.0)
    + least(5, v_distinct_workshops * 2.5)
    + least(5, v_silver_gold_count * 1.7);

  -- Compliance (30 pts)
  if (v_completed_reminders + v_missed_reminders) = 0 then
    v_compliance_pts := 30; -- nothing to miss yet
  else
    v_compliance_pts := 30.0 *
      v_completed_reminders::numeric /
      (v_completed_reminders + v_missed_reminders)::numeric;
  end if;
  -- Penalty for currently overdue (max 10 pt penalty)
  v_compliance_pts := greatest(0, v_compliance_pts - least(10, v_open_overdue * 2));

  -- Consistency (20 pts) — services per year, 2/year = full
  v_consistency_pts := least(
    20,
    20.0 * (v_total_records::numeric / greatest(1.0, v_vehicle_age_days::numeric / 365.25)) / 2.0
  );

  -- Recency (10 pts)
  if v_last_service_date is null then
    v_recency_pts := 0;
  elsif v_last_service_date >= current_date - interval '6 months' then
    v_recency_pts := 10;
  elsif v_last_service_date >= current_date - interval '12 months' then
    v_recency_pts := 5;
  else
    v_recency_pts := 0;
  end if;

  v_score := round(v_verification_pts + v_compliance_pts + v_consistency_pts + v_recency_pts)::int;
  v_score := least(100, greatest(0, v_score));

  return jsonb_build_object(
    'score', v_score,
    'verification_pts', round(v_verification_pts, 1),
    'compliance_pts', round(v_compliance_pts, 1),
    'consistency_pts', round(v_consistency_pts, 1),
    'recency_pts', round(v_recency_pts, 1),
    'total_records', v_total_records,
    'workshop_verified', v_workshop_verified,
    'distinct_workshops', v_distinct_workshops,
    'silver_gold_count', v_silver_gold_count,
    'completed_reminders', v_completed_reminders,
    'missed_reminders', v_missed_reminders,
    'open_overdue', v_open_overdue,
    'last_service_date', v_last_service_date,
    'vehicle_age_days', v_vehicle_age_days
  );
end;
$$;

grant execute on function public.compute_vehicle_score(uuid) to anon, authenticated;

-- =====================================================================
-- compute_workshop_score — multi-axis breakdown
-- =====================================================================
create or replace function public.compute_workshop_score(p_workshop_id uuid)
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  select jsonb_build_object(
    'overall', coalesce(round(avg(rating)::numeric, 2), 0),
    'quality', case when count(quality_rating) > 0
                  then round(avg(quality_rating)::numeric, 2)
                  else null end,
    'value', case when count(value_rating) > 0
                  then round(avg(value_rating)::numeric, 2)
                  else null end,
    'timeliness', case when count(timeliness_rating) > 0
                  then round(avg(timeliness_rating)::numeric, 2)
                  else null end,
    'total_reviews', count(*)::bigint,
    'with_quality', count(quality_rating)::bigint,
    'with_value', count(value_rating)::bigint,
    'with_timeliness', count(timeliness_rating)::bigint
  )
  from public.workshop_reviews
  where workshop_id = p_workshop_id;
$$;

grant execute on function public.compute_workshop_score(uuid) to anon, authenticated;

-- =====================================================================
-- public_workshop_profile — extend with multi-axis breakdown
-- =====================================================================
create or replace function public.public_workshop_profile(p_slug text)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_workshop record;
  v_total bigint;
  v_unique_vehicles bigint;
  v_avg_rating numeric;
  v_review_count bigint;
  v_quality_avg numeric;
  v_value_avg numeric;
  v_timeliness_avg numeric;
begin
  select id, name, slug, emirate, phone, email, verification_tier, logo_url, created_at
    into v_workshop
  from public.workshops
  where slug = p_slug
  limit 1;

  if not found then return null; end if;

  select count(*)::bigint, count(distinct vehicle_id)::bigint
    into v_total, v_unique_vehicles
  from public.service_records
  where workshop_id = v_workshop.id;

  select
    coalesce(round(avg(rating)::numeric, 2), 0),
    count(*)::bigint,
    case when count(quality_rating) > 0 then round(avg(quality_rating)::numeric, 2) else null end,
    case when count(value_rating) > 0 then round(avg(value_rating)::numeric, 2) else null end,
    case when count(timeliness_rating) > 0 then round(avg(timeliness_rating)::numeric, 2) else null end
  into v_avg_rating, v_review_count, v_quality_avg, v_value_avg, v_timeliness_avg
  from public.workshop_reviews
  where workshop_id = v_workshop.id;

  return jsonb_build_object(
    'id', v_workshop.id,
    'name', v_workshop.name,
    'slug', v_workshop.slug,
    'emirate', v_workshop.emirate,
    'phone', v_workshop.phone,
    'email', v_workshop.email,
    'verification_tier', v_workshop.verification_tier,
    'logo_url', v_workshop.logo_url,
    'member_since', v_workshop.created_at,
    'total_entries', v_total,
    'unique_vehicles', v_unique_vehicles,
    'avg_rating', v_avg_rating,
    'review_count', v_review_count,
    'quality_avg', v_quality_avg,
    'value_avg', v_value_avg,
    'timeliness_avg', v_timeliness_avg
  );
end;
$$;

notify pgrst, 'reload schema';
