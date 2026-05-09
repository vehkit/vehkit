-- =====================================================================
-- Public platform stats — anonymous-readable aggregate numbers for the
-- landing page. SECURITY DEFINER so it bypasses RLS on the underlying
-- tables. Returns no PII — only headline counts.
-- =====================================================================

create or replace function public.public_platform_stats()
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  select jsonb_build_object(
    'total_vehicles', (select count(*) from public.vehicles)::bigint,
    'total_entries', (select count(*) from public.service_records)::bigint,
    'verified_entries', (
      select count(*) from public.service_records where attestation = 'workshop'
    )::bigint,
    'total_workshops', (select count(*) from public.workshops)::bigint,
    'verified_workshops', (
      select count(*) from public.workshops
      where verification_tier in ('silver', 'gold')
    )::bigint,
    'gold_workshops', (
      select count(*) from public.workshops where verification_tier = 'gold'
    )::bigint,
    'total_emirates_covered', (
      select count(distinct emirate) from public.workshops
      where emirate is not null
    )::bigint
  );
$$;

grant execute on function public.public_platform_stats() to anon, authenticated;

notify pgrst, 'reload schema';
