-- =====================================================================
-- Break RLS recursion on agent_members.
--
-- The original `owners_admins_manage_members` policy ran a subquery
-- against agent_members from inside its own USING clause. Postgres
-- re-applied RLS on the subquery, which re-applied the policy, which
-- re-ran the subquery, etc. — Postgres detects this loop and aborts
-- with `42P17: infinite recursion detected in policy`.
--
-- Symptom in production: every app query on agent_members errored,
-- which meant /agent/start never saw the user's existing memberships,
-- which meant the onboarding form re-rendered every time and every
-- submit created a duplicate org.
--
-- Fix: wrap the role check in a SECURITY DEFINER helper. SD bypasses
-- RLS for the function's internal query, so the subquery no longer
-- triggers another policy evaluation.
--
-- Same recursion risk applies to the `owners_admins_update_agent`
-- policy on agents (it also queries agent_members from a USING
-- clause). Patch that one with the same helper while we're here.
-- =====================================================================

create or replace function public.is_agent_admin(p_agent_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.agent_members
    where agent_id = p_agent_id
      and user_id = auth.uid()
      and role in ('owner', 'admin')
  );
$$;

grant execute on function public.is_agent_admin(uuid) to authenticated;

drop policy if exists "owners_admins_manage_members" on public.agent_members;
create policy "owners_admins_manage_members" on public.agent_members
  for all using (public.is_agent_admin(agent_id));

drop policy if exists "owners_admins_update_agent" on public.agents;
create policy "owners_admins_update_agent" on public.agents
  for update using (public.is_agent_admin(id));

notify pgrst, 'reload schema';
