-- =====================================================================
-- Fix the first_member_self_insert policy on agent_members.
--
-- The original policy used `where agent_id = agent_members.agent_id`
-- inside a subquery selecting from agent_members. Without an alias,
-- both sides resolved to the INNER row in the subquery — equivalent to
-- `where agent_id = agent_id`, which is always true if any rows exist.
--
-- Effect: the first user globally could create an agent and join it.
-- Every subsequent first-member insert for any new agent was denied.
-- Symptom: "agents unable to sign up" past the very first one.
--
-- Fix: alias the inner relation so the equality joins outer-row vs
-- inner-row correctly.
-- =====================================================================

drop policy if exists "first_member_self_insert" on public.agent_members;

create policy "first_member_self_insert" on public.agent_members
  for insert to authenticated with check (
    user_id = auth.uid()
    and not exists (
      select 1 from public.agent_members existing
      where existing.agent_id = agent_members.agent_id
    )
  );

notify pgrst, 'reload schema';
