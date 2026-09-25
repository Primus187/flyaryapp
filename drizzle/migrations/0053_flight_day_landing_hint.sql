-- Flugtag-Cockpit 4.4: optional "land?" hint per flying day.
--
-- Flights last 5 to 30 minutes and much longer once thermal or soaring flights are allowed, so
-- there is no fixed threshold (decision 2026-09-25). An instructor may switch on a hint per day;
-- NULL = off (the default). Stored on the event so the landing field and the take-off see the
-- same setting.

ALTER TABLE public.flight_events
  ADD COLUMN IF NOT EXISTS landing_hint_minutes smallint
    CHECK (landing_hint_minutes IS NULL OR landing_hint_minutes IN (15, 30, 45, 60, 90));

CREATE OR REPLACE FUNCTION public.set_flight_day_landing_hint(_event_id uuid, _minutes smallint)
RETURNS smallint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.school_flight_guard(_event_id, 'instructor');
  UPDATE public.flight_events SET landing_hint_minutes = _minutes WHERE id = _event_id;
  RETURN _minutes;
END;
$$;
REVOKE ALL ON FUNCTION public.set_flight_day_landing_hint(uuid, smallint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_flight_day_landing_hint(uuid, smallint) TO authenticated;

NOTIFY pgrst, 'reload schema';
