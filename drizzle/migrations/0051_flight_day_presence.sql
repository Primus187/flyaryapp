-- Flugtag-Cockpit 4.2: check-in and day status.
--
-- Found while building this: event_signups only has the policy "Users can update own signup".
-- The school team's attendance ticks and "confirm" button on other people's signups were
-- silently ignored (0 rows, no error, same pattern as 0024), while a student could set
-- attended / confirmed_by_school on their own signup. From now on:
--   * presence (expected / present / absent) replaces attended; attended stays as a generated
--     column so existing readers keep working,
--   * the team writes presence and the school confirmation only through the RPCs below,
--   * a trigger keeps presence, checked_in_at and confirmed_by_school unchanged when anyone
--     outside the day's team edits a signup (students keep signing up and off as before).
-- The pause of a day lives in its own table: event_signups is readable by every group member,
-- and a reason like "injury" is for the team only.

-- ── Presence on the signup ──────────────────────────────────────────────────
ALTER TABLE public.event_signups
  ADD COLUMN IF NOT EXISTS presence text NOT NULL DEFAULT 'expected'
    CHECK (presence IN ('expected', 'present', 'absent')),
  ADD COLUMN IF NOT EXISTS checked_in_at timestamptz;

-- Unticked signups stay 'expected' ("not recorded"): most past days were never ticked, so
-- marking them absent would be wrong.
UPDATE public.event_signups SET presence = 'present', checked_in_at = updated_at WHERE attended;
ALTER TABLE public.event_signups DROP COLUMN attended;
ALTER TABLE public.event_signups
  ADD COLUMN attended boolean GENERATED ALWAYS AS (presence = 'present') STORED;

CREATE OR REPLACE FUNCTION public.protect_signup_school_fields()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _role text;
BEGIN
  -- Service role, migrations and seed scripts have no auth.uid().
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  _role := public.flight_day_role(auth.uid(), NEW.event_id);
  IF TG_OP = 'INSERT' THEN
    IF _role IS NULL THEN
      NEW.presence := 'expected';
      NEW.checked_in_at := NULL;
    END IF;
    IF _role IS DISTINCT FROM 'instructor' THEN NEW.confirmed_by_school := false; END IF;
  ELSE
    IF _role IS NULL THEN
      NEW.presence := OLD.presence;
      NEW.checked_in_at := OLD.checked_in_at;
    END IF;
    IF _role IS DISTINCT FROM 'instructor' THEN NEW.confirmed_by_school := OLD.confirmed_by_school; END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.protect_signup_school_fields() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_signup_school_fields ON public.event_signups;
CREATE TRIGGER trg_signup_school_fields
  BEFORE INSERT OR UPDATE ON public.event_signups
  FOR EACH ROW EXECUTE FUNCTION public.protect_signup_school_fields();

-- ── Pause of a day (team only) ──────────────────────────────────────────────
CREATE TABLE public.event_day_pauses (
  event_id uuid NOT NULL REFERENCES public.flight_events(id) ON DELETE CASCADE,
  student_user_id uuid NOT NULL,
  reason text NOT NULL CHECK (reason IN ('material', 'fatigue', 'injury', 'weather', 'other')),
  note text,
  paused_by uuid,
  paused_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, student_user_id)
);

-- Former pause markers of the coaching sheet (student_day_notes.flight_number = -1).
INSERT INTO public.event_day_pauses (event_id, student_user_id, reason, paused_by, paused_at)
  SELECT event_id, student_user_id, 'other', instructor_id, created_at
  FROM public.student_day_notes WHERE flight_number = -1
  ON CONFLICT DO NOTHING;
DELETE FROM public.student_day_notes WHERE flight_number = -1;

ALTER TABLE public.event_day_pauses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.event_day_pauses FROM anon, authenticated;
GRANT SELECT ON public.event_day_pauses TO authenticated;
CREATE POLICY "Flight day team reads pauses" ON public.event_day_pauses
  FOR SELECT TO authenticated
  USING (public.flight_day_role(auth.uid(), event_id) IS NOT NULL);

