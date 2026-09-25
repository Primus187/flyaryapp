-- Flugtag-Cockpit 4.1: flights of a school flying day, recorded by the school team.
--
-- event_school_flights is the school's own record (SHV proof), separate from the student's
-- private logbook (flights). It holds only operational data (who, when, where, status) and is
-- readable by the whole team of the day, launch helpers included, and published over Realtime.
-- Feedback for the student and internal notes live in event_school_flight_notes, readable by
-- instructors only: a column-level REVOKE does nothing while a table grant exists (profiles
-- audit 2026-09-24), and Realtime would ship every column to helpers otherwise.
-- Students never read either table directly; they get their released flights through
-- my_school_flights(). All writes go through the RPCs below (pattern of set_event_status, 0024).
-- No foreign key to auth.users (like student_day_notes): the record stays with the school
-- when a student deletes the account.

-- ── Event defaults and day closing ──────────────────────────────────────────
ALTER TABLE public.flight_events
  ADD COLUMN IF NOT EXISTS default_takeoff_location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS default_landing_location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS day_closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS day_closed_by uuid,
  ADD COLUMN IF NOT EXISTS feedback_released_at timestamptz;

-- ── Tables ──────────────────────────────────────────────────────────────────
CREATE TABLE public.event_school_flights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.flight_events(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  student_user_id uuid NOT NULL,
  seq integer NOT NULL CHECK (seq > 0),
  status text NOT NULL CHECK (status IN ('in_air', 'landed', 'aborted')),
  started_at timestamptz,
  landed_at timestamptz,
  takeoff_location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  landing_location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  start_note text,
  created_by uuid,
  landed_by uuid,
  logbook_flight_id uuid REFERENCES public.flights(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, student_user_id, seq),
  CHECK ((status = 'landed') = (landed_at IS NOT NULL)),
  CHECK (status <> 'in_air' OR started_at IS NOT NULL),
  CHECK (landed_at IS NULL OR started_at IS NULL OR landed_at >= started_at)
);
-- At most one flight per student and day in the air at a time (backstop for the RPC check).
CREATE UNIQUE INDEX event_school_flights_one_in_air
  ON public.event_school_flights (event_id, student_user_id) WHERE status = 'in_air';
CREATE INDEX event_school_flights_event ON public.event_school_flights (event_id);
CREATE INDEX event_school_flights_student ON public.event_school_flights (group_id, student_user_id);

