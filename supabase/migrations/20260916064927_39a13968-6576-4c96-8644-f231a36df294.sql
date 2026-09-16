CREATE OR REPLACE FUNCTION public.set_member_training_level(_group_id uuid, _user_id uuid, _training_level text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_group_staff(auth.uid(), _group_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF NOT public.is_group_member(_user_id, _group_id) THEN
    RAISE EXCEPTION 'Target user is not a group member';
  END IF;
  UPDATE public.profiles SET training_level = _training_level, updated_at = now() WHERE user_id = _user_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.set_member_training_level(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_member_training_level(uuid, uuid, text) TO authenticated;