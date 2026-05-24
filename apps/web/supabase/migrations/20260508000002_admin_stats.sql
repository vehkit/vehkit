-- =====================================================================
-- Admin dashboard stats — SECURITY DEFINER functions for aggregate
-- numbers the admin needs. Not granted to anon/authenticated;
-- service-role-only via the admin Postgres role.
-- =====================================================================

create or replace function public.admin_overview_stats()
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  select jsonb_build_object(
    'total_users', (select count(*) from public.profiles),
    'total_vehicles', (select count(*) from public.vehicles),
    'total_service_records', (select count(*) from public.service_records),
    'workshop_attested_records', (
      select count(*) from public.service_records where attestation = 'workshop'
    ),
    'total_workshops', (select count(*) from public.workshops),
    'verified_workshops', (
      select count(*) from public.workshops where verification_tier in ('silver', 'gold')
    ),
    'gold_workshops', (
      select count(*) from public.workshops where verification_tier = 'gold'
    ),
    'silver_workshops', (
      select count(*) from public.workshops where verification_tier = 'silver'
    ),
    'total_reviews', (select count(*) from public.workshop_reviews),
    'avg_rating', coalesce(
      (select round(avg(rating)::numeric, 2) from public.workshop_reviews), 0
    ),
    'open_reminders', (
      select count(*) from public.reminders where status = 'open'
    ),
    'fleet_orgs', (select count(*) from public.fleet_orgs),
    'workshop_codes_today', (
      select count(*) from public.workshop_codes
       where created_at >= current_date
    ),
    'total_revenue_logged_aed', coalesce(
      (select sum(cost_aed)::numeric from public.service_records),
      0
    ),
    'signups_last_7d', (
      select count(*) from public.profiles where created_at >= now() - interval '7 days'
    ),
    'signups_last_30d', (
      select count(*) from public.profiles where created_at >= now() - interval '30 days'
    ),
    'records_last_7d', (
      select count(*) from public.service_records where created_at >= now() - interval '7 days'
    ),
    'records_last_30d', (
      select count(*) from public.service_records where created_at >= now() - interval '30 days'
    )
  );
$$;

-- Daily signups for last 30 days (for chart)
create or replace function public.admin_daily_signups()
returns table (day date, count bigint)
language sql
security definer
stable
set search_path = public
as $$
  select date_trunc('day', created_at)::date, count(*)::bigint
  from public.profiles
  where created_at >= now() - interval '30 days'
  group by 1
  order by 1;
$$;

create or replace function public.admin_daily_records()
returns table (day date, count bigint)
language sql
security definer
stable
set search_path = public
as $$
  select date_trunc('day', created_at)::date, count(*)::bigint
  from public.service_records
  where created_at >= now() - interval '30 days'
  group by 1
  order by 1;
$$;

-- Service type breakdown
create or replace function public.admin_service_type_breakdown()
returns table (service_type text, count bigint)
language sql
security definer
stable
set search_path = public
as $$
  select service_type, count(*)::bigint
  from public.service_records
  group by service_type
  order by count(*) desc
  limit 10;
$$;

-- Emirate breakdown for workshops
create or replace function public.admin_workshops_by_emirate()
returns table (emirate text, count bigint)
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(emirate, 'Unknown'), count(*)::bigint
  from public.workshops
  group by 1
  order by 2 desc;
$$;

-- Admin: set workshop tier manually (override auto-evaluation)
create or replace function public.admin_set_workshop_tier(p_workshop_id uuid, p_tier text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.workshops
     set verification_tier = p_tier
   where id = p_workshop_id
     and p_tier in ('unverified', 'silver', 'gold');
$$;
