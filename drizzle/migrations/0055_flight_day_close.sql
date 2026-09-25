-- Flugtag-Cockpit C2 (5.1, 5.2): closing a flying day.
--
-- The client-side "book credits & items" (EventAttendance.book) is replaced by one server call:
-- close_flight_day returns loans, books launch-leader credits and rental items, closes the day
-- and releases the feedback to the students (with one push each), all in one transaction.
-- Rental items are booked only for students with a loan on that day (decision 2026-09-25), not
-- for everybody present. Unique indexes rule out double bookings.
-- flight_day_daily_run (scheduled hourly in 0056) covers days nobody closed: at 06:00 Swiss time
-- the day after it marks the feedback released and pushes the students once, and it reminds the
-- day's instructors once that the day is still open.

-- ── Guards against double bookings (no duplicates exist, checked 2026-09-25) ──
CREATE UNIQUE INDEX IF NOT EXISTS launch_leader_credits_one_per_event
  ON public.launch_leader_credits (event_id, user_id) WHERE event_id IS NOT NULL AND entry_type = 'earned';
CREATE UNIQUE INDEX IF NOT EXISTS billing_items_one_rental_per_event
  ON public.billing_items (event_id, user_id) WHERE event_id IS NOT NULL AND item_type = 'rental';

ALTER TABLE public.flight_events
  ADD COLUMN IF NOT EXISTS feedback_notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS close_reminded_at timestamptz;

-- ── Helpers ─────────────────────────────────────────────────────────────────
-- Calendar day of the event in Switzerland (flights, loans and bookings use local dates).
CREATE OR REPLACE FUNCTION public.flight_day_local_date(_event_id uuid)
RETURNS date
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (event_date AT TIME ZONE 'Europe/Zurich')::date FROM public.flight_events WHERE id = _event_id
$$;
REVOKE ALL ON FUNCTION public.flight_day_local_date(uuid) FROM PUBLIC, anon, authenticated;

-- The school's rate valid on that day (latest valid_from on or before it), 0 when none is set.
CREATE OR REPLACE FUNCTION public.flight_day_rate(_group_id uuid, _key text, _day date)
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT amount FROM public.school_rates
                   WHERE group_id = _group_id AND rate_key = _key AND valid_from <= _day
                   ORDER BY valid_from DESC LIMIT 1), 0)
$$;
REVOKE ALL ON FUNCTION public.flight_day_rate(uuid, text, date) FROM PUBLIC, anon, authenticated;

-- Loans of a student that cover the day (issued for this event, or issued before and not yet
-- returned on that day).
CREATE OR REPLACE FUNCTION public.flight_day_has_loan(_event_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.equipment_assignments a JOIN public.flight_events e ON e.id = _event_id
    WHERE a.user_id = _user_id AND a.group_id = e.group_id
      AND (a.event_id = _event_id
           OR (a.assigned_on <= public.flight_day_local_date(_event_id)
               AND (a.returned_on IS NULL OR a.returned_on >= public.flight_day_local_date(_event_id)))))
