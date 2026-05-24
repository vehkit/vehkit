-- =====================================================================
-- Extend public_workshop_directory to return logo_url + tier-aware
-- ordering hint, so the public /workshops page can render avatars and
-- match the PF brand list-item rhythm.
--
-- Postgres requires drop-then-recreate for functions whose return-type
-- shape changes (we're adding a column to the returned table).
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
  where (p_emirate is null or w.emirate = p_emirate)
  order by
    case w.verification_tier when 'gold' then 1 when 'silver' then 2 else 3 end,
    coalesce((select count(*) from public.service_records sr where sr.workshop_id = w.id), 0) desc,
    w.name
  limit p_limit
  offset p_offset;
$$;

grant execute on function public.public_workshop_directory(text, int, int)
  to anon, authenticated;

notify pgrst, 'reload schema';
