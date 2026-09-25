-- Flugtag-Cockpit 4.5: students see the day's feedback only once it is released (decision E8).
--
-- A day counts as released when the instructors closed it (feedback_released_at, set by the day
-- closing in 5.1) or at the latest at 06:00 Swiss time on the day after the event (after the last
-- day for multi-day events). The fallback needs no scheduled job and covers all earlier events,
-- so notes students could read before stay readable.
-- Applies to the school flights (my_school_flights) and to the day summary written in the
-- cockpit (student_day_notes, visible_to_student).

CREATE OR REPLACE FUNCTION public.flight_day_feedback_released(_event_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((
    SELECT (e.feedback_released_at IS NOT NULL AND e.feedback_released_at <= now())
      OR ((COALESCE(e.end_date, (e.event_date AT TIME ZONE 'Europe/Zurich')::date) + 1)::timestamp
          + interval '6 hours') AT TIME ZONE 'Europe/Zurich' <= now()
    FROM public.flight_events e WHERE e.id = _event_id), false)
$$;
REVOKE ALL ON FUNCTION public.flight_day_feedback_released(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.flight_day_feedback_released(uuid) TO authenticated;

DROP POLICY IF EXISTS "Students can view own visible notes" ON public.student_day_notes;
CREATE POLICY "Students can view own visible notes" ON public.student_day_notes
  FOR SELECT TO authenticated
  USING (student_user_id = auth.uid() AND visible_to_student = true
         AND public.flight_day_feedback_released(event_id));

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
  LEFT JOIN public.event_school_flight_notes n ON n.flight_id = f.id
  LEFT JOIN public.locations lt ON lt.id = f.takeoff_location_id
  LEFT JOIN public.locations ll ON ll.id = f.landing_location_id
  WHERE public.flight_day_feedback_released(_event_id)
$$;
REVOKE ALL ON FUNCTION public.my_school_flights(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_school_flights(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
