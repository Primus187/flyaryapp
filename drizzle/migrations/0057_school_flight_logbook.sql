-- Flugtag-Cockpit 6.1: students take the school's flights over into their own logbook (E3).
--
-- The school's record (event_school_flights) stays the proof; the logbook stays the student's.
-- After the day's release the student sees "the school recorded 3 flights" and takes them over:
-- each school flight becomes a new logbook entry or is linked to an entry the student already
-- made for that day. flights.school_flight_id is set only by import_school_flights (a trigger
-- rejects other changes), so nobody links an entry to someone else's school flight.
-- Deleting the logbook entry only drops the link (FKs ON DELETE SET NULL).
-- The sites are the instructor's locations; the student reads their names through the policy
-- "Sites of visible flights are readable" (own flight).

ALTER TABLE public.flights
  ADD COLUMN IF NOT EXISTS school_flight_id uuid UNIQUE REFERENCES public.event_school_flights(id) ON DELETE SET NULL;
ALTER TABLE public.event_signups
  ADD COLUMN IF NOT EXISTS logbook_import_dismissed_at timestamptz;

CREATE OR REPLACE FUNCTION public.protect_flight_school_link()
RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.school_flight_id IS NOT NULL
      OR TG_OP = 'UPDATE' AND NEW.school_flight_id IS DISTINCT FROM OLD.school_flight_id AND NEW.school_flight_id IS NOT NULL)
     AND COALESCE(current_setting('flyary.school_flight_link', true), '') <> 'on' THEN
    RAISE EXCEPTION 'School flights are linked through import_school_flights' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_protect_flight_school_link ON public.flights;
CREATE TRIGGER trg_protect_flight_school_link
  BEFORE INSERT OR UPDATE ON public.flights
  FOR EACH ROW EXECUTE FUNCTION public.protect_flight_school_link();

-- The student's released school flights that are not in the logbook yet, per flying day, with
-- the student's own entries of that day that could be linked instead. Days from 2026-09-25 on.
CREATE OR REPLACE FUNCTION public.my_school_flight_imports()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(day ORDER BY day->>'date' DESC), '[]'::jsonb) FROM (
    SELECT jsonb_build_object(
      'eventId', e.id,
      'title', e.title,
      'date', (e.event_date AT TIME ZONE 'Europe/Zurich')::date,
      'groupId', e.group_id,
      'flights', (
        SELECT jsonb_agg(jsonb_build_object(
          'id', f.id, 'number', f.number, 'startedAt', f.started_at, 'landedAt', f.landed_at,
          'takeoff', lt.name, 'landing', ll.name) ORDER BY f.number)
        FROM (SELECT sf.*, row_number() OVER (ORDER BY sf.seq) AS number FROM public.event_school_flights sf
              WHERE sf.event_id = e.id AND sf.student_user_id = auth.uid() AND sf.status = 'landed') f
        LEFT JOIN public.locations lt ON lt.id = f.takeoff_location_id
        LEFT JOIN public.locations ll ON ll.id = f.landing_location_id
        WHERE f.logbook_flight_id IS NULL),
      'candidates', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('id', fl.id, 'createdAt', fl.created_at, 'durationMinutes', fl.duration_minutes,
                                            'takeoff', lt.name) ORDER BY fl.created_at)
        FROM public.flights fl LEFT JOIN public.locations lt ON lt.id = fl.takeoff_location_id
        WHERE fl.user_id = auth.uid() AND fl.school_flight_id IS NULL
          AND (fl.event_id = e.id OR (fl.group_id = e.group_id AND fl.date = (e.event_date AT TIME ZONE 'Europe/Zurich')::date))), '[]'::jsonb)
    ) AS day
    FROM public.flight_events e
    JOIN public.event_signups s ON s.event_id = e.id AND s.user_id = auth.uid()
    WHERE s.logbook_import_dismissed_at IS NULL
      AND e.event_date >= timestamptz '2026-09-25 00:00 Europe/Zurich'
      AND public.flight_day_feedback_released(e.id)
      AND EXISTS (SELECT 1 FROM public.event_school_flights sf WHERE sf.event_id = e.id AND sf.student_user_id = auth.uid()
                  AND sf.status = 'landed' AND sf.logbook_flight_id IS NULL)
  ) days
