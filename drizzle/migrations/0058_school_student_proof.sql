-- Flugtag-Cockpit 6.2: training proof of a student for the SHV.
--
-- Required (clarified 2026-09-25): all flights, the number of flying sites, stamp and signature of
-- the school on the printout. The source is the school's record (event_school_flights), not the
-- student's private logbook; aborted launches never count. Flying site = take-off site.
-- Used by the dossier section "Proof", the CSV export and the PDF (Edge Function
-- export-flightbook-pdf, mode school_proof), always with the caller's own session.

CREATE OR REPLACE FUNCTION public.school_student_proof(
  _group_id uuid, _student_id uuid, _from date DEFAULT NULL, _to date DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_group_staff(auth.uid(), _group_id)
     OR NOT EXISTS (SELECT 1 FROM public.group_members WHERE group_id = _group_id AND user_id = _student_id) THEN
    RAISE EXCEPTION 'School student access required' USING ERRCODE = '42501';
  END IF;
  RETURN (
    WITH f AS (
      SELECT sf.seq, (e.event_date AT TIME ZONE 'Europe/Zurich')::date AS day, e.title, e.event_category,
             sf.takeoff_location_id, lt.name AS takeoff, ll.name AS landing, p.pilot_name AS instructor
      FROM public.event_school_flights sf
      JOIN public.flight_events e ON e.id = sf.event_id
      LEFT JOIN public.locations lt ON lt.id = sf.takeoff_location_id
      LEFT JOIN public.locations ll ON ll.id = sf.landing_location_id
      LEFT JOIN public.profiles p ON p.user_id = COALESCE(sf.landed_by, sf.created_by)
      WHERE sf.group_id = _group_id AND sf.student_user_id = _student_id AND sf.status = 'landed'
        AND (_from IS NULL OR (e.event_date AT TIME ZONE 'Europe/Zurich')::date >= _from)
        AND (_to IS NULL OR (e.event_date AT TIME ZONE 'Europe/Zurich')::date <= _to)
    )
    SELECT jsonb_build_object(
      'school', (SELECT name FROM public.groups WHERE id = _group_id),
      'student', (SELECT jsonb_build_object('name', pilot_name, 'shvNumber', shv_number) FROM public.profiles WHERE user_id = _student_id),
      'from', min(day), 'to', max(day),
      'total', count(*),
      'practice', count(*) FILTER (WHERE event_category = 'basic_course'),
      'altitude', count(*) FILTER (WHERE event_category IS DISTINCT FROM 'basic_course'),
      'sites', count(DISTINCT takeoff_location_id),
      'days', count(DISTINCT day),
      'selfLogged', (SELECT count(*) FROM public.flights WHERE user_id = _student_id AND group_id = _group_id),
      'flights', COALESCE(jsonb_agg(jsonb_build_object(
        'date', day, 'event', title, 'category', event_category, 'takeoff', takeoff, 'landing', landing, 'instructor', instructor)
        ORDER BY day, seq), '[]'::jsonb))
    FROM f);
END;
$$;
REVOKE ALL ON FUNCTION public.school_student_proof(uuid, uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_student_proof(uuid, uuid, date, date) TO authenticated;

NOTIFY pgrst, 'reload schema';