$$;
REVOKE ALL ON FUNCTION public.flight_day_has_loan(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- Students with something to read on that day: a landed school flight or a summary for them.
CREATE OR REPLACE FUNCTION public.flight_day_feedback_recipients(_event_id uuid)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT student_user_id FROM public.event_school_flights WHERE event_id = _event_id AND status = 'landed'
  UNION
  SELECT student_user_id FROM public.student_day_notes
  WHERE event_id = _event_id AND visible_to_student AND btrim(note) <> ''
$$;
REVOKE ALL ON FUNCTION public.flight_day_feedback_recipients(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.flight_day_notify_students(_event_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _title text; _uid uuid; _count integer := 0;
BEGIN
  SELECT title INTO _title FROM public.flight_events WHERE id = _event_id;
  FOR _uid IN SELECT * FROM public.flight_day_feedback_recipients(_event_id) LOOP
    PERFORM public.send_push_notification(_uid, 'Deine Rückmeldung ist da',
      'Zum Flugtag «' || COALESCE(_title, 'Flugtag') || '» gibt es eine Rückmeldung.', '/events/' || _event_id || '?tab=feedback');
    _count := _count + 1;
  END LOOP;
  UPDATE public.flight_events SET feedback_notified_at = now() WHERE id = _event_id;
  RETURN _count;
END;
$$;
REVOKE ALL ON FUNCTION public.flight_day_notify_students(uuid) FROM PUBLIC, anon, authenticated;

-- ── Preview for the closing wizard ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.flight_day_close_preview(_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _event public.flight_events; _day date; _credit numeric; _rental numeric;
BEGIN
  SELECT * INTO _event FROM public.flight_events WHERE id = _event_id;
  IF _event.id IS NULL THEN RAISE EXCEPTION 'Event not found' USING ERRCODE = 'P0002'; END IF;
  IF public.flight_day_role(auth.uid(), _event_id) IS DISTINCT FROM 'instructor' THEN
    RAISE EXCEPTION 'Flight day access required' USING ERRCODE = '42501';
  END IF;
  _day := public.flight_day_local_date(_event_id);
  _credit := public.flight_day_rate(_event.group_id, 'launch_leader_per_day', _day);
  _rental := public.flight_day_rate(_event.group_id, 'rental_per_day', _day);

  RETURN jsonb_build_object(
    'closedAt', _event.day_closed_at,
    'closedBy', (SELECT pilot_name FROM public.profiles WHERE user_id = _event.day_closed_by),
    'inAir', COALESCE((SELECT jsonb_agg(jsonb_build_object('flightId', id, 'studentId', student_user_id))
                       FROM public.event_school_flights WHERE event_id = _event_id AND status = 'in_air'), '[]'::jsonb),
    'expected', COALESCE((SELECT jsonb_agg(user_id) FROM public.event_signups
                          WHERE event_id = _event_id AND signed_up AND status = 'confirmed' AND presence = 'expected'), '[]'::jsonb),
    'missingTakeoff', (SELECT count(*) FROM public.event_school_flights
                       WHERE event_id = _event_id AND status = 'landed' AND takeoff_location_id IS NULL),
    'defaultTakeoff', _event.default_takeoff_location_id,
    'summaries', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'studentId', s.user_id,
        'hasSummary', EXISTS (SELECT 1 FROM public.student_day_notes n WHERE n.event_id = _event_id
                              AND n.student_user_id = s.user_id AND n.flight_number IS NULL AND btrim(n.note) <> ''),
        'feedback', COALESCE((SELECT jsonb_agg(fn.feedback ORDER BY f.seq)
                              FROM public.event_school_flights f JOIN public.event_school_flight_notes fn ON fn.flight_id = f.id
                              WHERE f.event_id = _event_id AND f.student_user_id = s.user_id AND f.status = 'landed'
                                AND btrim(COALESCE(fn.feedback, '')) <> ''), '[]'::jsonb)))
      FROM public.event_signups s
      WHERE s.event_id = _event_id AND s.signed_up AND s.status = 'confirmed' AND s.presence = 'present'), '[]'::jsonb),
    'loans', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', a.id, 'userId', a.user_id, 'equipment', eq.name,
                                          'inventoryNumber', eq.inventory_number, 'assignedOn', a.assigned_on) ORDER BY a.assigned_on)
      FROM public.equipment_assignments a JOIN public.school_equipment eq ON eq.id = a.equipment_id
      WHERE a.group_id = _event.group_id AND a.returned_on IS NULL
        AND (a.event_id = _event_id OR a.user_id IN (SELECT user_id FROM public.event_signups
                                                     WHERE event_id = _event_id AND signed_up AND presence = 'present'))), '[]'::jsonb),
    'creditRate', _credit,
    'rentalRate', _rental,
    'credits', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('userId', st.user_id,
        'booked', EXISTS (SELECT 1 FROM public.launch_leader_credits c WHERE c.event_id = _event_id AND c.user_id = st.user_id AND c.entry_type = 'earned')))
      FROM (SELECT DISTINCT user_id FROM public.event_staff WHERE event_id = _event_id AND role = 'launch_helper') st), '[]'::jsonb),
    'rentals', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('userId', s.user_id,
        'hasLoan', public.flight_day_has_loan(_event_id, s.user_id),
        'booked', EXISTS (SELECT 1 FROM public.billing_items b WHERE b.event_id = _event_id AND b.user_id = s.user_id AND b.item_type = 'rental')))
      FROM public.event_signups s
      WHERE s.event_id = _event_id AND s.signed_up AND s.status = 'confirmed' AND s.presence = 'present'), '[]'::jsonb)
  );
