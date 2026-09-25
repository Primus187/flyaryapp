-- Flugtag-Cockpit 6.3: the instructors' maneuver ratings in the training level.
--
-- Decision E6: shown next to the student's own rating, never overwriting training_progress.
-- Ratings come from event_school_flight_items (4.3), landed flights only. Students see their
-- latest rating per maneuver once the day is released (E8); the school's staff see the history
-- in the dossier. The former flight_training_items.instructor_rating stays readable where it was.

CREATE OR REPLACE FUNCTION public.my_instructor_ratings()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_object_agg(item_id, jsonb_build_object('rating', rating, 'date', day)), '{}'::jsonb)
  FROM (
    SELECT DISTINCT ON (i.training_item_id) i.training_item_id AS item_id, i.rating,
           (e.event_date AT TIME ZONE 'Europe/Zurich')::date AS day
    FROM public.event_school_flight_items i
    JOIN public.event_school_flights f ON f.id = i.flight_id
    JOIN public.flight_events e ON e.id = f.event_id
    WHERE f.student_user_id = auth.uid() AND f.status = 'landed' AND public.flight_day_feedback_released(e.id)
    ORDER BY i.training_item_id, e.event_date DESC, f.seq DESC
  ) latest
$$;

-- History per maneuver for the dossier: { itemId: [{ date, rating }, …] }, newest first, at most 10.
CREATE OR REPLACE FUNCTION public.school_student_ratings(_group_id uuid, _student_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_group_staff(auth.uid(), _group_id)
     OR NOT EXISTS (SELECT 1 FROM public.group_members WHERE group_id = _group_id AND user_id = _student_id) THEN
    RAISE EXCEPTION 'School student access required' USING ERRCODE = '42501';
  END IF;
  RETURN (
    SELECT COALESCE(jsonb_object_agg(item_id, history), '{}'::jsonb)
    FROM (
      SELECT item_id, jsonb_agg(jsonb_build_object('date', day, 'rating', rating) ORDER BY day DESC, seq DESC) AS history
      FROM (
        SELECT i.training_item_id AS item_id, i.rating, f.seq, (e.event_date AT TIME ZONE 'Europe/Zurich')::date AS day,
               row_number() OVER (PARTITION BY i.training_item_id ORDER BY e.event_date DESC, f.seq DESC) AS n
        FROM public.event_school_flight_items i
        JOIN public.event_school_flights f ON f.id = i.flight_id
        JOIN public.flight_events e ON e.id = f.event_id
        WHERE f.group_id = _group_id AND f.student_user_id = _student_id AND f.status = 'landed'
      ) rated
      WHERE n <= 10
      GROUP BY item_id
    ) per_item);
END;
$$;

DO $$
DECLARE _fn text;
BEGIN
  FOREACH _fn IN ARRAY ARRAY['my_instructor_ratings()', 'school_student_ratings(uuid, uuid)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', _fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', _fn);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
