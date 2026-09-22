-- Let instructors carry out the documented coaching workflow without admin rights.
DROP POLICY IF EXISTS "Group admins can manage day notes" ON public.student_day_notes;
CREATE POLICY "School staff can manage day notes" ON public.student_day_notes
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.flight_events e WHERE e.id = event_id AND public.is_group_staff(auth.uid(), e.group_id)))
WITH CHECK (EXISTS (SELECT 1 FROM public.flight_events e WHERE e.id = event_id AND public.is_group_staff(auth.uid(), e.group_id)));

-- The existing UI represents a pause for this day with flight_number = -1.
ALTER TABLE public.student_day_notes DROP CONSTRAINT IF EXISTS flight_number_range;
ALTER TABLE public.student_day_notes ADD CONSTRAINT flight_number_range
  CHECK (flight_number IS NULL OR flight_number = -1 OR flight_number BETWEEN 1 AND 6);

-- Operational views need only inactive IDs, never the private reason/history.
CREATE OR REPLACE FUNCTION public.inactive_school_students(_group_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_group_staff(auth.uid(), _group_id) THEN
    RAISE EXCEPTION 'School staff access required' USING ERRCODE = '42501';
  END IF;
  RETURN (SELECT coalesce(jsonb_agg(student_id), '[]'::jsonb) FROM (
    SELECT DISTINCT ON (student_id) student_id, status
    FROM public.student_status_history WHERE group_id = _group_id
    ORDER BY student_id, changed_at DESC, id DESC
  ) latest WHERE status IN ('paused', 'cancelled'));
END;
$$;
REVOKE ALL ON FUNCTION public.inactive_school_students(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inactive_school_students(uuid) TO authenticated;
