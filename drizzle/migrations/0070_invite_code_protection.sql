-- Security review 2026-09-28: every member (also every student) could read a group's invite_code and
-- pass it on; the code never changed. Now only group admins and the school team read it
-- (group_invite_code) and can replace it (regenerate_group_invite_code), which ends the old link.
-- A column-level REVOKE does nothing while the table-level SELECT grant exists (see migration 0018),
-- so the table grant is replaced by a grant on the other columns.

REVOKE SELECT ON public.groups FROM anon, authenticated;
GRANT SELECT (id, name, description, created_by, created_at, group_type) ON public.groups TO authenticated;

CREATE OR REPLACE FUNCTION public.group_invite_code(_group_id uuid)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (public.is_group_admin(auth.uid(), _group_id) OR public.is_group_staff(auth.uid(), _group_id)) THEN
    RAISE EXCEPTION 'Group admin required' USING ERRCODE = '42501';
  END IF;
  RETURN (SELECT invite_code FROM public.groups WHERE id = _group_id);
END $$;

CREATE OR REPLACE FUNCTION public.regenerate_group_invite_code(_group_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _code uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT (public.is_group_admin(auth.uid(), _group_id) OR public.is_group_staff(auth.uid(), _group_id)) THEN
    RAISE EXCEPTION 'Group admin required' USING ERRCODE = '42501';
  END IF;
  UPDATE public.groups SET invite_code = gen_random_uuid() WHERE id = _group_id RETURNING invite_code INTO _code;
  RETURN _code;
END $$;

REVOKE ALL ON FUNCTION public.group_invite_code(uuid), public.regenerate_group_invite_code(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.group_invite_code(uuid), public.regenerate_group_invite_code(uuid) TO authenticated;
