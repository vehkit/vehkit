-- =====================================================================
-- Workshop verification tiers — Silver / Gold based on real signals.
--
-- Silver:  ≥3 verified entries  + trade license uploaded
-- Gold:    ≥50 verified entries + avg rating ≥4.5 + trade license
--
-- Tier is auto-evaluated when:
--   1. Workshop uploads/replaces trade license
--   2. New verified entry is created (trigger)
--   3. New review is created (trigger)
--
-- Trade license docs live in a private bucket (workshop-docs).
-- =====================================================================

-- Trade license columns
alter table public.workshops add column if not exists trade_license_url text;
alter table public.workshops add column if not exists trade_license_uploaded_at timestamptz;

-- Private bucket for sensitive workshop documents
insert into storage.buckets (id, name, public)
values ('workshop-docs', 'workshop-docs', false)
on conflict (id) do nothing;

-- Storage policy: only workshop members read their own workshop's docs
create policy "workshop members read own docs"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'workshop-docs'
    and (
      -- path format: workshops/{workshop_id}/trade-license/...
      exists (
        select 1 from public.workshop_members wm
        where wm.user_id = auth.uid()
          and wm.workshop_id::text = (string_to_array(name, '/'))[2]
      )
    )
  );

create policy "workshop members upload own docs"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'workshop-docs'
    and exists (
      select 1 from public.workshop_members wm
      where wm.user_id = auth.uid()
        and wm.workshop_id::text = (string_to_array(name, '/'))[2]
    )
  );

create policy "workshop members delete own docs"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'workshop-docs'
    and exists (
      select 1 from public.workshop_members wm
      where wm.user_id = auth.uid()
        and wm.workshop_id::text = (string_to_array(name, '/'))[2]
    )
  );

-- =====================================================================
-- Tier evaluator — pure function, callable on demand or via triggers
-- =====================================================================
create or replace function public.evaluate_workshop_tier(p_workshop_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_has_license boolean;
  v_entries bigint;
  v_avg_rating numeric;
  v_review_count bigint;
  v_current_tier text;
  v_new_tier text;
begin
  select
    trade_license_url is not null,
    verification_tier
  into v_has_license, v_current_tier
  from public.workshops
  where id = p_workshop_id;

  if not found then return null; end if;

  select count(*)::bigint
    into v_entries
  from public.service_records
  where workshop_id = p_workshop_id;

  select coalesce(avg(rating)::numeric, 0), count(*)::bigint
    into v_avg_rating, v_review_count
  from public.workshop_reviews
  where workshop_id = p_workshop_id;

  -- Tier rules (in descending priority)
  if v_has_license and v_entries >= 50 and v_review_count >= 5 and v_avg_rating >= 4.5 then
    v_new_tier := 'gold';
  elsif v_has_license and v_entries >= 3 then
    v_new_tier := 'silver';
  else
    v_new_tier := 'unverified';
  end if;

  if v_new_tier is distinct from v_current_tier then
    update public.workshops
       set verification_tier = v_new_tier
     where id = p_workshop_id;
  end if;

  return v_new_tier;
end;
$$;

grant execute on function public.evaluate_workshop_tier(uuid) to authenticated;

-- =====================================================================
-- Triggers — re-evaluate tier on relevant events
-- =====================================================================
create or replace function public.trigger_evaluate_workshop_tier()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workshop_id uuid;
begin
  if (TG_TABLE_NAME = 'service_records') then
    v_workshop_id := coalesce(new.workshop_id, old.workshop_id);
  elsif (TG_TABLE_NAME = 'workshop_reviews') then
    v_workshop_id := coalesce(new.workshop_id, old.workshop_id);
  end if;

  if v_workshop_id is not null then
    perform public.evaluate_workshop_tier(v_workshop_id);
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists evaluate_tier_on_record_change on public.service_records;
create trigger evaluate_tier_on_record_change
  after insert or update or delete on public.service_records
  for each row execute function public.trigger_evaluate_workshop_tier();

drop trigger if exists evaluate_tier_on_review_change on public.workshop_reviews;
create trigger evaluate_tier_on_review_change
  after insert or update or delete on public.workshop_reviews
  for each row execute function public.trigger_evaluate_workshop_tier();

-- =====================================================================
-- Set trade license URL — caller must be workshop member
-- =====================================================================
create or replace function public.set_trade_license(
  p_workshop_id uuid,
  p_url text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_new_tier text;
begin
  if v_user is null then
    raise exception 'Not authenticated' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.workshop_members
    where workshop_id = p_workshop_id and user_id = v_user
  ) then
    raise exception 'Not a member of this workshop' using errcode = 'P0001';
  end if;

  update public.workshops
     set trade_license_url = p_url,
         trade_license_uploaded_at = now()
   where id = p_workshop_id;

  -- Re-evaluate tier (license may push us to Silver)
  v_new_tier := public.evaluate_workshop_tier(p_workshop_id);
  return v_new_tier;
end;
$$;

grant execute on function public.set_trade_license(uuid, text) to authenticated;
