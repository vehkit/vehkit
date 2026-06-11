-- =====================================================================
-- Security hardening pass (2026-06-11)
--
-- A single consolidated migration that tightens a set of pre-production
-- security gaps found during audit. Each section is marked with -- §N
-- and a one-line rationale. All CREATE OR REPLACE blocks preserve the
-- existing function/policy body verbatim except for the specific
-- hardening change described.
-- =====================================================================


-- §1 vehicle-docs storage INSERT must be path-scoped to a vehicle the
--    uploader owns, so an authenticated user can't write into another
--    owner's vehicles/<id>/docs/ prefix.
drop policy if exists "auth_users_upload_vehicle_docs" on storage.objects;
create policy "auth_users_upload_vehicle_docs"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'vehicle-docs'
    -- Path convention: vehicles/<vehicleId>/docs/<filename>
    -- The 2nd path segment is the vehicle id; uploader must own it.
    and (string_to_array(name, '/'))[2]::uuid in (
      select id from public.vehicles where owner_id = auth.uid()
    )
  );


-- §2 Revoke EXECUTE on privilege-escalation / cron-only functions from
--    public, anon and authenticated. service_role bypasses grants, so
--    cron + server-side admin code keep working; no client can call them.
revoke all on function public.admin_overview_stats() from public, anon, authenticated;
revoke all on function public.admin_daily_signups() from public, anon, authenticated;
revoke all on function public.admin_daily_records() from public, anon, authenticated;
revoke all on function public.admin_service_type_breakdown() from public, anon, authenticated;
revoke all on function public.admin_workshops_by_emirate() from public, anon, authenticated;
revoke all on function public.admin_set_workshop_tier(uuid, text) from public, anon, authenticated;
revoke all on function public.admin_set_agent_tier(uuid, text) from public, anon, authenticated;
revoke all on function public.due_reminders_for_digest() from public, anon, authenticated;
revoke all on function public.mark_reminders_notified(uuid[]) from public, anon, authenticated;


-- §3 Clamp caller-supplied access windows in the agent code flow so a
--    crafted redeem call can't grant an absurdly long full/meta window,
--    and enforce a minimum code length of 8 on create.
--    (Latest redeem_agent_code definition is 20260510000003 — the KYC
--    gate version; body preserved, only the window clamps added.)
create or replace function public.create_agent_code(
  p_vehicle_id uuid,
  p_code text,
  p_minutes int default 60
) returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_expires timestamptz;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.vehicles where id = p_vehicle_id and owner_id = v_uid
  ) then
    raise exception 'not_vehicle_owner' using errcode = '42501';
  end if;
  -- §3 hardened: minimum code length 8 (was 4).
  if p_code is null or length(p_code) < 8 then
    raise exception 'invalid_code' using errcode = '22023';
  end if;

  v_expires := now() + (p_minutes || ' minutes')::interval;

  -- Invalidate any other unused codes for this vehicle (one active code at a time)
  update public.agent_codes
    set used_at = now()
  where vehicle_id = p_vehicle_id
    and used_at is null
    and expires_at > now();

  insert into public.agent_codes (vehicle_id, code, created_by, expires_at)
  values (p_vehicle_id, p_code, v_uid, v_expires);

  return v_expires;
end;
$$;

grant execute on function public.create_agent_code(uuid, text, int) to authenticated;