-- ── RPCs ────────────────────────────────────────────────────────────────────
-- Checks the signup (any signed-up row, waitlist included, so a late move-up can be checked in).
CREATE OR REPLACE FUNCTION public.flight_day_require_signup(_event_id uuid, _student_id uuid)
RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.event_signups
                 WHERE event_id = _event_id AND user_id = _student_id AND signed_up) THEN
    RAISE EXCEPTION 'Student is not signed up for this flight day' USING ERRCODE = '23514';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.flight_day_require_signup(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- Team (launch helpers included): expected / present / absent.
CREATE OR REPLACE FUNCTION public.set_signup_presence(_event_id uuid, _student_id uuid, _presence text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.school_flight_guard(_event_id, 'helper');
  PERFORM public.flight_day_require_signup(_event_id, _student_id);
  IF _presence IS NULL OR _presence NOT IN ('expected', 'present', 'absent') THEN
    RAISE EXCEPTION 'Invalid presence' USING ERRCODE = '22023';
  END IF;
  UPDATE public.event_signups SET
    presence = _presence,
    checked_in_at = CASE WHEN _presence = 'present' THEN COALESCE(checked_in_at, now()) END,
    updated_at = now()
  WHERE event_id = _event_id AND user_id = _student_id;
  RETURN _presence;
END;
$$;

-- "Everyone is here": the given students still 'expected' become 'present'. The client passes
-- the list it shows (inactive students hidden), so nobody is checked in unseen.
CREATE OR REPLACE FUNCTION public.set_signups_present(_event_id uuid, _student_ids uuid[])
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _count integer;
BEGIN
  PERFORM public.school_flight_guard(_event_id, 'helper');
  UPDATE public.event_signups SET presence = 'present', checked_in_at = now(), updated_at = now()
  WHERE event_id = _event_id AND user_id = ANY(_student_ids) AND signed_up AND presence = 'expected';
  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$$;

-- Team: pause a student for today with a reason (NULL reason = resume). A paused student is
-- on site, so an 'expected' presence becomes 'present'.
CREATE OR REPLACE FUNCTION public.set_day_pause(
  _event_id uuid, _student_id uuid, _reason text, _note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.school_flight_guard(_event_id, 'helper');
  PERFORM public.flight_day_require_signup(_event_id, _student_id);
  IF _reason IS NULL THEN
    DELETE FROM public.event_day_pauses WHERE event_id = _event_id AND student_user_id = _student_id;
    RETURN;
  END IF;
  INSERT INTO public.event_day_pauses (event_id, student_user_id, reason, note, paused_by)
  VALUES (_event_id, _student_id, _reason, NULLIF(btrim(_note), ''), auth.uid())
  ON CONFLICT (event_id, student_user_id) DO UPDATE SET
    reason = EXCLUDED.reason, note = EXCLUDED.note, paused_by = EXCLUDED.paused_by, paused_at = now();
  UPDATE public.event_signups SET presence = 'present', checked_in_at = now(), updated_at = now()
  WHERE event_id = _event_id AND user_id = _student_id AND presence = 'expected';
END;
$$;

-- Instructors: the school confirms a signup (replaces the direct UPDATE that RLS ignored).
CREATE OR REPLACE FUNCTION public.set_signup_confirmed(_event_id uuid, _student_id uuid, _confirmed boolean)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.flight_day_role(auth.uid(), _event_id) IS DISTINCT FROM 'instructor' THEN
    RAISE EXCEPTION 'Flight day access required' USING ERRCODE = '42501';
  END IF;
  PERFORM public.flight_day_require_signup(_event_id, _student_id);
  UPDATE public.event_signups SET confirmed_by_school = COALESCE(_confirmed, false), updated_at = now()
  WHERE event_id = _event_id AND user_id = _student_id;
  RETURN COALESCE(_confirmed, false);
END;
$$;

DO $$
DECLARE _fn text;
BEGIN
  FOREACH _fn IN ARRAY ARRAY[
    'set_signup_presence(uuid, uuid, text)',
    'set_signups_present(uuid, uuid[])',
    'set_day_pause(uuid, uuid, text, text)',
    'set_signup_confirmed(uuid, uuid, boolean)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', _fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', _fn);
  END LOOP;
END $$;

-- ── The first recorded flight checks the student in ─────────────────────────
CREATE OR REPLACE FUNCTION public.school_flight_marks_present()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.event_signups SET presence = 'present', checked_in_at = now(), updated_at = now()
  WHERE event_id = NEW.event_id AND user_id = NEW.student_user_id AND presence = 'expected';
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.school_flight_marks_present() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_school_flight_marks_present ON public.event_school_flights;
CREATE TRIGGER trg_school_flight_marks_present
  AFTER INSERT ON public.event_school_flights
  FOR EACH ROW EXECUTE FUNCTION public.school_flight_marks_present();

-- ── Realtime: check-ins and pauses appear on every team phone ────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'event_signups') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.event_signups;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'event_day_pauses') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.event_day_pauses;
    END IF;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
