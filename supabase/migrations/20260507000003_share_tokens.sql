-- =====================================================================
-- Vehicle share tokens — one-tap shareable read-only links for resale.
-- Public access bypasses RLS via the service role at /r/[token] route.
-- =====================================================================

create table public.vehicle_share_tokens (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  token text not null unique,
  created_by uuid not null references auth.users(id),
  expires_at timestamptz,
  revoked_at timestamptz,
  view_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index idx_share_tokens_token on public.vehicle_share_tokens(token);
create index idx_share_tokens_vehicle on public.vehicle_share_tokens(vehicle_id);

alter table public.vehicle_share_tokens enable row level security;

create policy "owner manages share tokens"
  on public.vehicle_share_tokens for all
  using (
    exists (
      select 1 from public.vehicles where id = vehicle_id and owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.vehicles where id = vehicle_id and owner_id = auth.uid()
    )
  );

-- No public-read policy. Public access only via service role from /r/[token].

grant select, insert, update, delete on table public.vehicle_share_tokens to authenticated;
