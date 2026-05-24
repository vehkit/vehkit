-- =====================================================================
-- Idempotent repair of all agents-table policies.
--
-- Some prior migration applied the table without all three RLS policies
-- (likely a partial apply on a previous db:push). The original migration
-- 20260509000012 used CREATE POLICY without IF NOT EXISTS — so re-running
-- it would error and abort the rest of the file. This repair migration
-- drops-then-recreates each policy so the state is guaranteed regardless
-- of what's already there.
-- =====================================================================

drop policy if exists "auth_users_insert_agents" on public.agents;
drop policy if exists "members_read_own_agent" on public.agents;
drop policy if exists "owners_admins_update_agent" on public.agents;

create policy "auth_users_insert_agents" on public.agents
  for insert to authenticated with check (true);

create policy "members_read_own_agent" on public.agents
  for select using (public.is_agent_member(id));

create policy "owners_admins_update_agent" on public.agents
  for update using (
    exists (
      select 1 from public.agent_members
      where agent_id = agents.id
        and user_id = auth.uid()
        and role in ('owner', 'admin')
    )
  );

-- Same pattern for agent_members — drop/recreate to guarantee state.
drop policy if exists "members_read_roster" on public.agent_members;
drop policy if exists "first_member_self_insert" on public.agent_members;
drop policy if exists "owners_admins_manage_members" on public.agent_members;

create policy "members_read_roster" on public.agent_members
  for select using (public.is_agent_member(agent_id));

create policy "first_member_self_insert" on public.agent_members
  for insert to authenticated with check (
    user_id = auth.uid()
    and not exists (
      select 1 from public.agent_members existing
      where existing.agent_id = agent_members.agent_id
    )
  );

create policy "owners_admins_manage_members" on public.agent_members
  for all using (
    exists (
      select 1 from public.agent_members am
      where am.agent_id = agent_members.agent_id
        and am.user_id = auth.uid()
        and am.role in ('owner', 'admin')
    )
  );

notify pgrst, 'reload schema';
