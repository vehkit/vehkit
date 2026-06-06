-- =====================================================================
-- admin_nuke_user(p_user_id) — purge a user and ALL related rows.
--
-- Built from the proven manual delete-by-email script after multiple
-- schema-drift fixes (workshop_codes column name, agent_grants column
-- name, missing notifications table). Wrapping the proven logic so
-- we don't relearn the schema each time a tester needs scrubbing.
--
-- Returns the deleted email, vehicle count, and a list of storage
-- paths the caller still has to remove manually from the buckets
-- (Supabase blocks direct SQL DELETE on storage.objects via a trigger,
-- so we surface the paths instead of attempting it here).
--
-- SECURITY DEFINER + revoked from public/anon/authenticated means the
-- function ONLY runs via the service-role client. End users can't call
-- it even if they discover the name.
-- =====================================================================

create or replace function public.admin_nuke_user(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
DECLARE
  target_email   text;
  vehicle_ids    uuid[];
  storage_paths  text[];
BEGIN
  SELECT email INTO target_email FROM auth.users WHERE id = p_user_id LIMIT 1;
  IF target_email IS NULL THEN
    RAISE EXCEPTION 'admin_nuke_user: user % not found', p_user_id;
  END IF;

  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO vehicle_ids
    FROM public.vehicles WHERE owner_id = p_user_id;

  -- Collect storage paths before deleting metadata.
  SELECT COALESCE(array_agg(storage_path), ARRAY[]::text[]) INTO storage_paths
    FROM public.vehicle_documents WHERE vehicle_id = ANY(vehicle_ids);
  SELECT COALESCE(array_agg(storage_path), ARRAY[]::text[]) || storage_paths
    INTO storage_paths
    FROM public.vehicle_document_files WHERE vehicle_id = ANY(vehicle_ids);

  -- ── FK-safe deletion order ──────────────────────────────────────
  DELETE FROM public.vehicle_document_files WHERE vehicle_id = ANY(vehicle_ids);
  DELETE FROM public.vehicle_documents      WHERE vehicle_id = ANY(vehicle_ids);

  -- workshop_codes (NO ACTION FK on used_for_record_id blocks service_records)
  DELETE FROM public.workshop_codes WHERE vehicle_id = ANY(vehicle_ids);
  DELETE FROM public.workshop_codes WHERE created_by = p_user_id;

  DELETE FROM public.service_records WHERE vehicle_id = ANY(vehicle_ids);

  DELETE FROM public.booking_requests
    WHERE vehicle_id = ANY(vehicle_ids) OR customer_id = p_user_id;

  DELETE FROM public.workshop_reviews WHERE created_by = p_user_id;

  DELETE FROM public.agent_grants WHERE granted_by = p_user_id;

  DELETE FROM public.agent_members    WHERE user_id = p_user_id;
  DELETE FROM public.workshop_members WHERE user_id = p_user_id;

  -- Optional tables — guard so a schema that drops them doesn't break us.
  BEGIN
    DELETE FROM public.notifications WHERE user_id = p_user_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  DELETE FROM public.vehicles WHERE owner_id = p_user_id;

  DELETE FROM public.profiles WHERE id = p_user_id;

  DELETE FROM auth.users WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'deleted_email', target_email,
    'vehicle_count', COALESCE(array_length(vehicle_ids, 1), 0),
    'storage_paths', to_jsonb(storage_paths)
  );
END;
$$;

revoke all on function public.admin_nuke_user(uuid) from public, anon, authenticated;

notify pgrst, 'reload schema';
