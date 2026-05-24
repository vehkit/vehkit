-- =====================================================================
-- Public-callable workshop stats — used by the workshop directory and
-- public workshop profile pages.
--
-- Returns aggregate, non-identifying numbers only. No per-vehicle or
-- per-owner data leaks.
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
begin
  select id, name, slug, emirate, phone, email, verification_tier, logo_url, created_at
    into v_workshop
  from public.workshops
  where slug = p_slug
  limit 1;

  if not found then
    return null;
  end if;

  select count(*)::bigint, count(distinct vehicle_id)::bigint
    into v_total, v_unique_vehicles
  from public.service_records
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
    'unique_vehicles', v_unique_vehicles
  );
end;
$$;

grant execute on function public.public_workshop_profile(text) to anon, authenticated;

-- Listing function — paginated workshop directory
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
  total_entries bigint
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
    coalesce((
      select count(*)::bigint
      from public.service_records sr
      where sr.workshop_id = w.id
    ), 0) as total_entries
  from public.workshops w
  where (p_emirate is null or w.emirate = p_emirate)
  order by
    case w.verification_tier when 'gold' then 1 when 'silver' then 2 else 3 end,
    w.created_at desc
  limit p_limit offset p_offset;
$$;

grant execute on function public.public_workshop_directory(text, int, int) to anon, authenticated;
