-- Flugtag-Cockpit: launch helpers see the check-in and the take-off view without students whose
-- training is paused or cancelled (decision 2026-09-25), like instructors already do.
-- inactive_school_students returns only student IDs, never the reason, so it may be read by the
-- whole school team (instructors, school lead, launch helpers) and by people assigned to one of
-- the school's events.

CREATE OR REPLACE FUNCTION public.inactive_school_students(_group_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (
       public.is_group_team_member(auth.uid(), _group_id)
       OR EXISTS (SELECT 1 FROM public.event_staff st JOIN public.flight_events e ON e.id = st.event_id
                  WHERE st.user_id = auth.uid() AND e.group_id = _group_id)) THEN
    RAISE EXCEPTION 'School staff access required' USING ERRCODE = '42501';
  END IF;
  RETURN (SELECT coalesce(jsonb_agg(student_id), '[]'::jsonb) FROM (
    SELECT DISTINCT ON (student_id) student_id, status
    FROM public.student_status_history WHERE group_id = _group_id
    ORDER BY student_id, changed_at DESC, id DESC
  ) latest WHERE status IN ('paused', 'cancelled'));
END;
$$;