create or replace function public.redeem_agent_code(
  p_code text,
  p_agent_id uuid,
  p_full_minutes int default 60,
  p_meta_days int default 30
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_code public.agent_codes;
  v_grant_id uuid;
  v_granted_at timestamptz := now();
  v_agent_tier text;
  -- §3 hardened: clamp caller-supplied windows to sane bounds.
  v_full_minutes int := least(greatest(coalesce(p_full_minutes, 60), 1), 60);
  v_meta_days int := least(greatest(coalesce(p_meta_days, 30), 1), 30);
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not public.is_agent_member(p_agent_id) then
    raise exception 'not_agent_member' using errcode = '42501';
  end if;

  -- KYC gate — unverified agents can't pull customer documents.
  select verification_tier into v_agent_tier
    from public.agents
    where id = p_agent_id;
  if v_agent_tier is null or v_agent_tier = 'unverified' then
    raise exception 'agent_not_verified' using errcode = '42501';
  end if;

  select * into v_code from public.agent_codes where code = p_code for update;
  if v_code.id is null then
    raise exception 'code_not_found' using errcode = 'P0002';
  end if;
  if v_code.used_at is not null then
    raise exception 'code_already_used' using errcode = '22023';
  end if;
  if v_code.expires_at < now() then
    raise exception 'code_expired' using errcode = '22023';
  end if;

  insert into public.agent_grants (
    agent_id, vehicle_id, granted_by, granted_at,
    full_until, expires_at
  ) values (
    p_agent_id,
    v_code.vehicle_id,
    v_code.created_by,
    v_granted_at,
    v_granted_at + (v_full_minutes || ' minutes')::interval,
    v_granted_at + (v_meta_days || ' days')::interval
  )
  returning id into v_grant_id;

  update public.agent_codes
    set used_at = now(),
        used_by_user_id = v_uid,
        used_for_grant_id = v_grant_id
  where id = v_code.id;

  return v_grant_id;
end;
$$;

grant execute on function public.redeem_agent_code(text, uuid, int, int) to authenticated;


-- §4 Agents (agent_grants) must never satisfy 'add_record' or 'full'
--    write levels — only read ('view'). Owners keep every level; the
--    helper had no separate workshop branch in the latest definition
--    (20260606000003), so that surface is unchanged.
create or replace function public.has_vehicle_access(
  vehicle_uuid uuid,
  required_level text default 'view'
)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    -- Owner always has every level.
    select 1 from public.vehicles
    where id = vehicle_uuid and owner_id = auth.uid()
  ) or exists (
    -- Active agent grant. §4 hardened: agents are READ-ONLY. They may
    -- only satisfy 'view'; never 'add_record' or 'full' write paths.
    select 1
    from public.agent_grants ag
    join public.agent_members am on am.agent_id = ag.agent_id
    where ag.vehicle_id = vehicle_uuid
      and am.user_id = auth.uid()
      and ag.revoked_at is null
      and ag.expires_at > now()
      and required_level = 'view'
  );
$$;


