-- Security review 2026-09-28, decision: variant 1. Anyone could follow anyone (and then see profile,
-- published flights and photos), and everyone could read who follows whom. Now:
--   * profiles.follow_permission: 'groups' (default: only members of a shared group may follow) or
--     'everyone'. The follows insert policy enforces it (can_follow).
--   * Switching to 'groups' removes followers who share no group with the person.
--   * follows rows are visible only to the two people involved; counts for a profile page come from
--     follow_info (numbers only). Every policy that reads follows asks "does the caller follow …",
--     which the caller still sees.
-- No follows existed when this was added.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS follow_permission text NOT NULL DEFAULT 'groups'
  CONSTRAINT profiles_follow_permission_check CHECK (follow_permission IN ('everyone', 'groups'));
-- profiles has column-level SELECT grants only (0018); the owner reads the setting in Settings.
GRANT SELECT (follow_permission) ON public.profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.shares_group(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.group_members a JOIN public.group_members b ON a.group_id = b.group_id
                 WHERE a.user_id = _a AND b.user_id = _b)
$$;

CREATE OR REPLACE FUNCTION public.can_follow(_follower uuid, _target uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _follower IS NOT NULL AND _target IS NOT NULL AND _follower <> _target AND (
    coalesce((SELECT follow_permission FROM public.profiles WHERE user_id = _target), 'groups') = 'everyone'
    OR public.shares_group(_follower, _target))
$$;

DROP POLICY IF EXISTS "Users can follow others" ON public.follows;
CREATE POLICY "Users can follow others" ON public.follows FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = follower_id AND public.can_follow(auth.uid(), following_id));

DROP POLICY IF EXISTS "Authenticated can view follows" ON public.follows;
DROP POLICY IF EXISTS "Users see their own follows" ON public.follows;
CREATE POLICY "Users see their own follows" ON public.follows FOR SELECT TO authenticated
  USING (auth.uid() = follower_id OR auth.uid() = following_id);

-- Numbers for a profile page, plus whether the caller follows / may follow.
CREATE OR REPLACE FUNCTION public.follow_info(_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501'; END IF;
  RETURN jsonb_build_object(
    'followers', (SELECT count(*) FROM public.follows WHERE following_id = _user_id),
    'following', (SELECT count(*) FROM public.follows WHERE follower_id = _user_id),
    'isFollowing', EXISTS (SELECT 1 FROM public.follows WHERE follower_id = auth.uid() AND following_id = _user_id),
    'canFollow', public.can_follow(auth.uid(), _user_id));
END $$;

-- Switching to "only group members" removes the other followers.
CREATE OR REPLACE FUNCTION public.apply_follow_permission()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.follow_permission = 'groups' AND OLD.follow_permission IS DISTINCT FROM 'groups' THEN
    DELETE FROM public.follows f WHERE f.following_id = NEW.user_id AND NOT public.shares_group(f.follower_id, NEW.user_id);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS profiles_follow_permission ON public.profiles;
CREATE TRIGGER profiles_follow_permission AFTER UPDATE OF follow_permission ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.apply_follow_permission();

REVOKE ALL ON FUNCTION public.shares_group(uuid, uuid), public.can_follow(uuid, uuid), public.follow_info(uuid),
  public.apply_follow_permission() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_follow(uuid, uuid), public.follow_info(uuid) TO authenticated;