$$;

-- Takes school flights over: _links = [{"schoolFlightId": uuid, "flightId": uuid | null}, …].
-- flightId null creates a logbook entry, otherwise the student's own entry is linked.
CREATE OR REPLACE FUNCTION public.import_school_flights(_event_id uuid, _links jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _event public.flight_events; _link jsonb; _sf public.event_school_flights; _target uuid;
        _created integer := 0; _linked integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in' USING ERRCODE = '42501'; END IF;
  SELECT * INTO _event FROM public.flight_events WHERE id = _event_id;
  IF _event.id IS NULL THEN RAISE EXCEPTION 'Event not found' USING ERRCODE = 'P0002'; END IF;
  IF NOT public.flight_day_feedback_released(_event_id) THEN
    RAISE EXCEPTION 'Flight day not released yet' USING ERRCODE = '55000';
  END IF;
  IF _links IS NULL OR jsonb_typeof(_links) <> 'array' THEN RAISE EXCEPTION 'Invalid links' USING ERRCODE = '22023'; END IF;
  PERFORM set_config('flyary.school_flight_link', 'on', true);

  FOR _link IN SELECT * FROM jsonb_array_elements(_links) LOOP
    SELECT * INTO _sf FROM public.event_school_flights
    WHERE id = (_link->>'schoolFlightId')::uuid AND event_id = _event_id AND student_user_id = auth.uid()
      AND status = 'landed' AND logbook_flight_id IS NULL
    FOR UPDATE;
    IF _sf.id IS NULL THEN RAISE EXCEPTION 'School flight not available' USING ERRCODE = 'P0002'; END IF;

    IF _link->>'flightId' IS NULL THEN
      INSERT INTO public.flights (user_id, date, takeoff_location_id, landing_location_id, duration_minutes, group_id, event_id, school_flight_id)
      VALUES (auth.uid(), (_event.event_date AT TIME ZONE 'Europe/Zurich')::date, _sf.takeoff_location_id, _sf.landing_location_id,
              CASE WHEN _sf.started_at IS NOT NULL AND _sf.landed_at IS NOT NULL
                   THEN GREATEST(1, floor(extract(epoch FROM _sf.landed_at - _sf.started_at) / 60))::integer END,
              _event.group_id, _event_id, _sf.id)
      RETURNING id INTO _target;
      _created := _created + 1;
    ELSE
      UPDATE public.flights SET school_flight_id = _sf.id, event_id = COALESCE(event_id, _event_id)
      WHERE id = (_link->>'flightId')::uuid AND user_id = auth.uid() AND school_flight_id IS NULL
      RETURNING id INTO _target;
      IF _target IS NULL THEN RAISE EXCEPTION 'Logbook flight not available' USING ERRCODE = 'P0002'; END IF;
      _linked := _linked + 1;
    END IF;
    UPDATE public.event_school_flights SET logbook_flight_id = _target WHERE id = _sf.id;
    _target := NULL;
  END LOOP;

  PERFORM set_config('flyary.school_flight_link', '', true);
  RETURN jsonb_build_object('created', _created, 'linked', _linked);
END;
$$;

-- "Not now": hides the day's card for the student (own signup).
CREATE OR REPLACE FUNCTION public.dismiss_school_flight_import(_event_id uuid)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.event_signups SET logbook_import_dismissed_at = now()
  WHERE event_id = _event_id AND user_id = auth.uid()
$$;

DO $$
DECLARE _fn text;
BEGIN
  FOREACH _fn IN ARRAY ARRAY['my_school_flight_imports()', 'import_school_flights(uuid, jsonb)', 'dismiss_school_flight_import(uuid)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', _fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', _fn);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