-- §5 enqueue_document_expiry_reminders: the ON CONFLICT referenced a
--    named constraint that doesn't exist (the dedup index is a partial
--    unique index, not a table constraint). Switch to the matching
--    inference target so re-runs are idempotent instead of erroring.
create or replace function public.enqueue_document_expiry_reminders()
returns table (created int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_horizon date := (now() at time zone 'utc')::date + interval '30 days';
  v_inserted int := 0;
begin
  with target_docs as (
    select
      d.id              as doc_id,
      d.vehicle_id,
      d.expires_at,
      d.label,
      d.doc_type,
      case d.doc_type
        when 'mulkiya'          then 'registration_renewal'
        when 'insurance_policy' then 'insurance_renewal'
        when 'pollution_test'   then 'rta_passing'
        else 'custom'
      end as reminder_type
    from public.vehicle_documents d
    where d.expires_at is not null
      and d.archived_at is null
      and d.expires_at <= v_horizon
  ),
  ins as (
    insert into public.reminders (
      vehicle_id,
      reminder_type,
      due_date,
      notes,
      status,
      source_document_id
    )
    select
      t.vehicle_id,
      t.reminder_type,
      t.expires_at::date,
      coalesce(
        nullif(t.label, ''),
        replace(initcap(replace(t.doc_type, '_', ' ')), '_', ' ')
      ) || ' expires',
      'open',
      t.doc_id
    from target_docs t
    -- §5 hardened: dedup index ux_reminders_source_doc_due_date is a
    -- PARTIAL unique index on (source_document_id, due_date)
    -- WHERE source_document_id is not null, so the inference target must
    -- include the predicate to match it.
    on conflict (source_document_id, due_date)
      where source_document_id is not null
      do nothing
    returning 1
  )
  select count(*)::int into v_inserted from ins;

  return query select v_inserted;
end;
$$;

grant execute on function public.enqueue_document_expiry_reminders()
  to service_role;


-- §6 redeem_workshop_code must never roll the odometer BACKWARDS — only
--    bump current_odometer when the supplied reading is strictly greater
--    than the existing one (and non-null).
create or replace function public.redeem_workshop_code(
  p_code text,
  p_workshop_name text,
  p_service_type text,
  p_service_date date,
  p_odometer integer default null,
  p_cost_aed numeric default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code_id uuid;
  v_vehicle_id uuid;
  v_created_by uuid;
  v_record_id uuid;
begin
  -- Look up the code with row lock to prevent race conditions
  select wc.id, wc.vehicle_id, wc.created_by
    into v_code_id, v_vehicle_id, v_created_by
  from public.workshop_codes wc
  where wc.code = p_code
    and wc.used_at is null
    and wc.expires_at > now()
  for update;

  if not found then
    raise exception 'Code is invalid, already used, or expired'
      using errcode = 'P0001';
  end if;

  -- Insert workshop-attested service record
  insert into public.service_records (
    vehicle_id, service_type, service_date, odometer, cost_aed,
    workshop_name_freetext, notes, attestation, created_by
  ) values (
    v_vehicle_id, p_service_type, p_service_date, p_odometer, p_cost_aed,
    p_workshop_name, p_notes, 'workshop', v_created_by
  )
  returning id into v_record_id;

  -- Mark code as used
  update public.workshop_codes
     set used_at = now(),
         used_by_workshop_name = p_workshop_name,
         used_for_record_id = v_record_id
   where id = v_code_id;

  -- §6 hardened: only advance the odometer, never regress it.
  if p_odometer is not null then
    update public.vehicles
       set current_odometer = p_odometer,
           current_odometer_at = now()
     where id = v_vehicle_id
       and p_odometer > coalesce(current_odometer, 0);
  end if;

  return v_record_id;
end;
$$;

grant execute on function public.redeem_workshop_code(text, text, text, date, integer, numeric, text) to anon, authenticated;


-- §7 admin_audit_log is an accountability trail (PDPL); make it
--    append-only by rejecting any UPDATE or DELETE at the row level.
--    service_role does NOT bypass triggers, so this binds even admin code.
create or replace function public.admin_audit_log_append_only()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'admin_audit_log is append-only (% rejected)', tg_op
    using errcode = '42501';
end;
$$;

drop trigger if exists admin_audit_log_no_mutate on public.admin_audit_log;
create trigger admin_audit_log_no_mutate
  before update or delete on public.admin_audit_log
  for each row execute function public.admin_audit_log_append_only();


-- §8 workshop_reviews owner policy: the WITH CHECK only verified vehicle
--    ownership, so an owner could attach a review to a service_record
--    belonging to a different vehicle/workshop. Tie the referenced
--    service_record to the review's vehicle_id and workshop_id.
drop policy if exists "owner writes reviews" on public.workshop_reviews;
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
    -- §8 hardened: the referenced service_record must belong to this
    -- review's vehicle, and (when set) its workshop must match too.
    -- workshop_id is nullable for freetext workshops, so allow a null
    -- review workshop_id only against a record with null workshop_id.
    and exists (
      select 1 from public.service_records sr
      where sr.id = workshop_reviews.service_record_id
        and sr.vehicle_id = workshop_reviews.vehicle_id
        and sr.workshop_id is not distinct from workshop_reviews.workshop_id
    )
  );


-- §9 service_records owner UPDATE: add WITH CHECK so owners can't flip a
--    record's attestation to 'workshop' (forging workshop attestation).
--    Postgres RLS WITH CHECK cannot reference the OLD row, so workshop_id
--    immutability can't be enforced here; we enforce the attestation
--    allow-list ('owner','receipt') at minimum (see report note).
drop policy if exists "owner_updates_own_records" on public.service_records;
create policy "owner_updates_own_records" on public.service_records
  for update using (
    exists (select 1 from public.vehicles where id = vehicle_id and owner_id = auth.uid())
    and attestation in ('owner', 'receipt')
  ) with check (
    exists (select 1 from public.vehicles where id = vehicle_id and owner_id = auth.uid())
    and attestation in ('owner', 'receipt')
  );


-- §10 vehicle_share_tokens.expires_at was nullable with no default, so
--     tokens could live forever. Default to 30 days and backfill any
--     existing open-ended tokens.
alter table public.vehicle_share_tokens
  alter column expires_at set default (now() + interval '30 days');

update public.vehicle_share_tokens
   set expires_at = coalesce(created_at, now()) + interval '30 days'
 where expires_at is null;


notify pgrst, 'reload schema';
