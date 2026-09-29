-- Onboarding per path (2026-09-30): the welcome dialog depends on how someone uses Flyary
--   student  member of a school without a team function: welcome from the school, profile with
--            emergency contact, training status, flying days
--   staff    team member of a school (admin, lead, instructor, helper): school area, certificate,
--            invite students
--   pilot    everyone else: import, XContest, places, first flight
-- and is remembered per account (before: per browser in localStorage, so it came back on every new
-- device). Each kind is shown once; someone who later joins a school as student or team member gets
-- that introduction once more. Existing accounts have seen everything already.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_seen text[] NOT NULL DEFAULT '{}';
UPDATE public.profiles SET onboarding_seen = ARRAY['pilot', 'student', 'staff'] WHERE onboarding_seen = '{}';

-- {"show": bool, "kind": "student"|"staff"|"pilot", "school": name or null}
CREATE OR REPLACE FUNCTION public.my_onboarding()
RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH me AS (SELECT auth.uid() AS uid),
  team AS (
    SELECT g.name FROM public.group_members gm JOIN public.groups g ON g.id = gm.group_id, me
    WHERE gm.user_id = me.uid AND g.group_type = 'school' AND public.is_group_team_member(me.uid, g.id)
    ORDER BY gm.joined_at NULLS LAST LIMIT 1),
  student AS (
    SELECT g.name FROM public.group_members gm JOIN public.groups g ON g.id = gm.group_id, me
    WHERE gm.user_id = me.uid AND g.group_type = 'school' AND NOT public.is_group_team_member(me.uid, g.id)
    ORDER BY gm.joined_at NULLS LAST LIMIT 1),
  k AS (
    SELECT CASE WHEN EXISTS (SELECT 1 FROM team) THEN 'staff' WHEN EXISTS (SELECT 1 FROM student) THEN 'student' ELSE 'pilot' END AS kind,
           COALESCE((SELECT name FROM team), (SELECT name FROM student)) AS school)
  SELECT json_build_object(
    'show', NOT (k.kind = ANY (COALESCE((SELECT onboarding_seen FROM public.profiles, me WHERE user_id = me.uid), '{}'))),
    'kind', k.kind, 'school', k.school)
  FROM k;
$$;
REVOKE ALL ON FUNCTION public.my_onboarding() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_onboarding() TO authenticated;

CREATE OR REPLACE FUNCTION public.complete_onboarding(_kind text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501'; END IF;
  IF _kind NOT IN ('pilot', 'student', 'staff') THEN RAISE EXCEPTION 'Unknown onboarding' USING ERRCODE = '22023'; END IF;
  UPDATE public.profiles SET onboarding_seen = array_append(onboarding_seen, _kind)
    WHERE user_id = auth.uid() AND NOT (_kind = ANY (onboarding_seen));
END;
$$;
REVOKE ALL ON FUNCTION public.complete_onboarding(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_onboarding(text) TO authenticated;

NOTIFY pgrst, 'reload schema';
