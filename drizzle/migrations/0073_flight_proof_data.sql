-- Flightbook replacement, step 2 (docs/technical/flightbook-replacement-plan.md): proof data on
-- flights and a change history.
--
-- * flight_no: stable number per pilot (like the "Nr" on the Flightbook printout). Assigned on
--   insert, never changed, so an already stamped printout page keeps pointing at the same flights.
-- * takeoff_at / landing_at, glider_id (the free text `glider` stays as the historical label),
--   discipline (paraglider / hang glider), is_tandem, flight_kind (practice slope / altitude flight).
-- * source / source_ref: where the entry came from (manual, flightbook import with its "Nr",
--   xcontest, school). Needed so imported Flightbook flights can be told apart (decision "variant B").
-- * flight_changes: every change of a proof-relevant field is logged with who, when, old and new
--   value (decision 2026-09-29: changes after a confirmation are logged, no re-confirmation).
--   Written only by triggers; readable by the pilot and by the staff of the flight's school.

-- 1. Gliders: discipline and tandem
ALTER TABLE public.pilot_gliders
  ADD COLUMN IF NOT EXISTS discipline text NOT NULL DEFAULT 'paraglider',
  ADD COLUMN IF NOT EXISTS is_tandem boolean NOT NULL DEFAULT false;
ALTER TABLE public.pilot_gliders DROP CONSTRAINT IF EXISTS pilot_gliders_discipline_check;
ALTER TABLE public.pilot_gliders ADD CONSTRAINT pilot_gliders_discipline_check
  CHECK (discipline IN ('paraglider', 'hangglider'));

-- 2. Flights: proof data
ALTER TABLE public.flights
  ADD COLUMN IF NOT EXISTS flight_no integer,
  ADD COLUMN IF NOT EXISTS takeoff_at timestamptz,
  ADD COLUMN IF NOT EXISTS landing_at timestamptz,
  ADD COLUMN IF NOT EXISTS glider_id uuid REFERENCES public.pilot_gliders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS discipline text NOT NULL DEFAULT 'paraglider',
  ADD COLUMN IF NOT EXISTS is_tandem boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS flight_kind text,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS source_ref text;
ALTER TABLE public.flights DROP CONSTRAINT IF EXISTS flights_discipline_check;
ALTER TABLE public.flights ADD CONSTRAINT flights_discipline_check CHECK (discipline IN ('paraglider', 'hangglider'));
ALTER TABLE public.flights DROP CONSTRAINT IF EXISTS flights_flight_kind_check;
ALTER TABLE public.flights ADD CONSTRAINT flights_flight_kind_check CHECK (flight_kind IN ('practice_slope', 'altitude'));
ALTER TABLE public.flights DROP CONSTRAINT IF EXISTS flights_source_check;
ALTER TABLE public.flights ADD CONSTRAINT flights_source_check CHECK (source IN ('manual', 'flightbook', 'xcontest', 'school'));
ALTER TABLE public.flights DROP CONSTRAINT IF EXISTS flights_landing_after_takeoff;
ALTER TABLE public.flights ADD CONSTRAINT flights_landing_after_takeoff
  CHECK (takeoff_at IS NULL OR landing_at IS NULL OR landing_at >= takeoff_at);

-- 3. Backfill before the triggers exist. Numbers follow the flight date, then the entry time.
--    The updated_at trigger is paused so the backfill does not look like an edit of every flight.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_flights_updated_at' AND tgrelid = 'public.flights'::regclass) THEN
    ALTER TABLE public.flights DISABLE TRIGGER update_flights_updated_at;
  END IF;
END $$;

WITH numbered AS (
  SELECT id, row_number() OVER (PARTITION BY user_id ORDER BY date, created_at, id) AS no
  FROM public.flights
)
UPDATE public.flights f SET flight_no = numbered.no
FROM numbered WHERE f.id = numbered.id AND f.flight_no IS NULL;

