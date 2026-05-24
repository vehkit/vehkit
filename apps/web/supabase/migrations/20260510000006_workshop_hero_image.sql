-- =====================================================================
-- Workshop hero image — the photo that shows on /workshops listing
-- cards and the public /w/[slug] profile.
--
-- We deliberately separate this from `logo_url`:
--   - logo_url: small square brand mark (used in tight UI like nav pills,
--     small avatars, future favicon use)
--   - hero_image_url: large rectangular photo (the "PF property card"
--     photo on directory listings)
--
-- Files live in the existing public 'service-files' bucket under
-- workshops/{workshop_id}/hero-*.{ext}. Bucket already has the right
-- read/write policies (public read, authenticated write) so no new
-- storage policies needed.
--
-- The set_workshop_hero RPC validates membership via SECURITY DEFINER
-- before writing the column — same pattern as set_trade_license.
-- =====================================================================

alter table public.workshops
  add column if not exists hero_image_url text;

create or replace function public.set_workshop_hero(
  p_workshop_id uuid,
  p_url text
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.workshop_members
    where workshop_id = p_workshop_id and user_id = v_user
  ) then
    raise exception 'not_workshop_member' using errcode = '42501';
  end if;

  update public.workshops
    set hero_image_url = p_url
  where id = p_workshop_id;

  return p_url;
end;
$$;

grant execute on function public.set_workshop_hero(uuid, text)
  to authenticated;

-- =====================================================================
-- Directory RPC: include hero_image_url in the projection so the
-- /workshops listing can render it without a second round-trip.
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
