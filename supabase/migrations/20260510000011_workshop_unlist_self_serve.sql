-- =====================================================================
-- set_workshop_unlisted — workshop owner toggles their own listing
-- visibility on the public marketing surfaces.
--
-- Context: ASM asked to be removed from the website. We added the
-- is_unlisted column in 20260510000008 + a Vehkit-side admin update.
-- That doesn't scale — workshops should self-serve. This RPC validates
-- workshop membership before flipping the flag, and writes an audit row
-- so we can see who flipped what when.
-- =====================================================================

create or replace function public.set_workshop_unlisted(
  p_workshop_id uuid,
  p_unlisted boolean
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_old boolean;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.workshop_members
    where workshop_id = p_workshop_id and user_id = v_user
  ) then
    raise exception 'not_workshop_member' using errcode = '42501';
  end if;

  select is_unlisted into v_old
    from public.workshops
    where id = p_workshop_id;

  update public.workshops
    set is_unlisted = p_unlisted
    where id = p_workshop_id;

  -- Audit trail — who flipped, from what, to what. The admin_audit_log
  -- table already exists for this kind of governance event; we use it
  -- with a workshop_owner handle prefix so admins can filter on it.
  insert into public.admin_audit_log (
    admin_handle, action, target_table, target_id, target_user_id, metadata
  ) values (
    'workshop_owner:' || v_user::text,
    case when p_unlisted then 'workshop_unlisted' else 'workshop_relisted' end,
    'workshops',
    p_workshop_id,
    v_user,
    jsonb_build_object('was', coalesce(v_old, false), 'now', p_unlisted)
  );

  return p_unlisted;
end;
$$;

grant execute on function public.set_workshop_unlisted(uuid, boolean)
  to authenticated;

notify pgrst, 'reload schema';
