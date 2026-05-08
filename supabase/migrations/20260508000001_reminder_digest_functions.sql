-- =====================================================================
-- Reminder digest helpers — used by the daily cron job to email owners
-- their due/overdue reminders without spamming.
-- =====================================================================

-- Returns due/overdue reminders across all users with owner contact info.
-- SECURITY DEFINER bypasses RLS so the cron can read everyone's data.
-- Includes notified_at gating so reminders don't email more than once a week.
create or replace function public.due_reminders_for_digest()
returns table (
  owner_id uuid,
  owner_email text,
  owner_name text,
  vehicle_id uuid,
  vehicle_name text,
  reminder_id uuid,
  reminder_type text,
  due_date date,
  due_at_km integer,
  current_odometer integer
)
language sql
security definer
stable
set search_path = public
as $$
  select
    v.owner_id,
    p.email,
    p.full_name,
    v.id,
    coalesce(v.nickname, v.make || ' ' || v.model),
    r.id,
    r.reminder_type,
    r.due_date,
    r.due_at_km,
    v.current_odometer
  from public.reminders r
  join public.vehicles v on v.id = r.vehicle_id
  join public.profiles p on p.id = v.owner_id
  where r.status = 'open'
    and p.email is not null
    and (
      (r.due_date is not null and r.due_date <= current_date + interval '7 days')
      or (
        r.due_at_km is not null
        and v.current_odometer is not null
        and (r.due_at_km - v.current_odometer) <= 1000
      )
    )
    and (
      r.notified_at is null
      or r.notified_at < now() - interval '7 days'
    )
  order by v.owner_id, r.due_date nulls last;
$$;

-- Note: NOT granted to anon/authenticated. Service role only.

-- Mark a batch of reminders as notified (called after the digest goes out)
create or replace function public.mark_reminders_notified(p_reminder_ids uuid[])
returns void
language sql
security definer
set search_path = public
as $$
  update public.reminders
     set notified_at = now()
   where id = any(p_reminder_ids);
$$;
