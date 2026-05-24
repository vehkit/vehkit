-- =====================================================================
-- Fleet member invitations — admins issue shareable invite links to
-- bring teammates onto a fleet org. Same pattern as family invites.
-- =====================================================================

create table public.fleet_invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.fleet_orgs(id) on delete cascade,
  token text not null unique,
  role text not null check (role in ('admin', 'member', 'viewer')),
  invited_by uuid not null references auth.users(id),
  invited_email text,
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by_user_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index idx_fleet_invites_token on public.fleet_invites(token);
create index idx_fleet_invites_org on public.fleet_invites(org_id);

alter table public.fleet_invites enable row level security;

-- Admins manage invites
create policy "fleet admins manage invites" on public.fleet_invites
  for all using (public.is_fleet_admin(org_id))
  with check (public.is_fleet_admin(org_id));

grant select, insert, update, delete on public.fleet_invites to authenticated;

-- =====================================================================
-- Admin generates an invite (14-day expiry)
-- =====================================================================
create or replace function public.create_fleet_invite(
  p_org_id uuid,
  p_role text,
  p_email text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_token text;
begin
  if v_user is null then
    raise exception 'Not authenticated' using errcode = 'P0001';
  end if;

  if not public.is_fleet_admin(p_org_id) then
    raise exception 'Not a fleet admin' using errcode = 'P0001';
  end if;

  if p_role not in ('admin', 'member', 'viewer') then
    raise exception 'Invalid role' using errcode = 'P0001';
  end if;

  v_token := translate(encode(gen_random_bytes(24), 'base64'), '+/=', '-_');

  insert into public.fleet_invites (org_id, token, role, invited_by, invited_email, expires_at)
  values (p_org_id, v_token, p_role, v_user, p_email, now() + interval '14 days');

  return v_token;
end;
$$;

grant execute on function public.create_fleet_invite(uuid, text, text) to authenticated;

-- =====================================================================
-- Public preview (no auth required) — returns org info for display
-- =====================================================================
create or replace function public.preview_fleet_invite(p_token text)
returns table (
  org_id uuid,
  org_name text,
  org_emirate text,
  role text,
  expires_at timestamptz,
  used_at timestamptz,
  inviter_email text
)
language sql
security definer
stable
set search_path = public
as $$
  select
    fi.org_id,
    o.name as org_name,
    o.emirate as org_emirate,
    fi.role,
    fi.expires_at,
    fi.used_at,
    coalesce(p.full_name, p.email) as inviter_email
  from public.fleet_invites fi
  join public.fleet_orgs o on o.id = fi.org_id
  left join public.profiles p on p.id = fi.invited_by
  where fi.token = p_token
  limit 1;
$$;

grant execute on function public.preview_fleet_invite(text) to anon, authenticated;

-- =====================================================================
-- Accept invite — creates fleet_members row
-- =====================================================================
create or replace function public.accept_fleet_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_invite record;
begin
  if v_user is null then
    raise exception 'Not authenticated' using errcode = 'P0001';
  end if;

  select * into v_invite
  from public.fleet_invites
  where token = p_token
    and used_at is null
    and expires_at > now()
  for update;

  if not found then
    raise exception 'Invite is invalid, used, or expired' using errcode = 'P0001';
  end if;

  -- Idempotent: skip if already a member
  if not exists (
    select 1 from public.fleet_members
    where org_id = v_invite.org_id and user_id = v_user
  ) then
    insert into public.fleet_members (org_id, user_id, role)
    values (v_invite.org_id, v_user, v_invite.role);
  end if;

  update public.fleet_invites
     set used_at = now(),
         used_by_user_id = v_user
   where id = v_invite.id;

  return v_invite.org_id;
end;
$$;

grant execute on function public.accept_fleet_invite(text) to authenticated;
