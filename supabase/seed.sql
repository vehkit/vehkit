-- Local dev seed data. Runs only on `supabase db reset` / local stack.
-- Do not put production secrets here.

-- Example workshop (visible to all signed-in users via RLS).
insert into public.workshops (id, name, slug, emirate, verification_tier)
values
  ('11111111-1111-1111-1111-111111111111', 'Al Quoz Auto Care', 'al-quoz-auto-care', 'Dubai', 'silver'),
  ('22222222-2222-2222-2222-222222222222', 'Sharjah Pro Garage', 'sharjah-pro-garage', 'Sharjah', 'unverified')
on conflict (id) do nothing;
