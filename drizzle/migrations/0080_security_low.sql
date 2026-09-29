-- Security review 2026-09-28, low findings (fixed 2026-09-30).
--
-- 1) A flight could be saved with any group_id, also of a group the pilot is not in (it then showed
--    up for that group's members). Now a flight is linked only to groups the saving person belongs
--    to. Checked only when the group is set or changed, so pilots who left a group can still edit
--    their older flights. Linking a school flight from a released flying day (0057) stays possible.
-- 2) Students could set their own training level (Settings) and so read the student channels of
--    other levels (chat audience_levels). In a school the school sets it (set_member_training_level);
--    pilots outside a school keep setting their own. profiles has a table-wide UPDATE grant, so a
--    column grant would not help; a trigger does.
-- 3) get_pilot_stats returned the statistics of any user; the app only asks for its own.
-- 4) The flight-photos and igc-files buckets had no size or type limits.

CREATE OR REPLACE FUNCTION public.guard_flight_group()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.group_id IS NOT NULL AND auth.uid() IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.group_id IS DISTINCT FROM OLD.group_id)
     AND COALESCE(current_setting('flyary.school_flight_link', true), '') <> 'on'
     AND NOT public.is_group_member(auth.uid(), NEW.group_id) THEN
    RAISE EXCEPTION 'Not a member of this group' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_flight_group() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS flights_guard_group ON public.flights;
CREATE TRIGGER flights_guard_group BEFORE INSERT OR UPDATE OF group_id ON public.flights
  FOR EACH ROW EXECUTE FUNCTION public.guard_flight_group();

-- A school student: member of a school without a team function there (admin, lead, instructor, helper).
CREATE OR REPLACE FUNCTION public.is_school_student(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members gm JOIN public.groups g ON g.id = gm.group_id
    WHERE gm.user_id = _user_id AND g.group_type = 'school'
      AND NOT public.is_group_team_member(_user_id, g.id));
$$;
REVOKE ALL ON FUNCTION public.is_school_student(uuid) FROM PUBLIC, anon, authenticated;

-- For the Settings page: is my training level set by my school?
CREATE OR REPLACE FUNCTION public.my_level_set_by_school()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_school_student(auth.uid());
$$;
REVOKE ALL ON FUNCTION public.my_level_set_by_school() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_level_set_by_school() TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_own_training_level()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.training_level IS DISTINCT FROM OLD.training_level
     AND auth.uid() = NEW.user_id AND public.is_school_student(NEW.user_id) THEN
    RAISE EXCEPTION 'Your flight school sets your training level' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_own_training_level() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS profiles_guard_training_level ON public.profiles;
CREATE TRIGGER profiles_guard_training_level BEFORE UPDATE OF training_level ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_own_training_level();

CREATE OR REPLACE FUNCTION public.get_pilot_stats(_user_id uuid, _year integer DEFAULT NULL::integer)
RETURNS TABLE(total_flights bigint, total_minutes bigint, unique_takeoffs bigint, unique_landings bigint, total_altitude bigint, total_distance numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    COUNT(*)::bigint,
    COALESCE(SUM(duration_minutes), 0)::bigint,
    COUNT(DISTINCT takeoff_location_id)::bigint,
    COUNT(DISTINCT landing_location_id)::bigint,
    COALESCE(SUM(altitude_gain), 0)::bigint,
    COALESCE(SUM(distance_km), 0)::numeric
  FROM public.flights
  WHERE user_id = _user_id AND _user_id = auth.uid()
    AND (_year IS NULL OR EXTRACT(YEAR FROM date) = _year);
$$;
REVOKE ALL ON FUNCTION public.get_pilot_stats(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_pilot_stats(uuid, integer) TO authenticated;

-- Photos arrive compressed (about 0.3 MB); 15 MB leaves room for older app versions that upload the
-- original. IGC files are uploaded by the Edge Function upload-igc-track as text/plain; long
-- cross-country flights stay well below 10 MB.
UPDATE storage.buckets SET file_size_limit = 15728640,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif']
  WHERE id = 'flight-photos';
UPDATE storage.buckets SET file_size_limit = 10485760,
  allowed_mime_types = ARRAY['text/*', 'application/octet-stream']
  WHERE id = 'igc-files';

NOTIFY pgrst, 'reload schema';
