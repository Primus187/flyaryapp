-- Flugtag-Cockpit 4.3: maneuver ratings per school flight.
--
-- The instructor at the landing field rates the maneuvers planned for the day (event_maneuvers)
-- per flight: 1 = again, 2 = okay, 3 = solid. Ratings are feedback, so like
-- event_school_flight_notes they are readable by instructors only (launch helpers see the
-- operational flight data only). Students get them through my_school_flights() once released.
-- school_flight_land / school_flight_add now also take the ratings, so landing, feedback and
-- ratings are stored in one transaction.

CREATE TABLE public.event_school_flight_items (
  flight_id uuid NOT NULL REFERENCES public.event_school_flights(id) ON DELETE CASCADE,
  training_item_id uuid NOT NULL REFERENCES public.training_items(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 3),
  rated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (flight_id, training_item_id)
);
CREATE INDEX event_school_flight_items_item ON public.event_school_flight_items (training_item_id);

ALTER TABLE public.event_school_flight_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.event_school_flight_items FROM anon, authenticated;
GRANT SELECT ON public.event_school_flight_items TO authenticated;
CREATE POLICY "Instructors read flight ratings" ON public.event_school_flight_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.event_school_flights f
    WHERE f.id = flight_id AND public.flight_day_role(auth.uid(), f.event_id) = 'instructor'));

-- Replaces all ratings of a flight with _items = [{"item_id": uuid, "rating": 1..3}, …].
-- NULL leaves the ratings unchanged; [] clears them.
CREATE OR REPLACE FUNCTION public.school_flight_write_items(_flight_id uuid, _items jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _items IS NULL THEN RETURN; END IF;
  IF jsonb_typeof(_items) <> 'array' THEN
    RAISE EXCEPTION 'Invalid ratings' USING ERRCODE = '22023';
  END IF;
  DELETE FROM public.event_school_flight_items WHERE flight_id = _flight_id;
  -- A maneuver listed twice keeps its last rating.
  INSERT INTO public.event_school_flight_items (flight_id, training_item_id, rating, rated_by)
  SELECT DISTINCT ON (x.item_id) _flight_id, x.item_id, x.rating, auth.uid()
  FROM (SELECT (e->>'item_id')::uuid AS item_id, (e->>'rating')::smallint AS rating, ord
        FROM jsonb_array_elements(_items) WITH ORDINALITY AS a(e, ord)) x
  ORDER BY x.item_id, x.ord DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.school_flight_write_items(uuid, jsonb) FROM PUBLIC, anon, authenticated;

-- ── land / add with ratings (new signature, so drop the 0050 versions) ───────
DROP FUNCTION IF EXISTS public.school_flight_land(uuid, uuid, jsonb);
DROP FUNCTION IF EXISTS public.school_flight_add(uuid, uuid, uuid, uuid, jsonb);

CREATE FUNCTION public.school_flight_land(
  _flight_id uuid, _landing_location_id uuid DEFAULT NULL, _notes jsonb DEFAULT NULL, _items jsonb DEFAULT NULL)
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
  PERFORM public.school_flight_write_items(_flight_id, _items);
  RETURN _row;
END;
$$;

CREATE FUNCTION public.school_flight_add(
  _event_id uuid, _student_id uuid, _takeoff_location_id uuid DEFAULT NULL,
  _landing_location_id uuid DEFAULT NULL, _notes jsonb DEFAULT NULL, _items jsonb DEFAULT NULL)
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
  PERFORM public.school_flight_write_items(_row.id, _items);
  RETURN _row;
END;
$$;

-- Instructor edits the ratings of a recorded flight.
CREATE OR REPLACE FUNCTION public.school_flight_set_items(_flight_id uuid, _items jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _event uuid;
BEGIN
  SELECT event_id INTO _event FROM public.event_school_flights WHERE id = _flight_id;
  IF _event IS NULL THEN RAISE EXCEPTION 'Flight not found' USING ERRCODE = 'P0002'; END IF;
  PERFORM public.school_flight_guard(_event, 'instructor');
  PERFORM public.school_flight_write_items(_flight_id, COALESCE(_items, '[]'::jsonb));
END;
$$;

-- Students: released flights now include the rated maneuvers.
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
      'feedback', n.feedback,
      'items', COALESCE((SELECT jsonb_agg(jsonb_build_object('name', ti.name, 'rating', i.rating) ORDER BY ti.sort_order, ti.name)
                         FROM public.event_school_flight_items i JOIN public.training_items ti ON ti.id = i.training_item_id
                         WHERE i.flight_id = f.id), '[]'::jsonb)
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

-- ── Sites of a flying day are readable by the day's team ───────────────────
-- Locations belong to one person (locations.user_id). The day's take-off and landing sites are
-- chosen from the instructor's own list, so the other instructor and the launch helpers could not
-- read their names so far (only sites of visible logbook flights were readable).
CREATE INDEX IF NOT EXISTS event_school_flights_takeoff ON public.event_school_flights (takeoff_location_id);
CREATE INDEX IF NOT EXISTS event_school_flights_landing ON public.event_school_flights (landing_location_id);
CREATE INDEX IF NOT EXISTS flight_events_default_takeoff ON public.flight_events (default_takeoff_location_id) WHERE default_takeoff_location_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS flight_events_default_landing ON public.flight_events (default_landing_location_id) WHERE default_landing_location_id IS NOT NULL;

DROP POLICY IF EXISTS "Sites of flying days are readable" ON public.locations;
CREATE POLICY "Sites of flying days are readable" ON public.locations
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.flight_events e
            WHERE (e.default_takeoff_location_id = locations.id OR e.default_landing_location_id = locations.id)
              AND public.flight_day_role(auth.uid(), e.id) IS NOT NULL)
    OR EXISTS (SELECT 1 FROM public.event_school_flights f
               WHERE (f.takeoff_location_id = locations.id OR f.landing_location_id = locations.id)
                 AND public.flight_day_role(auth.uid(), f.event_id) IS NOT NULL));

DO $$
DECLARE _fn text;
BEGIN
  FOREACH _fn IN ARRAY ARRAY[
    'school_flight_land(uuid, uuid, jsonb, jsonb)',
    'school_flight_add(uuid, uuid, uuid, uuid, jsonb, jsonb)',
    'school_flight_set_items(uuid, jsonb)',
    'my_school_flights(uuid)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', _fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', _fn);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
