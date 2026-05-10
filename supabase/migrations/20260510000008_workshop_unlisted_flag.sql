-- =====================================================================
-- workshops.is_unlisted — workshop-controlled opt-out from public surfaces.
--
-- Some real workshops are happy to use Vehkit operationally (verifying
-- service records for their customers) but don't want their name appearing
-- on the marketing site / public directory. Honouring that without forcing
-- them off the platform is the right move.
--
-- Behaviour:
--   - is_unlisted = true → excluded from public_workshop_directory and
--     therefore from / (landing strip + grid) and /workshops (directory).
--   - The /w/[slug] profile page still resolves directly (we don't 404
--     deep links — that would break customer-facing service-record
--     attribution). If we ever want the profile gated too, we add a
--     separate is_private flag.
--   - All operational surfaces (customer's service history, /shop/[code]
--     verify flow, /workshop dashboard) are unaffected.
-- =====================================================================

alter table public.workshops
  add column if not exists is_unlisted boolean not null default false;

comment on column public.workshops.is_unlisted is
  'When true, workshop is excluded from public marketing directory + landing surfaces. Operational flows (service-record attestation, customer history) still work.';

-- =====================================================================
-- Update public_workshop_directory to honour the flag.
-- =====================================================================
drop function if exists public.public_workshop_directory(text, int, int);

create or replace function public.public_workshop_directory(
  p_emirate text default null,
  p_limit int default 50,
  p_offset int default 0
)
returns table (
  id uuid,
  name text,
  slug text,
  emirate text,
  verification_tier text,
  logo_url text,
  hero_image_url text,
  total_entries bigint,
  avg_rating numeric,
  review_count bigint
)
language sql
security definer
stable
set search_path = public
as $$
  select
    w.id,
    w.name,
    w.slug,
    w.emirate,
    w.verification_tier,
    w.logo_url,
    w.hero_image_url,
    coalesce((
      select count(*)::bigint from public.service_records sr where sr.workshop_id = w.id
    ), 0) as total_entries,
    coalesce((
      select round(avg(rating)::numeric, 2) from public.workshop_reviews wr where wr.workshop_id = w.id
    ), 0) as avg_rating,
    coalesce((
      select count(*)::bigint from public.workshop_reviews wr where wr.workshop_id = w.id
    ), 0) as review_count
  from public.workshops w
  where w.is_unlisted = false
    and (p_emirate is null or w.emirate = p_emirate)
  order by
    case w.verification_tier when 'gold' then 1 when 'silver' then 2 else 3 end,
    coalesce((select count(*) from public.service_records sr where sr.workshop_id = w.id), 0) desc,
    w.name
  limit p_limit
  offset p_offset;
$$;

grant execute on function public.public_workshop_directory(text, int, int)
  to anon, authenticated;

-- =====================================================================
-- Honour the existing request: ASM German Auto Garage opted out.
-- Idempotent — safe to re-run.
-- =====================================================================
update public.workshops
  set is_unlisted = true
  where name ilike 'ASM German Auto Garage';

notify pgrst, 'reload schema';
