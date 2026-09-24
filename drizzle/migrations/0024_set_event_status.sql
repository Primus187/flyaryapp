-- The school team sets a flying day's status directly (announced -> confirmed / cancelled) from
-- the event page. Only group admins may UPDATE flight_events, so instructors' changes were
-- silently ignored (0 rows, no error). This function lets admins, school leads and instructors
-- change exactly the status column, and fails loudly for everyone else.
CREATE OR REPLACE FUNCTION public.set_event_status(_event_id uuid, _status public.event_status)
RETURNS public.event_status
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _group uuid;
BEGIN
  SELECT group_id INTO _group FROM public.flight_events WHERE id = _event_id;
  IF _group IS NULL THEN
    RAISE EXCEPTION 'Event not found' USING ERRCODE = 'P0002';
  END IF;
  IF auth.uid() IS NULL OR NOT public.is_group_staff(auth.uid(), _group) THEN
    RAISE EXCEPTION 'School staff access required' USING ERRCODE = '42501';
  END IF;
  UPDATE public.flight_events SET status = _status WHERE id = _event_id;
  RETURN _status;
END;
$$;
REVOKE ALL ON FUNCTION public.set_event_status(uuid, public.event_status) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_event_status(uuid, public.event_status) TO authenticated;
