ALTER TABLE public.event_signups
  ADD COLUMN IF NOT EXISTS attended boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.get_group_push_status(_group_id uuid)
RETURNS TABLE(user_id uuid, pilot_name text, enabled boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT gm.user_id,
         COALESCE(NULLIF(p.pilot_name, ''), '—') AS pilot_name,
         EXISTS (SELECT 1 FROM public.push_subscriptions ps WHERE ps.user_id = gm.user_id) AS enabled
  FROM public.group_members gm
  LEFT JOIN public.profiles p ON p.user_id = gm.user_id
  WHERE gm.group_id = _group_id
    AND public.is_group_staff(auth.uid(), _group_id)
  ORDER BY 3 DESC, 2;
$$;

REVOKE ALL ON FUNCTION public.get_group_push_status(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_group_push_status(uuid) TO authenticated;