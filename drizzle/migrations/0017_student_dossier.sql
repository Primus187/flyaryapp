-- School-scoped dossier. Invoker execution preserves all underlying RLS rules.
CREATE POLICY "School staff can read student training progress" ON public.training_progress
FOR SELECT TO authenticated USING (EXISTS (
  SELECT 1 FROM public.group_members m JOIN public.groups g ON g.id = m.group_id
  WHERE m.user_id = training_progress.user_id AND m.role = 'member' AND g.group_type = 'school'
    AND public.is_group_staff(auth.uid(), g.id)
));

-- Exam dates/SHV number have restricted column privileges. Expose only the
-- training fields through a guarded function, never the full private profile.
CREATE OR REPLACE FUNCTION public.school_student_training_profile(_group_id uuid, _student_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_group_staff(auth.uid(), _group_id)
    OR NOT EXISTS (SELECT 1 FROM public.groups WHERE id = _group_id AND group_type = 'school')
    OR NOT EXISTS (SELECT 1 FROM public.group_members WHERE group_id = _group_id AND user_id = _student_id AND role = 'member') THEN
    RAISE EXCEPTION 'School student access required' USING ERRCODE = '42501';
  END IF;
  RETURN (SELECT jsonb_build_object('name', p.pilot_name, 'level', p.training_level,
    'shvNumber', p.shv_number, 'theoryDate', p.exam_theory_date, 'practicalDate', p.exam_practical_date,
    'gliderInfo', p.glider_info) FROM public.profiles p WHERE p.user_id = _student_id);
END;
$$;
REVOKE ALL ON FUNCTION public.school_student_training_profile(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_student_training_profile(uuid, uuid) TO authenticated;

-- Instructors need to read the same coaching history as school administrators.
CREATE POLICY "School staff can read flight coaching notes" ON public.flight_coach_notes
FOR SELECT TO authenticated USING (EXISTS (
  SELECT 1 FROM public.flights f JOIN public.groups g ON g.id = f.group_id
  WHERE f.id = flight_id AND g.group_type = 'school' AND public.is_group_staff(auth.uid(), g.id)
));

CREATE OR REPLACE FUNCTION public.school_student_dossier(
  _group_id uuid, _student_id uuid, _section text DEFAULT 'overview', _offset integer DEFAULT 0
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
DECLARE result jsonb; rows jsonb; total bigint;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_group_staff(auth.uid(), _group_id)
    OR NOT EXISTS (SELECT 1 FROM public.groups WHERE id = _group_id AND group_type = 'school')
    OR NOT EXISTS (SELECT 1 FROM public.group_members WHERE group_id = _group_id AND user_id = _student_id AND role = 'member') THEN
    RAISE EXCEPTION 'School student access required' USING ERRCODE = '42501';
  END IF;
  IF _offset IS NULL OR _offset < 0 THEN RAISE EXCEPTION 'Invalid offset'; END IF;

  IF _section = 'overview' THEN
    result := public.school_student_training_profile(_group_id, _student_id);
    IF result IS NULL THEN RAISE EXCEPTION 'Student profile unavailable'; END IF;
    RETURN result || jsonb_build_object(
      'flightCount', (SELECT count(*) FROM public.flights WHERE user_id = _student_id AND group_id = _group_id),
      'lastFlight', (SELECT max(date) FROM public.flights WHERE user_id = _student_id AND group_id = _group_id),
      'examTotal', (SELECT count(*) FROM public.training_items WHERE is_exam_maneuver),
      'examDone', (SELECT count(*) FROM public.training_progress p JOIN public.training_items i ON i.id = p.item_id WHERE p.user_id = _student_id AND p.rating >= 3 AND i.is_exam_maneuver),
      'status', coalesce((SELECT jsonb_build_object('status', status, 'reason', reason, 'date', changed_at) FROM public.student_status_history WHERE group_id = _group_id AND student_id = _student_id ORDER BY changed_at DESC, id DESC LIMIT 1), '{"status":"active","reason":null,"date":null}'::jsonb),
      'nextStep', (SELECT jsonb_build_object('note', n.note, 'eventId', e.id, 'date', e.event_date) FROM public.student_day_notes n JOIN public.flight_events e ON e.id = n.event_id WHERE e.group_id = _group_id AND n.student_user_id = _student_id AND n.is_next_step AND btrim(n.note) <> '' ORDER BY e.event_date DESC, n.id DESC LIMIT 1),
      'upcoming', (SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM (SELECT e.id, e.title, e.event_date, s.status FROM public.event_signups s JOIN public.flight_events e ON e.id = s.event_id WHERE s.user_id = _student_id AND s.signed_up AND e.group_id = _group_id AND e.event_date >= now() AND e.status <> 'cancelled' ORDER BY e.event_date, e.id LIMIT 5) x)
    );
  ELSIF _section = 'training' THEN
    SELECT coalesce(jsonb_agg(x ORDER BY x.category_order, x.sort_order, x.id), '[]'::jsonb) INTO rows FROM (
      SELECT i.id, i.name, c.name AS category, c.sort_order AS category_order, i.sort_order,
        c.training_level, i.is_exam_maneuver, coalesce(p.rating, 0) AS rating, p.notes, p.updated_at
      FROM public.training_items i JOIN public.training_categories c ON c.id = i.category_id
      LEFT JOIN public.training_progress p ON p.item_id = i.id AND p.user_id = _student_id
    ) x;
    RETURN jsonb_build_object('rows', rows);
  ELSIF _section = 'flights' THEN
    SELECT count(*) INTO total FROM public.flights WHERE group_id = _group_id AND user_id = _student_id;
    SELECT coalesce(jsonb_agg(x ORDER BY x.date DESC, x.id DESC), '[]'::jsonb) INTO rows FROM (
      SELECT f.id, f.date, f.glider, f.duration_minutes, f.altitude_gain, f.comments,
        l.name AS takeoff, d.name AS landing,
        (SELECT coalesce(jsonb_agg(jsonb_build_object('id', n.id, 'note', n.note, 'author', p.pilot_name, 'visible', n.visible_to_student, 'date', n.updated_at) ORDER BY n.created_at, n.id), '[]'::jsonb)
         FROM public.flight_coach_notes n LEFT JOIN public.profiles p ON p.user_id = n.coach_id WHERE n.flight_id = f.id) AS notes
      FROM public.flights f LEFT JOIN public.locations l ON l.id = f.takeoff_location_id LEFT JOIN public.locations d ON d.id = f.landing_location_id
      WHERE f.group_id = _group_id AND f.user_id = _student_id ORDER BY f.date DESC, f.id DESC LIMIT 30 OFFSET _offset
    ) x;
  ELSIF _section = 'notes' THEN
    SELECT count(*) INTO total FROM public.student_day_notes n JOIN public.flight_events e ON e.id = n.event_id WHERE e.group_id = _group_id AND n.student_user_id = _student_id;
    SELECT coalesce(jsonb_agg(x ORDER BY x.event_date DESC, x.id DESC), '[]'::jsonb) INTO rows FROM (
      SELECT n.id, n.note, n.flight_number, n.visible_to_student AS visible, n.is_next_step,
        p.pilot_name AS author, e.id AS event_id, e.title, e.event_date
      FROM public.student_day_notes n JOIN public.flight_events e ON e.id = n.event_id LEFT JOIN public.profiles p ON p.user_id = n.instructor_id
      WHERE e.group_id = _group_id AND n.student_user_id = _student_id ORDER BY e.event_date DESC, n.id DESC LIMIT 30 OFFSET _offset
    ) x;
  ELSIF _section = 'equipment' THEN
    RETURN jsonb_build_object(
      'loans', (SELECT coalesce(jsonb_agg(x ORDER BY x.returned_on NULLS FIRST, x.assigned_on DESC, x.id), '[]'::jsonb) FROM (
        SELECT a.id, a.assigned_on, a.due_on, a.returned_on, a.note, e.name, e.equipment_type, e.inventory_number, e.size, e.next_check_date
        FROM public.equipment_assignments a JOIN public.school_equipment e ON e.id = a.equipment_id AND e.group_id = _group_id
        WHERE a.group_id = _group_id AND a.user_id = _student_id) x),
      'own', (SELECT coalesce(jsonb_agg(x ORDER BY x.is_default DESC, x.manufacturer, x.id), '[]'::jsonb) FROM (
        SELECT id, manufacturer, model, size, is_default, last_check_date, next_check_date, reserve_repack_date
        FROM public.pilot_gliders WHERE user_id = _student_id) x)
    );
  ELSIF _section = 'billing' THEN
    SELECT jsonb_build_object('open', coalesce(sum(amount) FILTER (WHERE paid_at IS NULL), 0), 'paid', coalesce(sum(amount) FILTER (WHERE paid_at IS NOT NULL), 0)), count(*) INTO result, total
      FROM public.billing_items WHERE group_id = _group_id AND user_id = _student_id;
    SELECT coalesce(jsonb_agg(x ORDER BY x.billing_date DESC, x.id DESC), '[]'::jsonb) INTO rows FROM (
      SELECT id, description, item_type, quantity, unit_amount, amount, billing_date, paid_at, note
      FROM public.billing_items WHERE group_id = _group_id AND user_id = _student_id ORDER BY billing_date DESC, id DESC LIMIT 30 OFFSET _offset
    ) x;
    RETURN result || jsonb_build_object('rows', rows, 'total', total);
  ELSE
    RAISE EXCEPTION 'Unknown dossier section';
  END IF;
  RETURN jsonb_build_object('rows', rows, 'total', total);
END;
$$;
REVOKE ALL ON FUNCTION public.school_student_dossier(uuid, uuid, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_student_dossier(uuid, uuid, text, integer) TO authenticated;