-- Link the free-text glider to the pilot's glider where exactly one glider matches the label
-- (the form stored "Manufacturer Model (Size)"; older entries often "Manufacturer Model").
WITH candidates AS (
  SELECT f.id AS flight_id, g.id AS glider_id, g.discipline, g.is_tandem
  FROM public.flights f
  JOIN public.pilot_gliders g ON g.user_id = f.user_id
  WHERE f.glider_id IS NULL AND f.glider IS NOT NULL
    AND lower(trim(f.glider)) IN (
      lower(g.manufacturer || ' ' || g.model || COALESCE(' (' || g.size || ')', '')),
      lower(g.manufacturer || ' ' || g.model))
), unique_match AS (
  SELECT flight_id, min(glider_id::text)::uuid AS glider_id, bool_or(discipline = 'hangglider') AS hg, bool_or(is_tandem) AS tandem
  FROM candidates GROUP BY flight_id HAVING count(*) = 1
)
UPDATE public.flights f
SET glider_id = u.glider_id,
    discipline = CASE WHEN u.hg THEN 'hangglider' ELSE f.discipline END,
    is_tandem = f.is_tandem OR u.tandem
FROM unique_match u WHERE f.id = u.flight_id;

UPDATE public.flights SET source = 'school' WHERE school_flight_id IS NOT NULL AND source = 'manual';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_flights_updated_at' AND tgrelid = 'public.flights'::regclass) THEN
    ALTER TABLE public.flights ENABLE TRIGGER update_flights_updated_at;
  END IF;
END $$;

ALTER TABLE public.flights ALTER COLUMN flight_no SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS flights_user_flight_no_idx ON public.flights (user_id, flight_no);

-- 4. Number, origin and glider ownership are guarded by the database, not the client.
CREATE OR REPLACE FUNCTION public.guard_flight_proof_data()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- One pilot's numbers are handed out one after another, also for multi-row inserts.
    PERFORM pg_advisory_xact_lock(hashtextextended('flyary.flight_no:' || NEW.user_id::text, 0));
    SELECT COALESCE(max(flight_no), 0) + 1 INTO NEW.flight_no FROM public.flights WHERE user_id = NEW.user_id;
    IF NEW.school_flight_id IS NOT NULL THEN
      NEW.source := 'school';
    ELSIF NEW.source = 'school' THEN
      NEW.source := 'manual';
    END IF;
  ELSE
    NEW.flight_no := OLD.flight_no;
    NEW.source := OLD.source;
    NEW.source_ref := OLD.source_ref;
  END IF;
  IF NEW.glider_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.glider_id IS DISTINCT FROM OLD.glider_id)
     AND NOT EXISTS (SELECT 1 FROM public.pilot_gliders WHERE id = NEW.glider_id AND user_id = NEW.user_id) THEN
    RAISE EXCEPTION 'Glider does not belong to the pilot' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_flight_proof_data() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_flight_proof_data ON public.flights;
CREATE TRIGGER trg_guard_flight_proof_data
  BEFORE INSERT OR UPDATE ON public.flights
  FOR EACH ROW EXECUTE FUNCTION public.guard_flight_proof_data();

-- 5. Change history
CREATE TABLE IF NOT EXISTS public.flight_changes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  flight_id uuid NOT NULL REFERENCES public.flights(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  field text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  changed_by uuid,
  origin text NOT NULL DEFAULT 'app',
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS flight_changes_flight_idx ON public.flight_changes (flight_id, changed_at);

ALTER TABLE public.flight_changes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.flight_changes FROM anon, authenticated;
GRANT SELECT ON public.flight_changes TO authenticated;
GRANT ALL ON public.flight_changes TO service_role;

DROP POLICY IF EXISTS "Pilot and school staff read flight changes" ON public.flight_changes;
CREATE POLICY "Pilot and school staff read flight changes" ON public.flight_changes
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.flights f
               WHERE f.id = flight_changes.flight_id AND f.group_id IS NOT NULL
                 AND public.is_group_staff(auth.uid(), f.group_id))
  );

