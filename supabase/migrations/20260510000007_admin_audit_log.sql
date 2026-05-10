-- =====================================================================
-- Admin audit log.
--
-- Every meaningful admin action lands here — customer previews, tier
-- changes, agent verifications, grant revocations. Used for:
--   1. PDPL accountability ("Vehkit support viewed my mulkiya at X" —
--      we have to be able to answer this within 30 days).
--   2. Internal trust ("did anyone view this customer's docs while
--      that bug was happening?").
--   3. Abuse signals (one admin previewing 200 customers/day is a flag).
--
-- Note: admin auth is HMAC-cookie based (single user 'vecna'),
-- separate from Supabase Auth. We track the admin handle as text
-- rather than a uuid FK to auth.users — flexible for future multi-admin.
-- =====================================================================

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_handle text not null,
  action text not null,
  target_table text,
  target_id uuid,
  target_user_id uuid,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_audit_admin
  on public.admin_audit_log(admin_handle, created_at desc);
create index if not exists idx_admin_audit_target_user
  on public.admin_audit_log(target_user_id, created_at desc)
  where target_user_id is not null;
create index if not exists idx_admin_audit_action
  on public.admin_audit_log(action, created_at desc);

-- RLS: default-deny for everyone. The admin app uses the service-role
-- client which bypasses RLS to write+read here. End users never touch
-- this table.
alter table public.admin_audit_log enable row level security;

notify pgrst, 'reload schema';
