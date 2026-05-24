-- =====================================================================
-- P0 fix: workshop-docs bucket access regression.
--
-- Migration 20260510000003_agent_kyc_gate.sql added two storage policies
-- gated only on `bucket_id = 'workshop-docs'`. PostgreSQL OR-combines
-- policies, so this silently broadened the existing workshop-member-only
-- access — every authenticated user could list and download every trade
-- license in the bucket (workshop AND agent licenses, both sensitive PII).
--
-- This migration:
--   1. Drops the wide-open agent policies.
--   2. Replaces them with path-scoped policies that mirror the workshop
--      pattern: extract `(string_to_array(name, '/'))[2]` as the agent_id
--      and require the caller to be a member of that agent.
--   3. Idempotent — safe to re-run.
--
-- Path convention assumed: agents/{agent_id}/...
-- (mirrors workshops/{workshop_id}/... — the convention from the trade
-- license upload component.)
-- =====================================================================

-- 1. Drop the broken wide-open policies.
drop policy if exists "agents_upload_own_trade_license" on storage.objects;
drop policy if exists "agents_read_own_trade_license" on storage.objects;

-- 2. Path-scoped INSERT — agent must be a member of the agent_id in the path.
create policy "agents_upload_own_trade_license"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'workshop-docs'
    and (string_to_array(name, '/'))[1] = 'agents'
    and exists (
      select 1
      from public.agent_members am
      where am.user_id = auth.uid()
        and am.agent_id::text = (string_to_array(name, '/'))[2]
    )
  );

-- 3. Path-scoped SELECT — same membership check.
create policy "agents_read_own_trade_license"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'workshop-docs'
    and (string_to_array(name, '/'))[1] = 'agents'
    and exists (
      select 1
      from public.agent_members am
      where am.user_id = auth.uid()
        and am.agent_id::text = (string_to_array(name, '/'))[2]
    )
  );

-- 4. Path-scoped UPDATE/DELETE — same membership check, so agents can
--    replace their license file (and orphans don't accumulate).
drop policy if exists "agents_update_own_trade_license" on storage.objects;
create policy "agents_update_own_trade_license"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'workshop-docs'
    and (string_to_array(name, '/'))[1] = 'agents'
    and exists (
      select 1
      from public.agent_members am
      where am.user_id = auth.uid()
        and am.agent_id::text = (string_to_array(name, '/'))[2]
    )
  );

drop policy if exists "agents_delete_own_trade_license" on storage.objects;
create policy "agents_delete_own_trade_license"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'workshop-docs'
    and (string_to_array(name, '/'))[1] = 'agents'
    and exists (
      select 1
      from public.agent_members am
      where am.user_id = auth.uid()
        and am.agent_id::text = (string_to_array(name, '/'))[2]
    )
  );