END;
$$;

-- ── Close / reopen ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.close_flight_day(
  _event_id uuid, _credit_user_ids uuid[] DEFAULT '{}', _rental_user_ids uuid[] DEFAULT '{}',
  _return_assignment_ids uuid[] DEFAULT '{}')
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _event public.flight_events; _day date; _today date; _credit numeric; _rental numeric;
        _credits integer := 0; _items integer := 0; _returned integer := 0; _notified integer := 0;
BEGIN
  _event := public.school_flight_guard(_event_id, 'instructor');
  PERFORM 1 FROM public.flight_events WHERE id = _event_id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.event_school_flights WHERE event_id = _event_id AND status = 'in_air') THEN
    RAISE EXCEPTION 'Flights still in the air' USING ERRCODE = '55000';
  END IF;
  _day := public.flight_day_local_date(_event_id);
  _today := (now() AT TIME ZONE 'Europe/Zurich')::date;
  _credit := public.flight_day_rate(_event.group_id, 'launch_leader_per_day', _day);
  _rental := public.flight_day_rate(_event.group_id, 'rental_per_day', _day);

  -- Returned equipment (only open loans of this school).
  WITH returned AS (
    UPDATE public.equipment_assignments SET returned_on = _today, updated_at = now()
    WHERE id = ANY(COALESCE(_return_assignment_ids, '{}')) AND group_id = _event.group_id AND returned_on IS NULL
    RETURNING equipment_id)
  UPDATE public.school_equipment SET status = 'in_stock' WHERE id IN (SELECT equipment_id FROM returned);
  GET DIAGNOSTICS _returned = ROW_COUNT;

  -- Launch-leader credits for the launch helpers assigned to the event.
  IF _credit > 0 THEN
    INSERT INTO public.launch_leader_credits (group_id, user_id, event_id, entry_type, booking_date, days, amount, created_by)
    SELECT _event.group_id, st.user_id, _event_id, 'earned', _day, 1, _credit, auth.uid()
    FROM (SELECT DISTINCT user_id FROM public.event_staff WHERE event_id = _event_id AND role = 'launch_helper') st
    WHERE st.user_id = ANY(COALESCE(_credit_user_ids, '{}'))
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS _credits = ROW_COUNT;
  END IF;

  -- Rental items for students present that day (the wizard preselects those with a loan).
  IF _rental > 0 THEN
    INSERT INTO public.billing_items (group_id, user_id, event_id, item_type, description, quantity, unit_amount, amount, billing_date, created_by)
    SELECT _event.group_id, s.user_id, _event_id, 'rental', 'Materialmiete Flugtag', 1, _rental, _rental, _day, auth.uid()
    FROM public.event_signups s
    WHERE s.event_id = _event_id AND s.signed_up AND s.presence = 'present' AND s.user_id = ANY(COALESCE(_rental_user_ids, '{}'))
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS _items = ROW_COUNT;
  END IF;

  UPDATE public.flight_events SET day_closed_at = now(), day_closed_by = auth.uid(),
    feedback_released_at = COALESCE(feedback_released_at, now())
  WHERE id = _event_id;

  -- One push per student, only the first time the day's feedback is released.
  IF _event.feedback_notified_at IS NULL THEN
    _notified := public.flight_day_notify_students(_event_id);
  END IF;

  RETURN jsonb_build_object('credits', _credits, 'items', _items, 'returned', _returned, 'notified', _notified);
END;
$$;

