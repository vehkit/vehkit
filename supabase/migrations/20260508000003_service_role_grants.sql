-- =====================================================================
-- Explicit service_role grants on public schema.
--
-- The new sb_secret_* API keys don't auto-grant service_role privileges
-- the way legacy JWT keys did. Explicit grants are the safer pattern —
-- they don't depend on Supabase gateway role-mapping behavior.
--
-- Includes ALTER DEFAULT PRIVILEGES so any future tables/functions
-- created in this schema are automatically accessible to service_role.
-- =====================================================================

grant usage on schema public to service_role;

grant select, insert, update, delete on all tables in schema public to service_role;
grant execute on all functions in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;

alter default privileges in schema public
  grant execute on functions to service_role;

alter default privileges in schema public
  grant usage, select on sequences to service_role;
