-- =====================================================================
-- Document expiry reminders.
--
-- The new mycars copy promises "we'll remind you when your mulkiya /
-- insurance / NOC is about to expire." This wires that promise to the
-- existing daily reminder digest (cron at 04:00 UTC). We:
--
--   1. Add `reminders.source_document_id` so we can link a reminder back
--      to the document that triggered it.
--   2. Unique partial index on (source_document_id, due_date) — the
--      enqueue RPC uses ON CONFLICT DO NOTHING so re-runs are no-ops.
--   3. SECURITY DEFINER `enqueue_document_expiry_reminders()` RPC that
--      walks expiring docs and creates open reminders.
--
-- The cron at /api/cron/document-expiry calls this RPC daily at 03:00
-- UTC, an hour before the reminder digest fires — so any newly created
-- reminders ride that same morning's email.
--
-- Map: doc_type → reminder_type:
--   mulkiya            → registration_renewal
--   insurance_policy   → insurance_renewal
--   pollution_test     → rta_passing
--   noc, driving_licence, service_history, other → custom
-- =====================================================================

alter table public.reminders
  add column if not exists source_document_id uuid
    references public.vehicle_documents(id) on delete cascade;

-- One open reminder per (document, due_date). If the doc is renewed
-- (new expires_at), the next enqueue creates a fresh reminder.
create unique index if not exists ux_reminders_source_doc_due_date
  on public.reminders (source_document_id, due_date)
  where source_document_id is not null;

-- =====================================================================
-- RPC: enqueue reminders for documents expiring in <=30 days.
--
-- Idempotent — uses ON CONFLICT DO NOTHING on the unique index above.
-- Returns the count of newly-inserted reminders.
-- =====================================================================
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
    on conflict on constraint ux_reminders_source_doc_due_date do nothing
    returning 1
  )
  select count(*)::int into v_inserted from ins;

  return query select v_inserted;
end;
$$;

grant execute on function public.enqueue_document_expiry_reminders()
  to service_role;

notify pgrst, 'reload schema';