-- Reopening keeps the bookings (no cancellation) and the release.
CREATE OR REPLACE FUNCTION public.reopen_flight_day(_event_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.flight_day_role(auth.uid(), _event_id) IS DISTINCT FROM 'instructor' THEN
    RAISE EXCEPTION 'Flight day access required' USING ERRCODE = '42501';
  END IF;
  UPDATE public.flight_events SET day_closed_at = NULL, day_closed_by = NULL WHERE id = _event_id;
END;
$$;

-- Fills the day's default take-off site into landed flights without one (needed for the number
-- of flying sites in the SHV proof, 6.2).
CREATE OR REPLACE FUNCTION public.school_flight_fill_takeoff(_event_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _event public.flight_events; _count integer;
BEGIN
  _event := public.school_flight_guard(_event_id, 'instructor');
  IF _event.default_takeoff_location_id IS NULL THEN
    RAISE EXCEPTION 'No take-off site set for the day' USING ERRCODE = '22023';
  END IF;
  UPDATE public.event_school_flights SET takeoff_location_id = _event.default_takeoff_location_id, updated_at = now()
  WHERE event_id = _event_id AND takeoff_location_id IS NULL AND status <> 'aborted';
  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$$;

DO $$
DECLARE _fn text;
BEGIN
  FOREACH _fn IN ARRAY ARRAY[
    'flight_day_close_preview(uuid)',
    'close_flight_day(uuid, uuid[], uuid[], uuid[])',
    'reopen_flight_day(uuid)',
    'school_flight_fill_takeoff(uuid)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', _fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', _fn);
  END LOOP;
END $$;

-- ── Daily run for days nobody closed (scheduled in 0056) ─────────────────────
-- Only days from _since on (default: 2026-09-25, start of the cockpit), so earlier days never
-- trigger pushes.
CREATE OR REPLACE FUNCTION public.flight_day_daily_run(_since timestamptz DEFAULT timestamptz '2026-09-25 00:00 Europe/Zurich')
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _e record; _uid uuid; _released integer := 0; _reminded integer := 0;
BEGIN
  -- 1. Feedback released by the 06:00 rule: mark it and push the students once.
  FOR _e IN
    SELECT e.id FROM public.flight_events e JOIN public.groups g ON g.id = e.group_id
    WHERE g.group_type = 'school' AND e.feedback_notified_at IS NULL
      AND e.event_date >= _since
      AND public.flight_day_feedback_released(e.id)
      AND EXISTS (SELECT 1 FROM public.flight_day_feedback_recipients(e.id))
  LOOP
    UPDATE public.flight_events SET feedback_released_at = COALESCE(feedback_released_at, now()) WHERE id = _e.id;
    PERFORM public.flight_day_notify_students(_e.id);
    _released := _released + 1;
  END LOOP;

  -- 2. Days with school flights still open the day after: remind the day's instructors once.
  FOR _e IN
    SELECT e.id, e.group_id, e.title FROM public.flight_events e JOIN public.groups g ON g.id = e.group_id
    WHERE g.group_type = 'school' AND e.day_closed_at IS NULL AND e.close_reminded_at IS NULL
      AND e.event_date >= _since
      AND COALESCE(e.end_date, (e.event_date AT TIME ZONE 'Europe/Zurich')::date) < (now() AT TIME ZONE 'Europe/Zurich')::date
      AND EXISTS (SELECT 1 FROM public.event_school_flights f WHERE f.event_id = e.id)
  LOOP
    FOR _uid IN
      SELECT user_id FROM public.event_staff WHERE event_id = _e.id AND role = 'instructor'
      UNION
      SELECT user_id FROM public.group_member_functions
      WHERE group_id = _e.group_id AND function IN ('instructor', 'school_lead')
        AND NOT EXISTS (SELECT 1 FROM public.event_staff WHERE event_id = _e.id AND role = 'instructor')
    LOOP
      PERFORM public.send_push_notification(_uid, 'Flugtag noch offen',
        '«' || COALESCE(_e.title, 'Flugtag') || '» ist noch nicht abgeschlossen.', '/events/' || _e.id || '?tab=day');
    END LOOP;
    UPDATE public.flight_events SET close_reminded_at = now() WHERE id = _e.id;
    _reminded := _reminded + 1;
  END LOOP;

  RETURN jsonb_build_object('released', _released, 'reminded', _reminded);
END;
$$;
REVOKE ALL ON FUNCTION public.flight_day_daily_run(timestamptz) FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