CREATE TABLE public.event_school_flight_notes (
  flight_id uuid PRIMARY KEY REFERENCES public.event_school_flights(id) ON DELETE CASCADE,
  feedback text,
  internal_note text,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ── Roles for a flying day ──────────────────────────────────────────────────
-- 'instructor': school staff (admin, instructor, school lead) or assigned as instructor to the event.
-- 'helper': launch helper of the school or assigned as launch helper to the event.
-- NULL: anyone else, and every event of a non-school group.
CREATE OR REPLACE FUNCTION public.flight_day_role(_user_id uuid, _event_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN _user_id IS NULL OR g.group_type IS DISTINCT FROM 'school' THEN NULL
    WHEN public.is_group_staff(_user_id, e.group_id)
      OR EXISTS (SELECT 1 FROM public.event_staff s WHERE s.event_id = e.id AND s.user_id = _user_id AND s.role = 'instructor')
      THEN 'instructor'
    WHEN public.is_group_team_member(_user_id, e.group_id)
      OR EXISTS (SELECT 1 FROM public.event_staff s WHERE s.event_id = e.id AND s.user_id = _user_id AND s.role = 'launch_helper')
      THEN 'helper'
  END
  FROM public.flight_events e JOIN public.groups g ON g.id = e.group_id
  WHERE e.id = _event_id
$$;
REVOKE ALL ON FUNCTION public.flight_day_role(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.flight_day_role(uuid, uuid) TO authenticated;

-- Shared checks for every write: event exists, caller has the role, day is still open.
CREATE OR REPLACE FUNCTION public.school_flight_guard(_event_id uuid, _need text)
RETURNS public.flight_events
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _event public.flight_events; _role text;
BEGIN
  SELECT * INTO _event FROM public.flight_events WHERE id = _event_id;
  IF _event.id IS NULL THEN
    RAISE EXCEPTION 'Event not found' USING ERRCODE = 'P0002';
  END IF;
  _role := public.flight_day_role(auth.uid(), _event_id);
  IF _role IS NULL OR (_need = 'instructor' AND _role <> 'instructor') THEN
    RAISE EXCEPTION 'Flight day access required' USING ERRCODE = '42501';
  END IF;
  IF _event.day_closed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Flight day is closed' USING ERRCODE = '55000';
  END IF;
  RETURN _event;
END;
$$;
REVOKE ALL ON FUNCTION public.school_flight_guard(uuid, text) FROM PUBLIC, anon, authenticated;

-- Locks the student's signup row (serialises seq numbering) and checks the confirmed place.
CREATE OR REPLACE FUNCTION public.school_flight_next_seq(_event_id uuid, _student_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM 1 FROM public.event_signups
    WHERE event_id = _event_id AND user_id = _student_id AND signed_up AND status = 'confirmed'
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Student is not signed up for this flight day' USING ERRCODE = '23514';
  END IF;
  RETURN COALESCE((SELECT max(seq) FROM public.event_school_flights
    WHERE event_id = _event_id AND student_user_id = _student_id), 0) + 1;
END;
$$;
REVOKE ALL ON FUNCTION public.school_flight_next_seq(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- Default site: the one used last on this day, else the event default.
CREATE OR REPLACE FUNCTION public.school_flight_default_location(_event_id uuid, _kind text)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT CASE WHEN _kind = 'takeoff' THEN f.takeoff_location_id ELSE f.landing_location_id END
       FROM public.event_school_flights f
      WHERE f.event_id = _event_id
        AND (CASE WHEN _kind = 'takeoff' THEN f.takeoff_location_id ELSE f.landing_location_id END) IS NOT NULL
      ORDER BY f.updated_at DESC LIMIT 1),
    (SELECT CASE WHEN _kind = 'takeoff' THEN e.default_takeoff_location_id ELSE e.default_landing_location_id END
       FROM public.flight_events e WHERE e.id = _event_id))
$$;
REVOKE ALL ON FUNCTION public.school_flight_default_location(uuid, text) FROM PUBLIC, anon, authenticated;

-- Writes feedback / internal note; keys missing from _patch stay unchanged.
CREATE OR REPLACE FUNCTION public.school_flight_write_notes(_flight_id uuid, _patch jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _patch IS NULL OR NOT (_patch ? 'feedback' OR _patch ? 'internal_note') THEN RETURN; END IF;
  INSERT INTO public.event_school_flight_notes AS n (flight_id, feedback, internal_note, updated_by)
  VALUES (_flight_id, NULLIF(btrim(_patch->>'feedback'), ''), NULLIF(btrim(_patch->>'internal_note'), ''), auth.uid())
  ON CONFLICT (flight_id) DO UPDATE SET
    feedback = CASE WHEN _patch ? 'feedback' THEN EXCLUDED.feedback ELSE n.feedback END,
    internal_note = CASE WHEN _patch ? 'internal_note' THEN EXCLUDED.internal_note ELSE n.internal_note END,
    updated_by = auth.uid(),
    updated_at = now();
END;
$$;
REVOKE ALL ON FUNCTION public.school_flight_write_notes(uuid, jsonb) FROM PUBLIC, anon, authenticated;

-- ── Client RPCs ─────────────────────────────────────────────────────────────
-- Launch helper or instructor at take-off: the student is now in the air.
CREATE OR REPLACE FUNCTION public.school_flight_start(
  _event_id uuid, _student_id uuid, _takeoff_location_id uuid DEFAULT NULL, _note text DEFAULT NULL)
RETURNS public.event_school_flights
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _event public.flight_events; _seq integer; _row public.event_school_flights;
BEGIN
  _event := public.school_flight_guard(_event_id, 'helper');
  _seq := public.school_flight_next_seq(_event_id, _student_id);
  IF EXISTS (SELECT 1 FROM public.event_school_flights
             WHERE event_id = _event_id AND student_user_id = _student_id AND status = 'in_air') THEN
    RAISE EXCEPTION 'Student is already in the air' USING ERRCODE = '23505';
  END IF;
  INSERT INTO public.event_school_flights
    (event_id, group_id, student_user_id, seq, status, started_at, takeoff_location_id, start_note, created_by)
  VALUES (_event_id, _event.group_id, _student_id, _seq, 'in_air', now(),
    COALESCE(_takeoff_location_id, public.school_flight_default_location(_event_id, 'takeoff')),
    NULLIF(btrim(_note), ''), auth.uid())
  RETURNING * INTO _row;
  RETURN _row;
END;
$$;

-- Instructor at the landing field: the flight in the air has landed.
CREATE OR REPLACE FUNCTION public.school_flight_land(
  _flight_id uuid, _landing_location_id uuid DEFAULT NULL, _notes jsonb DEFAULT NULL)
RETURNS public.event_school_flights
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _row public.event_school_flights;
BEGIN
  SELECT * INTO _row FROM public.event_school_flights WHERE id = _flight_id FOR UPDATE;
  IF _row.id IS NULL THEN RAISE EXCEPTION 'Flight not found' USING ERRCODE = 'P0002'; END IF;
  PERFORM public.school_flight_guard(_row.event_id, 'instructor');
  IF _row.status <> 'in_air' THEN
    RAISE EXCEPTION 'Flight is not in the air' USING ERRCODE = '55000';
  END IF;
  UPDATE public.event_school_flights SET
    status = 'landed', landed_at = now(), landed_by = auth.uid(), updated_at = now(),
    landing_location_id = COALESCE(_landing_location_id, public.school_flight_default_location(event_id, 'landing'))
  WHERE id = _flight_id RETURNING * INTO _row;
  PERFORM public.school_flight_write_notes(_flight_id, _notes);
  RETURN _row;
END;
$$;

-- Instructor records a flight without a recorded start (forgotten start, practice slope).
CREATE OR REPLACE FUNCTION public.school_flight_add(
  _event_id uuid, _student_id uuid, _takeoff_location_id uuid DEFAULT NULL,
  _landing_location_id uuid DEFAULT NULL, _notes jsonb DEFAULT NULL)
RETURNS public.event_school_flights
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _event public.flight_events; _seq integer; _row public.event_school_flights;
BEGIN
  _event := public.school_flight_guard(_event_id, 'instructor');
  _seq := public.school_flight_next_seq(_event_id, _student_id);
  INSERT INTO public.event_school_flights
    (event_id, group_id, student_user_id, seq, status, landed_at, takeoff_location_id,
     landing_location_id, created_by, landed_by)
  VALUES (_event_id, _event.group_id, _student_id, _seq, 'landed', now(),
    COALESCE(_takeoff_location_id, public.school_flight_default_location(_event_id, 'takeoff')),
    COALESCE(_landing_location_id, public.school_flight_default_location(_event_id, 'landing')),
    auth.uid(), auth.uid())
  RETURNING * INTO _row;
  PERFORM public.school_flight_write_notes(_row.id, _notes);
  RETURN _row;
END;
$$;

-- Aborted launch: stays visible to the team, never counts as a flight or reaches the student.
CREATE OR REPLACE FUNCTION public.school_flight_abort(_flight_id uuid, _note text DEFAULT NULL)
RETURNS public.event_school_flights
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _row public.event_school_flights;
BEGIN
  SELECT * INTO _row FROM public.event_school_flights WHERE id = _flight_id FOR UPDATE;
  IF _row.id IS NULL THEN RAISE EXCEPTION 'Flight not found' USING ERRCODE = 'P0002'; END IF;
  PERFORM public.school_flight_guard(_row.event_id, 'helper');
  IF _row.status <> 'in_air' THEN
    RAISE EXCEPTION 'Flight is not in the air' USING ERRCODE = '55000';
  END IF;
  UPDATE public.event_school_flights SET status = 'aborted', updated_at = now(),
    start_note = COALESCE(NULLIF(btrim(_note), ''), start_note)
  WHERE id = _flight_id RETURNING * INTO _row;
  RETURN _row;
END;
$$;

-- Corrections. Helpers may change the take-off site and start note; instructors also the landing
-- site. Keys missing from _patch stay unchanged; JSON null clears a field.
CREATE OR REPLACE FUNCTION public.school_flight_update(_flight_id uuid, _patch jsonb)
RETURNS public.event_school_flights
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _row public.event_school_flights; _role text;
BEGIN
  SELECT * INTO _row FROM public.event_school_flights WHERE id = _flight_id FOR UPDATE;
  IF _row.id IS NULL THEN RAISE EXCEPTION 'Flight not found' USING ERRCODE = 'P0002'; END IF;
  PERFORM public.school_flight_guard(_row.event_id, 'helper');
  _role := public.flight_day_role(auth.uid(), _row.event_id);
  IF _role <> 'instructor' AND _patch ? 'landing_location_id' THEN
    RAISE EXCEPTION 'Flight day access required' USING ERRCODE = '42501';
  END IF;
  UPDATE public.event_school_flights SET
    takeoff_location_id = CASE WHEN _patch ? 'takeoff_location_id' THEN (_patch->>'takeoff_location_id')::uuid ELSE takeoff_location_id END,
    landing_location_id = CASE WHEN _patch ? 'landing_location_id' THEN (_patch->>'landing_location_id')::uuid ELSE landing_location_id END,
    start_note = CASE WHEN _patch ? 'start_note' THEN NULLIF(btrim(_patch->>'start_note'), '') ELSE start_note END,
    updated_at = now()
  WHERE id = _flight_id RETURNING * INTO _row;
  RETURN _row;
END;
$$;

-- Instructor edits feedback and internal note (autosave sends one key at a time).
CREATE OR REPLACE FUNCTION public.school_flight_set_notes(_flight_id uuid, _patch jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _event uuid;
BEGIN
  SELECT event_id INTO _event FROM public.event_school_flights WHERE id = _flight_id;
  IF _event IS NULL THEN RAISE EXCEPTION 'Flight not found' USING ERRCODE = 'P0002'; END IF;
  PERFORM public.school_flight_guard(_event, 'instructor');
  PERFORM public.school_flight_write_notes(_flight_id, _patch);
END;
$$;

-- Instructor deletes a wrongly recorded flight while the day is open. seq is not renumbered.
CREATE OR REPLACE FUNCTION public.school_flight_delete(_flight_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _event uuid;
BEGIN
  SELECT event_id INTO _event FROM public.event_school_flights WHERE id = _flight_id;
  IF _event IS NULL THEN RAISE EXCEPTION 'Flight not found' USING ERRCODE = 'P0002'; END IF;
  PERFORM public.school_flight_guard(_event, 'instructor');
  DELETE FROM public.event_school_flights WHERE id = _flight_id;
END;
$$;

-- Instructor sets the default take-off and landing site of the day (instructors cannot UPDATE
-- flight_events directly, see 0024).
CREATE OR REPLACE FUNCTION public.set_flight_day_locations(
  _event_id uuid, _takeoff_location_id uuid, _landing_location_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.school_flight_guard(_event_id, 'instructor');
  UPDATE public.flight_events SET
    default_takeoff_location_id = _takeoff_location_id,
    default_landing_location_id = _landing_location_id
  WHERE id = _event_id;
END;
$$;

-- The student's own flights of a day with feedback, once released (E8). Aborted launches,
-- start notes and internal notes are never included.
CREATE OR REPLACE FUNCTION public.my_school_flights(_event_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', f.id,
      'number', f.number,
      'startedAt', f.started_at,
      'landedAt', f.landed_at,
      'takeoff', lt.name,
      'landing', ll.name,
      'feedback', n.feedback
    ) ORDER BY f.number), '[]'::jsonb)
  FROM (
    SELECT sf.*, row_number() OVER (ORDER BY sf.seq) AS number
    FROM public.event_school_flights sf
    WHERE sf.event_id = _event_id AND sf.student_user_id = auth.uid() AND sf.status = 'landed'
  ) f
  JOIN public.flight_events e ON e.id = f.event_id
  LEFT JOIN public.event_school_flight_notes n ON n.flight_id = f.id
  LEFT JOIN public.locations lt ON lt.id = f.takeoff_location_id
  LEFT JOIN public.locations ll ON ll.id = f.landing_location_id
  WHERE e.feedback_released_at IS NOT NULL AND e.feedback_released_at <= now()
$$;

DO $$
DECLARE _fn text;
BEGIN
  FOREACH _fn IN ARRAY ARRAY[
    'school_flight_start(uuid, uuid, uuid, text)',
    'school_flight_land(uuid, uuid, jsonb)',
    'school_flight_add(uuid, uuid, uuid, uuid, jsonb)',
    'school_flight_abort(uuid, text)',
    'school_flight_update(uuid, jsonb)',
    'school_flight_set_notes(uuid, jsonb)',
    'school_flight_delete(uuid)',
    'set_flight_day_locations(uuid, uuid, uuid)',
    'my_school_flights(uuid)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', _fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', _fn);
  END LOOP;
END $$;

-- ── Row level security: read only, writes only through the RPCs ─────────────
ALTER TABLE public.event_school_flights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_school_flight_notes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.event_school_flights FROM anon, authenticated;
REVOKE ALL ON public.event_school_flight_notes FROM anon, authenticated;
GRANT SELECT ON public.event_school_flights TO authenticated;
GRANT SELECT ON public.event_school_flight_notes TO authenticated;

CREATE POLICY "Flight day team reads flights" ON public.event_school_flights
  FOR SELECT TO authenticated
  USING (public.flight_day_role(auth.uid(), event_id) IS NOT NULL);

CREATE POLICY "Instructors read flight notes" ON public.event_school_flight_notes
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.event_school_flights f
    WHERE f.id = flight_id AND public.flight_day_role(auth.uid(), f.event_id) = 'instructor'));

-- ── Realtime: take-off and landing views stay in sync (RLS applies) ──────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'event_school_flights') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.event_school_flights;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