-- A place or glider is logged with its id and its name at the time of the change.
CREATE OR REPLACE FUNCTION public.flight_change_place(_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN _id IS NULL THEN NULL
    ELSE jsonb_build_object('id', _id, 'name', (SELECT COALESCE(custom_name, name) FROM public.locations WHERE id = _id)) END;
$$;
REVOKE ALL ON FUNCTION public.flight_change_place(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.flight_change_origin()
RETURNS text
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT COALESCE(NULLIF(current_setting('flyary.change_origin', true), ''),
                  CASE WHEN auth.uid() IS NULL THEN 'system' ELSE 'app' END);
$$;
REVOKE ALL ON FUNCTION public.flight_change_origin() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.log_flight_changes()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.flight_changes (flight_id, user_id, field, old_value, new_value, changed_by, origin)
  SELECT NEW.id, NEW.user_id, c.field, c.o, c.n, auth.uid(), public.flight_change_origin()
  FROM (VALUES
    ('date', to_jsonb(OLD.date), to_jsonb(NEW.date), OLD.date IS DISTINCT FROM NEW.date),
    ('takeoff_at', to_jsonb(OLD.takeoff_at), to_jsonb(NEW.takeoff_at), OLD.takeoff_at IS DISTINCT FROM NEW.takeoff_at),
    ('landing_at', to_jsonb(OLD.landing_at), to_jsonb(NEW.landing_at), OLD.landing_at IS DISTINCT FROM NEW.landing_at),
    ('duration_minutes', to_jsonb(OLD.duration_minutes), to_jsonb(NEW.duration_minutes), OLD.duration_minutes IS DISTINCT FROM NEW.duration_minutes),
    ('takeoff_location', public.flight_change_place(OLD.takeoff_location_id), public.flight_change_place(NEW.takeoff_location_id),
      OLD.takeoff_location_id IS DISTINCT FROM NEW.takeoff_location_id),
    ('landing_location', public.flight_change_place(OLD.landing_location_id), public.flight_change_place(NEW.landing_location_id),
      OLD.landing_location_id IS DISTINCT FROM NEW.landing_location_id),
    -- Deleting a glider from the profile only clears glider_id; the flight keeps its label and
    -- that is no change of the flight.
    ('glider', jsonb_build_object('id', OLD.glider_id, 'label', OLD.glider), jsonb_build_object('id', NEW.glider_id, 'label', NEW.glider),
      OLD.glider IS DISTINCT FROM NEW.glider OR (NEW.glider_id IS NOT NULL AND NEW.glider_id IS DISTINCT FROM OLD.glider_id)),
    ('discipline', to_jsonb(OLD.discipline), to_jsonb(NEW.discipline), OLD.discipline IS DISTINCT FROM NEW.discipline),
    ('is_tandem', to_jsonb(OLD.is_tandem), to_jsonb(NEW.is_tandem), OLD.is_tandem IS DISTINCT FROM NEW.is_tandem),
    ('flight_kind', to_jsonb(OLD.flight_kind), to_jsonb(NEW.flight_kind), OLD.flight_kind IS DISTINCT FROM NEW.flight_kind),
    ('is_solo_shv', to_jsonb(OLD.is_solo_shv), to_jsonb(NEW.is_solo_shv), OLD.is_solo_shv IS DISTINCT FROM NEW.is_solo_shv)
  ) AS c(field, o, n, changed)
  WHERE c.changed;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.log_flight_changes() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_log_flight_changes ON public.flights;
CREATE TRIGGER trg_log_flight_changes
  AFTER UPDATE ON public.flights
  FOR EACH ROW EXECUTE FUNCTION public.log_flight_changes();

-- IGC track added, replaced or removed. Tracks are written by the upload-igc-track function with
-- the service role after it checked that the caller owns the flight, so the owner is the actor.
CREATE OR REPLACE FUNCTION public.log_igc_track_changes()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _flight uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.flight_id ELSE NEW.flight_id END;
  _owner uuid;
BEGIN
  -- Deleting the flight removes its tracks too; nothing to log then.
  SELECT user_id INTO _owner FROM public.flights WHERE id = _flight;
  IF _owner IS NULL THEN RETURN NULL; END IF;
  INSERT INTO public.flight_changes (flight_id, user_id, field, old_value, new_value, changed_by, origin)
  VALUES (_flight, _owner, 'igc_track',
          CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(regexp_replace(OLD.storage_path, '^.*/', '')) END,
          CASE WHEN TG_OP = 'INSERT' THEN to_jsonb(regexp_replace(NEW.storage_path, '^.*/', '')) END,
          COALESCE(auth.uid(), _owner), 'igc');
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.log_igc_track_changes() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_log_igc_track_changes ON public.igc_tracks;
CREATE TRIGGER trg_log_igc_track_changes
  AFTER INSERT OR DELETE ON public.igc_tracks
  FOR EACH ROW EXECUTE FUNCTION public.log_igc_track_changes();

NOTIFY pgrst, 'reload schema';
