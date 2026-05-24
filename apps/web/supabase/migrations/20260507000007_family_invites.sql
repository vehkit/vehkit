-- =====================================================================
-- Family invites — owner-issued shareable links that grant another
-- Vehkit user access to their vehicle (view / add_record / full).
--
-- Invitee accepts at /a/[token]; we create a row in vehicle_access
-- linking them to the vehicle.
-- =====================================================================

create table public.family_invites (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  token text not null unique,
  access_level text not null check (access_level in ('view', 'add_record', 'full')),
  invited_by uuid not null references auth.users(id),
  invited_email text,
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by_user_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index idx_family_invites_token on public.family_invites(token);
create index idx_family_invites_vehicle on public.family_invites(vehicle_id);

alter table public.family_invites enable row level security;

create policy "owner manages family invites"
  on public.family_invites for all
  using (
    exists (
      select 1 from public.vehicles
       where id = vehicle_id and owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.vehicles
       where id = vehicle_id and owner_id = auth.uid()
    )
  );

grant select, insert, update, delete on table public.family_invites to authenticated;

-- =====================================================================
-- Owner generates an invite token (1 invite per call; 14-day expiry).
-- =====================================================================
create or replace function public.create_family_invite(
  p_vehicle_id uuid,
  p_access_level text,
  p_email text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid := auth.uid();
  v_token text;
begin
  if v_owner is null then
    raise exception 'Not authenticated' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.vehicles
    where id = p_vehicle_id and owner_id = v_owner
  ) then
    raise exception 'Not the vehicle owner' using errcode = 'P0001';
  end if;

  if p_access_level not in ('view', 'add_record', 'full') then
    raise exception 'Invalid access level' using errcode = 'P0001';
  end if;

  v_token := translate(encode(gen_random_bytes(24), 'base64'), '+/=', '-_');

  insert into public.family_invites (
    vehicle_id, token, access_level, invited_by, invited_email, expires_at
  ) values (
    p_vehicle_id, v_token, p_access_level, v_owner, p_email,
    now() + interval '14 days'
  );

  return v_token;
end;
$$;

grant execute on function public.create_family_invite(uuid, text, text) to authenticated;

-- =====================================================================
-- Public preview of an invite (no auth required; for the accept page).
-- =====================================================================
create or replace function public.preview_family_invite(p_token text)
returns table (
  vehicle_id uuid,
  access_level text,
  expires_at timestamptz,
  used_at timestamptz,
  vehicle_make text,
  vehicle_model text,
  vehicle_nickname text,
  vehicle_year smallint,
  inviter_email text
)
language sql
security definer
stable
set search_path = public
as $$
  select
    fi.vehicle_id,
    fi.access_level,
    fi.expires_at,
    fi.used_at,
    v.make,
    v.model,
    v.nickname,
    v.year,
    coalesce(p.full_name, p.email) as inviter_email
  from public.family_invites fi
  join public.vehicles v on v.id = fi.vehicle_id
  left join public.profiles p on p.id = fi.invited_by
  where fi.token = p_token
  limit 1;
$$;

grant execute on function public.preview_family_invite(text) to anon, authenticated;

-- =====================================================================
-- Accept an invite — creates vehicle_access for the caller.
-- =====================================================================
create or replace function public.accept_family_invite(p_token text)
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
  from public.family_invites
  where token = p_token
    and used_at is null
    and expires_at > now()
  for update;

  if not found then
    raise exception 'Invite is invalid, used, or expired' using errcode = 'P0001';
  end if;

  -- Owner can't invite themselves
  if exists (
    select 1 from public.vehicles
    where id = v_invite.vehicle_id and owner_id = v_user
  ) then
    update public.family_invites set used_at = now(), used_by_user_id = v_user where id = v_invite.id;
    return v_invite.vehicle_id;
  end if;

  -- Idempotent: skip insert if access already exists
  if not exists (
    select 1 from public.vehicle_access
    where vehicle_id = v_invite.vehicle_id
      and granted_to_user_id = v_user
  ) then
    insert into public.vehicle_access (
      vehicle_id, granted_to_user_id, access_level, granted_by
    ) values (
      v_invite.vehicle_id, v_user, v_invite.access_level, v_invite.invited_by
    );
  end if;

  update public.family_invites
     set used_at = now(),
         used_by_user_id = v_user
   where id = v_invite.id;

  return v_invite.vehicle_id;
end;
$$;

grant execute on function public.accept_family_invite(text) to authenticated;
