-- =====================================================================
-- Helpers for workshop members to see their own workshop's stats.
--
-- Workshop members shouldn't see customer service records by default
-- (RLS protects owner data), but they CAN see aggregate counts of
-- entries that name them.
-- =====================================================================

-- Allow workshop members to read service_records where workshop_id matches their workshop
create policy "workshop members read own workshop records"
  on public.service_records for select
  using (
    workshop_id is not null
    and public.is_workshop_member(workshop_id)
  );

-- Helper: returns stats for a workshop the caller belongs to.
-- Uses workshop_name_freetext fuzzy-match for entries created via /shop
-- before the workshop was claimed.
create or replace function public.workshop_stats(p_workshop_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_member boolean;
  v_workshop_name text;
  v_total bigint;
  v_unique_vehicles bigint;
  v_total_revenue numeric;
begin
  -- Caller must be a member of this workshop
  select exists (
    select 1 from public.workshop_members
    where workshop_id = p_workshop_id and user_id = auth.uid()
  ) into v_member;

  if not v_member then
    return null;
  end if;

  select name into v_workshop_name from public.workshops where id = p_workshop_id;

  -- Count records explicitly tied to this workshop OR matching the name
  select
    count(*)::bigint,
    count(distinct vehicle_id)::bigint,
    coalesce(sum(cost_aed), 0)::numeric
  into v_total, v_unique_vehicles, v_total_revenue
  from public.service_records
  where (workshop_id = p_workshop_id)
     or (workshop_id is null and lower(workshop_name_freetext) = lower(v_workshop_name));

  return jsonb_build_object(
    'total_entries', v_total,
    'unique_vehicles', v_unique_vehicles,
    'total_revenue_aed', v_total_revenue,
    'workshop_name', v_workshop_name
  );
end;
$$;

grant execute on function public.workshop_stats(uuid) to authenticated;

-- Helper: claim a workshop by name and add caller as owner-member
create or replace function public.claim_workshop(
  p_name text,
  p_emirate text default null,
  p_phone text default null,
  p_email text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_workshop_id uuid;
  v_slug text;
begin
  if v_user is null then
    raise exception 'Not authenticated' using errcode = 'P0001';
  end if;

  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'Workshop name is required' using errcode = 'P0001';
  end if;

  -- Generate a slug
  v_slug := lower(regexp_replace(trim(p_name), '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := trim(both '-' from v_slug);
  if v_slug = '' then
    v_slug := 'workshop';
  end if;
  -- Append short random suffix to avoid collision
  v_slug := v_slug || '-' || lower(substring(md5(random()::text || clock_timestamp()::text) from 1 for 5));

  insert into public.workshops (name, slug, emirate, phone, email)
  values (trim(p_name), v_slug, p_emirate, p_phone, p_email)
  returning id into v_workshop_id;

  insert into public.workshop_members (workshop_id, user_id, role)
  values (v_workshop_id, v_user, 'owner');

  -- Backfill workshop_id on existing free-text entries that name this workshop
  update public.service_records
     set workshop_id = v_workshop_id
   where workshop_id is null
     and lower(workshop_name_freetext) = lower(trim(p_name));

  return v_workshop_id;
end;
$$;

grant execute on function public.claim_workshop(text, text, text, text) to authenticated;
