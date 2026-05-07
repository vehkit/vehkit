-- =====================================================================
-- Grant table-level permissions to Supabase roles.
-- RLS policies still enforce row-level access on top of these grants.
--
-- Required because "Automatically expose new tables" was disabled at
-- project creation (correct security default — explicit grants are safer).
-- =====================================================================

grant usage on schema public to anon, authenticated;

-- Authenticated users (signed in via Supabase Auth)
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

-- Anonymous users — only public-readable tables (workshops are public for resale reports)
grant select on table public.workshops to anon;

-- Default privileges so future tables / sequences / functions inherit these grants
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant usage, select on sequences to authenticated;
alter default privileges in schema public grant execute on functions to authenticated;

-- Storage bucket access (already created in init migration; just ensuring grants)
grant select, insert, update, delete on table storage.objects to authenticated;
