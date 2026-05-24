-- =====================================================================
-- Admin: set agent tier manually (mirrors admin_set_workshop_tier).
-- Used by the /admin/agents page to flip a row's verification_tier
-- between unverified / silver / gold.
--
-- Note: this RPC is only callable from server-side admin code that uses
-- the service-role client (createAdminClient). RLS on the agents table
-- doesn't allow normal authenticated users to UPDATE rows they don't
-- own; the service-role client bypasses RLS, so we don't need to gate
-- this function further.
-- =====================================================================

create or replace function public.admin_set_agent_tier(
  p_agent_id uuid,
  p_tier text
) returns void
language sql
security definer
set search_path = public
as $$
  update public.agents
     set verification_tier = p_tier
   where id = p_agent_id
     and p_tier in ('unverified', 'silver', 'gold');
$$;

notify pgrst, 'reload schema';
