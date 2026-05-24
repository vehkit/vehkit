-- =====================================================================
-- Agents (insurance brokers, fleet partners, leasing agents)
--
-- Mirrors workshops schema. Separate table because the relationship to
-- vehicles is fundamentally different — agents don't write service
-- records; they consume documents (mulkiya, insurance) and submit
-- policy artifacts back. Permissions are also different (time-bounded).
-- =====================================================================

create table if not exists public.agents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  category text not null default 'insurance'
    check (category in ('insurance', 'fleet', 'leasing', 'other')),
  emirate text,
  address text,
  phone text,
  email text,
  trade_license text,
  verification_tier text not null default 'unverified'
    check (verification_tier in ('unverified', 'silver', 'gold')),
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger agents_set_updated_at
  before update on public.agents
  for each row execute function public.set_updated_at();

create table if not exists public.agent_members (
  agent_id uuid not null references public.agents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (agent_id, user_id)
);

create index if not exists idx_agent_members_user on public.agent_members(user_id);

-- Helper: is the calling user a member of this agent org?
create or replace function public.is_agent_member(agent_uuid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.agent_members
    where agent_id = agent_uuid
      and user_id = auth.uid()
  );
$$;

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.agents         enable row level security;
alter table public.agent_members  enable row level security;

-- agents: members can read their own org. Public profile lookup will
-- happen through SECURITY DEFINER RPCs later (mirroring workshops).
create policy "members_read_own_agent" on public.agents
  for select using (public.is_agent_member(id));

-- Allow any authenticated user to create a new agent (onboarding flow).
-- The creator becomes 'owner' via the same INSERT trigger pattern below.
create policy "auth_users_insert_agents" on public.agents
  for insert to authenticated with check (true);

create policy "owners_admins_update_agent" on public.agents
  for update using (
    exists (
      select 1 from public.agent_members
      where agent_id = agents.id
        and user_id = auth.uid()
        and role in ('owner', 'admin')
    )
  );

-- agent_members: members read their own org's roster
create policy "members_read_roster" on public.agent_members
  for select using (public.is_agent_member(agent_id));

-- A user can insert themselves as a member (onboarding) only when
-- there are no members yet (they're the first / founder). Subsequent
-- additions go through invite flows (separate RPC).
create policy "first_member_self_insert" on public.agent_members
  for insert to authenticated with check (
    user_id = auth.uid()
    and not exists (
      select 1 from public.agent_members where agent_id = agent_members.agent_id
    )
  );

-- Owners/admins can manage roster
create policy "owners_admins_manage_members" on public.agent_members
  for all using (
    exists (
      select 1 from public.agent_members am
      where am.agent_id = agent_members.agent_id
        and am.user_id = auth.uid()
        and am.role in ('owner', 'admin')
    )
  );

grant execute on function public.is_agent_member(uuid) to authenticated;

notify pgrst, 'reload schema';
