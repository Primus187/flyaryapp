-- Flugtag-Cockpit, acceptance audit C3: keep the link between logbook and school flight consistent.
--
-- A student may clear flights.school_flight_id on an own entry (the guard in 0057 only blocks
-- setting it). The school flight then still pointed to the entry through logbook_flight_id, so it
-- counted as taken over and could never be taken over again. Now clearing (or deleting, via the
-- FK) always frees the school flight as well.

CREATE OR REPLACE FUNCTION public.release_school_flight_link()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.school_flight_id IS NOT NULL AND NEW.school_flight_id IS DISTINCT FROM OLD.school_flight_id THEN
    UPDATE public.event_school_flights SET logbook_flight_id = NULL
    WHERE id = OLD.school_flight_id AND logbook_flight_id = OLD.id;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.release_school_flight_link() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_release_school_flight_link ON public.flights;
CREATE TRIGGER trg_release_school_flight_link
  AFTER UPDATE OF school_flight_id ON public.flights
  FOR EACH ROW EXECUTE FUNCTION public.release_school_flight_link();

-- Repair links that were cleared before this migration.
UPDATE public.event_school_flights sf SET logbook_flight_id = NULL
WHERE sf.logbook_flight_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.flights f WHERE f.id = sf.logbook_flight_id AND f.school_flight_id = sf.id);
