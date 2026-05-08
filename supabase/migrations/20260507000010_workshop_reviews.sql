-- =====================================================================
-- Workshop reviews — owners rate verified workshop entries.
-- Reviews are public. Aggregate rating drives the verification tier.
-- =====================================================================

create table public.workshop_reviews (
  id uuid primary key default gen_random_uuid(),
  service_record_id uuid not null references public.service_records(id) on delete cascade,
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (service_record_id, created_by)
);

create index idx_reviews_workshop on public.workshop_reviews(workshop_id);
create index idx_reviews_record on public.workshop_reviews(service_record_id);

create trigger reviews_set_updated_at
  before update on public.workshop_reviews
  for each row execute function public.set_updated_at();

alter table public.workshop_reviews enable row level security;

-- Vehicle owner can write reviews for their vehicle's workshop entries
create policy "owner writes reviews" on public.workshop_reviews
  for all using (
    exists (
      select 1 from public.vehicles where id = vehicle_id and owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.vehicles where id = vehicle_id and owner_id = auth.uid()
    )
    and created_by = auth.uid()
  );

-- Public can read reviews (for workshop profiles)
create policy "public reads reviews" on public.workshop_reviews
  for select using (true);

grant select, insert, update, delete on table public.workshop_reviews to authenticated;
grant select on table public.workshop_reviews to anon;

-- =====================================================================
-- Aggregate rating function
-- =====================================================================
create or replace function public.workshop_rating(p_workshop_id uuid)
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  select jsonb_build_object(
    'avg_rating', coalesce(round(avg(rating)::numeric, 2), 0),
    'review_count', count(*)::bigint
  )
  from public.workshop_reviews
  where workshop_id = p_workshop_id;
$$;

grant execute on function public.workshop_rating(uuid) to anon, authenticated;

-- =====================================================================
-- Update public_workshop_profile to include rating
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

  select coalesce(round(avg(rating)::numeric, 2), 0), count(*)::bigint
    into v_avg_rating, v_review_count
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
    'review_count', v_review_count
  );
end;
$$;

-- =====================================================================
-- Update directory to include avg_rating
-- =====================================================================
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
    avg_rating desc nulls last,
    w.created_at desc
  limit p_limit offset p_offset;
$$;

grant execute on function public.public_workshop_directory(text, int, int) to anon, authenticated;

-- =====================================================================
-- Public reviews list for a workshop
-- =====================================================================
create or replace function public.public_workshop_reviews(p_slug text, p_limit int default 20)
returns table (
  rating smallint,
  comment text,
  created_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select wr.rating, wr.comment, wr.created_at
  from public.workshop_reviews wr
  join public.workshops w on w.id = wr.workshop_id
  where w.slug = p_slug
  order by wr.created_at desc
  limit p_limit;
$$;

grant execute on function public.public_workshop_reviews(text, int) to anon, authenticated;
