-- Ausbildungsstand along the SHV, step 1: data model (decisions 2026-10-06).
--
-- A user is a student (before the pilot licence) or a pilot. profiles.training_level stays the one
-- status field, now with one vocabulary: ground, altitude, exam_ready (student) and licensed (pilot).
-- Further licences (tandem) are rows in pilot_licences; profiles.licence_goal holds the licence a
-- pilot is working towards.
--
-- * The two vocabularies (school stages and the Settings select grundkurs/brevetkurs/siku/pilot) are
--   merged. Old values are still accepted and translated, so app versions that are still cached on a
--   phone keep working.
-- * New profiles start without a level (the app asks once) instead of 'grundkurs'.
-- * Self-declaration is enough for the pilot licence: a school student may set the own level to
--   licensed, in this one direction only. All other levels stay with the school (0080), otherwise
--   students could read the channels of other levels again.
-- * A self-declared licence is logged in the level history of the student's schools, so it counts
--   for the SHV minimum performance like one set by the school (changed_by = the student).
-- * Entering a licence makes its holder a pilot.

-- 1. One vocabulary
CREATE OR REPLACE FUNCTION public.normalize_training_level(_level text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE lower(btrim(coalesce(_level, '')))
    WHEN '' THEN NULL
    WHEN 'ground' THEN 'ground' WHEN 'grundkurs' THEN 'ground'
    WHEN 'altitude' THEN 'altitude' WHEN 'brevetkurs' THEN 'altitude'
    WHEN 'exam_ready' THEN 'exam_ready'
    WHEN 'licensed' THEN 'licensed' WHEN 'pilot' THEN 'licensed' WHEN 'siku' THEN 'licensed'
    ELSE _level END;
$$;
REVOKE ALL ON FUNCTION public.normalize_training_level(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.normalize_training_level(text) TO authenticated;

UPDATE public.profiles SET training_level = public.normalize_training_level(training_level)
  WHERE training_level IS DISTINCT FROM public.normalize_training_level(training_level);
UPDATE public.training_level_history SET training_level = public.normalize_training_level(training_level)
  WHERE training_level IS DISTINCT FROM public.normalize_training_level(training_level);

ALTER TABLE public.profiles ALTER COLUMN training_level DROP DEFAULT;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_training_level_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_training_level_check
  CHECK (training_level IS NULL OR training_level IN ('ground', 'altitude', 'exam_ready', 'licensed'));

-- 2. The licence a pilot is working towards (licences with requirements, see training_requirements)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS licence_goal text;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_licence_goal_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_licence_goal_check
  CHECK (licence_goal IS NULL OR licence_goal IN ('biplace_1', 'biplace_3', 'biplace_3_renewal'));
GRANT SELECT (licence_goal) ON public.profiles TO authenticated;

-- 3. Own level: translated on every write; a school student may only declare the pilot licence.
CREATE OR REPLACE FUNCTION public.guard_own_training_level()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.training_level := public.normalize_training_level(NEW.training_level);
  IF TG_OP = 'UPDATE' AND NEW.training_level IS DISTINCT FROM OLD.training_level
     AND NEW.training_level IS DISTINCT FROM 'licensed'
     AND auth.uid() = NEW.user_id AND public.is_school_student(NEW.user_id) THEN
    RAISE EXCEPTION 'Your flight school sets your training level' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_own_training_level() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS profiles_guard_training_level ON public.profiles;
CREATE TRIGGER profiles_guard_training_level BEFORE INSERT OR UPDATE OF training_level ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_own_training_level();

-- A self-declared pilot licence goes into the history of the schools the person is a student of.
CREATE OR REPLACE FUNCTION public.log_own_pilot_licence()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.training_level = 'licensed' AND OLD.training_level IS DISTINCT FROM 'licensed' AND auth.uid() = NEW.user_id THEN
    INSERT INTO public.training_level_history (group_id, user_id, training_level, changed_by)
    SELECT gm.group_id, NEW.user_id, 'licensed', NEW.user_id
    FROM public.group_members gm JOIN public.groups g ON g.id = gm.group_id
    WHERE gm.user_id = NEW.user_id AND g.group_type = 'school'
      AND NOT public.is_group_team_member(NEW.user_id, g.id);
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.log_own_pilot_licence() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS profiles_log_own_pilot_licence ON public.profiles;
CREATE TRIGGER profiles_log_own_pilot_licence AFTER UPDATE OF training_level ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.log_own_pilot_licence();

-- 4. Whoever enters a licence is a pilot.
CREATE OR REPLACE FUNCTION public.licence_makes_pilot()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles SET training_level = 'licensed'
    WHERE user_id = NEW.user_id AND training_level IS DISTINCT FROM 'licensed';
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.licence_makes_pilot() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS pilot_licences_make_pilot ON public.pilot_licences;
CREATE TRIGGER pilot_licences_make_pilot AFTER INSERT ON public.pilot_licences
  FOR EACH ROW EXECUTE FUNCTION public.licence_makes_pilot();

-- 5. The school sets a level: same vocabulary, unknown values are refused.
CREATE OR REPLACE FUNCTION public.set_member_training_level(_group_id uuid, _user_id uuid, _training_level text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _previous text;
  _level text := public.normalize_training_level(_training_level);
BEGIN
  IF NOT public.is_group_staff(auth.uid(), _group_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF NOT public.is_group_member(_user_id, _group_id) THEN
    RAISE EXCEPTION 'Target user is not a group member';
  END IF;
  IF _level IS NOT NULL AND _level NOT IN ('ground', 'altitude', 'exam_ready', 'licensed') THEN
    RAISE EXCEPTION 'Unknown training level' USING ERRCODE = '22023';
  END IF;

  SELECT training_level INTO _previous FROM public.profiles WHERE user_id = _user_id;
  UPDATE public.profiles SET training_level = _level, updated_at = now() WHERE user_id = _user_id;

  IF _previous IS DISTINCT FROM _level AND _level IS NOT NULL THEN
    INSERT INTO public.training_level_history (group_id, user_id, training_level, changed_by)
    VALUES (_group_id, _user_id, _level, auth.uid());
  END IF;
END;
$$;
