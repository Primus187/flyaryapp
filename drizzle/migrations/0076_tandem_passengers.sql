-- Flightbook replacement, step 4b (docs/technical/flightbook-replacement-plan.md): tandem flights with
-- passenger confirmation, and the tandem requirements of the SHV directives.
--
-- * flights.tandem_kind: 'instruction' (tandem flight with an instructor as the student's passenger),
--   'practice' (training flight with a pilot or student as passenger, under supervision),
--   'passenger' (tandem flight with a guest).
-- * flight_passengers: one passenger per tandem flight. The passenger confirms in the app (a Flyary
--   account) or through a single-use link / QR code without an account. Only the name is required
--   (needed for the stage 3 renewal proof: pilot, passenger, site, date). The link token is stored
--   hashed, expires after 14 days and is spent on use. A later change of the flight does not ask the
--   passenger again (decision 2026-09-29); the change history shows it.
-- * GS Biplace 3: each training flight is signed by the co-flying pilot/student -> counted only with
--   the passenger's confirmation.
-- * Requirements may now repeat a rule with different parameters (e.g. instruction and practice
--   flights); params.label names the line in the app.

-- 1. Tandem kind (and its change log)
ALTER TABLE public.flights ADD COLUMN IF NOT EXISTS tandem_kind text;
ALTER TABLE public.flights DROP CONSTRAINT IF EXISTS flights_tandem_kind_check;
ALTER TABLE public.flights ADD CONSTRAINT flights_tandem_kind_check CHECK (tandem_kind IN ('instruction', 'practice', 'passenger'));

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
    ('glider', jsonb_build_object('id', OLD.glider_id, 'label', OLD.glider), jsonb_build_object('id', NEW.glider_id, 'label', NEW.glider),
      OLD.glider IS DISTINCT FROM NEW.glider OR (NEW.glider_id IS NOT NULL AND NEW.glider_id IS DISTINCT FROM OLD.glider_id)),
    ('discipline', to_jsonb(OLD.discipline), to_jsonb(NEW.discipline), OLD.discipline IS DISTINCT FROM NEW.discipline),
    ('is_tandem', to_jsonb(OLD.is_tandem), to_jsonb(NEW.is_tandem), OLD.is_tandem IS DISTINCT FROM NEW.is_tandem),
    ('tandem_kind', to_jsonb(OLD.tandem_kind), to_jsonb(NEW.tandem_kind), OLD.tandem_kind IS DISTINCT FROM NEW.tandem_kind),
    ('flight_kind', to_jsonb(OLD.flight_kind), to_jsonb(NEW.flight_kind), OLD.flight_kind IS DISTINCT FROM NEW.flight_kind),
    ('is_solo_shv', to_jsonb(OLD.is_solo_shv), to_jsonb(NEW.is_solo_shv), OLD.is_solo_shv IS DISTINCT FROM NEW.is_solo_shv),
    ('cancelled',
      CASE WHEN OLD.cancelled_at IS NULL THEN NULL ELSE jsonb_build_object('at', OLD.cancelled_at, 'reason', OLD.cancel_reason) END,
      CASE WHEN NEW.cancelled_at IS NULL THEN NULL ELSE jsonb_build_object('at', NEW.cancelled_at, 'reason', NEW.cancel_reason) END,
      OLD.cancelled_at IS DISTINCT FROM NEW.cancelled_at)
  ) AS c(field, o, n, changed)
  WHERE c.changed;
  RETURN NULL;
END;
$$;

-- 2. Passengers
CREATE TABLE IF NOT EXISTS public.flight_passengers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flight_id uuid NOT NULL UNIQUE REFERENCES public.flights(id) ON DELETE CASCADE,
  pilot_id uuid NOT NULL,
  passenger_user_id uuid,
  passenger_name text NOT NULL CHECK (length(trim(passenger_name)) > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed')),
  token_hash text UNIQUE,
  token_expires_at timestamptz,
  confirmed_at timestamptz,
  confirmed_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS flight_passengers_passenger_idx ON public.flight_passengers (passenger_user_id) WHERE passenger_user_id IS NOT NULL;

ALTER TABLE public.flight_passengers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.flight_passengers FROM anon, authenticated;
-- Column grants without token_hash (a column REVOKE would not work next to a table-wide SELECT grant).
GRANT SELECT (id, flight_id, pilot_id, passenger_user_id, passenger_name, status, token_expires_at, confirmed_at,
  confirmed_data, created_at, updated_at) ON public.flight_passengers TO authenticated;
GRANT ALL ON public.flight_passengers TO service_role;

DROP POLICY IF EXISTS "Pilot, passenger and school staff read passengers" ON public.flight_passengers;
CREATE POLICY "Pilot, passenger and school staff read passengers" ON public.flight_passengers
  FOR SELECT TO authenticated
  USING (pilot_id = auth.uid() OR passenger_user_id = auth.uid() OR public.can_view_training_of(auth.uid(), pilot_id));

CREATE OR REPLACE FUNCTION public.passenger_token_hash(_token text)
RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT encode(sha256(convert_to(COALESCE(_token, ''), 'UTF8')), 'hex');
$$;

-- The pilot names the passenger (optionally a Flyary user). Changing the person resets the confirmation.
CREATE OR REPLACE FUNCTION public.set_flight_passenger(_flight_id uuid, _name text, _passenger_user_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _old public.flight_passengers%ROWTYPE;
  _name_clean text := trim(COALESCE(_name, ''));
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.flights WHERE id = _flight_id AND user_id = _uid) THEN
    RAISE EXCEPTION 'Not your flight' USING ERRCODE = '42501';
  END IF;
  IF _name_clean = '' THEN RAISE EXCEPTION 'A passenger name is required' USING ERRCODE = '22023'; END IF;
  IF _passenger_user_id = _uid THEN RAISE EXCEPTION 'The pilot cannot be the passenger' USING ERRCODE = '22023'; END IF;
  SELECT * INTO _old FROM public.flight_passengers WHERE flight_id = _flight_id;
  IF FOUND AND _old.passenger_name = _name_clean AND _old.passenger_user_id IS NOT DISTINCT FROM _passenger_user_id THEN
    RETURN;
  END IF;
  INSERT INTO public.flight_passengers (flight_id, pilot_id, passenger_user_id, passenger_name)
  VALUES (_flight_id, _uid, _passenger_user_id, _name_clean)
  ON CONFLICT (flight_id) DO UPDATE SET
    passenger_user_id = EXCLUDED.passenger_user_id, passenger_name = EXCLUDED.passenger_name, status = 'pending',
    token_hash = NULL, token_expires_at = NULL, confirmed_at = NULL, confirmed_data = NULL, updated_at = now();
  INSERT INTO public.flight_changes (flight_id, user_id, field, old_value, new_value, changed_by, origin)
  VALUES (_flight_id, _uid, 'passenger',
          CASE WHEN _old.id IS NULL THEN NULL ELSE jsonb_build_object('name', _old.passenger_name, 'confirmed', _old.status = 'confirmed') END,
          jsonb_build_object('name', _name_clean, 'confirmed', false), _uid, 'app');
END;
$$;
REVOKE ALL ON FUNCTION public.set_flight_passenger(uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_flight_passenger(uuid, text, uuid) TO authenticated;

-- A fresh single-use link for the passenger (the plain token is returned once, only its hash is kept).
CREATE OR REPLACE FUNCTION public.create_passenger_token(_flight_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _token text := encode(sha256(convert_to(gen_random_uuid()::text || gen_random_uuid()::text || clock_timestamp()::text, 'UTF8')), 'hex');
BEGIN
  UPDATE public.flight_passengers SET token_hash = public.passenger_token_hash(_token),
    token_expires_at = now() + interval '14 days', updated_at = now()
  WHERE flight_id = _flight_id AND pilot_id = auth.uid() AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'No open passenger confirmation for this flight' USING ERRCODE = 'P0001'; END IF;
  RETURN _token;
END;
$$;
REVOKE ALL ON FUNCTION public.create_passenger_token(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_passenger_token(uuid) TO authenticated;

-- What the passenger sees behind the link: only date, sites, pilot, duration and their own name.
CREATE OR REPLACE FUNCTION public.passenger_confirmation_info(_token text)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'date', f.date, 'durationMinutes', f.duration_minutes, 'passengerName', p.passenger_name,
    'pilotName', pr.pilot_name,
    'takeoff', (SELECT COALESCE(custom_name, name) FROM public.locations WHERE id = f.takeoff_location_id),
    'landing', (SELECT COALESCE(custom_name, name) FROM public.locations WHERE id = f.landing_location_id),
    'discipline', f.discipline, 'expired', p.token_expires_at < now())
  FROM public.flight_passengers p
  JOIN public.flights f ON f.id = p.flight_id
  LEFT JOIN public.profiles pr ON pr.user_id = p.pilot_id
  WHERE p.token_hash = public.passenger_token_hash(_token) AND p.status = 'pending' AND f.cancelled_at IS NULL;
$$;
REVOKE ALL ON FUNCTION public.passenger_confirmation_info(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.passenger_confirmation_info(text) TO anon, authenticated;

-- The passenger confirms through the link (no account needed); the token is spent.
CREATE OR REPLACE FUNCTION public.confirm_as_passenger(_token text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _p public.flight_passengers%ROWTYPE;
BEGIN
  SELECT * INTO _p FROM public.flight_passengers WHERE token_hash = public.passenger_token_hash(_token) FOR UPDATE;
  IF NOT FOUND OR _p.status <> 'pending' OR _p.token_expires_at < now()
     OR EXISTS (SELECT 1 FROM public.flights WHERE id = _p.flight_id AND cancelled_at IS NOT NULL) THEN
    RETURN false;
  END IF;
  IF auth.uid() = _p.pilot_id THEN RAISE EXCEPTION 'The pilot cannot confirm as passenger' USING ERRCODE = '42501'; END IF;
  UPDATE public.flight_passengers SET status = 'confirmed', confirmed_at = now(), confirmed_data = public.flight_proof_snapshot(_p.flight_id),
    passenger_user_id = COALESCE(passenger_user_id, auth.uid()), token_hash = NULL, token_expires_at = NULL, updated_at = now()
  WHERE id = _p.id;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.confirm_as_passenger(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_as_passenger(text) TO anon, authenticated;

-- A passenger with an account confirms in the app.
CREATE OR REPLACE FUNCTION public.confirm_passenger_flight(_flight_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.flight_passengers SET status = 'confirmed', confirmed_at = now(), confirmed_data = public.flight_proof_snapshot(_flight_id),
    token_hash = NULL, token_expires_at = NULL, updated_at = now()
  WHERE flight_id = _flight_id AND passenger_user_id = auth.uid() AND status = 'pending'
    AND NOT EXISTS (SELECT 1 FROM public.flights WHERE id = _flight_id AND cancelled_at IS NOT NULL);
  IF NOT FOUND THEN RAISE EXCEPTION 'No open confirmation for you on this flight' USING ERRCODE = '42501'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.confirm_passenger_flight(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_passenger_flight(uuid) TO authenticated;

-- Flights where the user is the named passenger and has not confirmed yet.
CREATE OR REPLACE FUNCTION public.my_open_passenger_confirmations()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'flightId', f.id, 'date', f.date, 'durationMinutes', f.duration_minutes, 'pilotName', pr.pilot_name,
    'takeoff', (SELECT COALESCE(custom_name, name) FROM public.locations WHERE id = f.takeoff_location_id),
    'landing', (SELECT COALESCE(custom_name, name) FROM public.locations WHERE id = f.landing_location_id)) ORDER BY f.date DESC), '[]'::jsonb)
  FROM public.flight_passengers p
  JOIN public.flights f ON f.id = p.flight_id AND f.cancelled_at IS NULL
  LEFT JOIN public.profiles pr ON pr.user_id = p.pilot_id
  WHERE p.passenger_user_id = auth.uid() AND p.status = 'pending';
$$;
REVOKE ALL ON FUNCTION public.my_open_passenger_confirmations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_open_passenger_confirmations() TO authenticated;

-- 3. Tandem requirements
ALTER TABLE public.training_requirements DROP CONSTRAINT IF EXISTS training_requirements_rule_check;
ALTER TABLE public.training_requirements ADD CONSTRAINT training_requirements_rule_check CHECK (rule IN (
  'confirmed_altitude_flights', 'distinct_takeoff_sites', 'distinct_landing_sites', 'confirmed_solo_flights',
  'confirmed_long_flight_minutes', 'licence_held_years', 'altitude_flights_since_licence', 'longest_flight_km_since_licence',
  'evidence_within_years', 'evidence_present', 'tandem_flights', 'tandem_distinct_takeoff_sites', 'tandem_distinct_landing_sites',
  'tandem_distinct_passengers', 'tandem_flights_per_year'));
ALTER TABLE public.training_requirements DROP CONSTRAINT IF EXISTS training_requirements_discipline_licence_rule_valid_from_key;
DROP INDEX IF EXISTS public.training_requirements_unique_idx;
CREATE UNIQUE INDEX training_requirements_unique_idx ON public.training_requirements (discipline, licence, rule, params, valid_from);

INSERT INTO public.training_requirements (discipline, licence, rule, threshold, params, source, valid_from, sort) VALUES
  ('paraglider', 'biplace_1', 'tandem_flights', 1, '{"kind": "instruction", "label": "tandem_instruction"}', 'SHV-Weisung Gleitschirm Doppelsitzer Stufe 1, Januar 2024, Ziff. 5.1', '2024-01-01', 5),
  ('paraglider', 'biplace_1', 'tandem_flights', 20, '{"kind": "practice", "label": "tandem_practice"}', 'SHV-Weisung Gleitschirm Doppelsitzer Stufe 1, Januar 2024, Ziff. 5.1', '2024-01-01', 6),
  ('hangglider', 'biplace_1', 'tandem_flights', 1, '{"kind": "instruction", "label": "tandem_instruction"}', 'SHV-Weisung Delta Doppelsitzer Stufe 1, Januar 2024, Ziff. 5.1', '2024-01-01', 5),
  ('hangglider', 'biplace_1', 'tandem_flights', 10, '{"kind": "practice", "label": "tandem_practice"}', 'SHV-Weisung Delta Doppelsitzer Stufe 1, Januar 2024, Ziff. 5.1', '2024-01-01', 6),
  ('paraglider', 'biplace_3', 'tandem_flights', 30, '{"kind": "practice", "level": "biplace_1", "passengerConfirmed": true, "label": "tandem_practice_signed"}', 'SHV-Weisung Gleitschirm Doppelsitzer Stufe 3, Mai 2023, Ziff. 5.1', '2023-05-15', 1),
  ('paraglider', 'biplace_3', 'tandem_distinct_takeoff_sites', 5, '{"kind": "practice", "level": "biplace_1", "passengerConfirmed": true}', 'SHV-Weisung Gleitschirm Doppelsitzer Stufe 3, Mai 2023, Ziff. 5.1 (Fluggebiete, gezählt als Start- und Landeplätze)', '2023-05-15', 2),
  ('paraglider', 'biplace_3', 'tandem_distinct_landing_sites', 5, '{"kind": "practice", "level": "biplace_1", "passengerConfirmed": true}', 'SHV-Weisung Gleitschirm Doppelsitzer Stufe 3, Mai 2023, Ziff. 5.1 (Fluggebiete, gezählt als Start- und Landeplätze)', '2023-05-15', 3),
  ('paraglider', 'biplace_3', 'tandem_distinct_passengers', 3, '{"kind": "practice", "level": "biplace_1", "passengerConfirmed": true}', 'SHV-Weisung Gleitschirm Doppelsitzer Stufe 3, Mai 2023, Ziff. 5.1', '2023-05-15', 4),
  ('paraglider', 'biplace_3', 'evidence_present', 1, '{"kind": "passenger_care_course"}', 'SHV-Weisung Gleitschirm Doppelsitzer Stufe 3, Mai 2023, Ziff. 5.1', '2023-05-15', 5),
  ('hangglider', 'biplace_3', 'tandem_flights', 30, '{"kind": "practice", "level": "biplace_1", "label": "tandem_practice_since_b1"}', 'SHV-Weisung Delta Doppelsitzer Stufe 3, Januar 2024, Ziff. 5.1', '2024-01-01', 1),
  ('hangglider', 'biplace_3', 'evidence_present', 1, '{"kind": "passenger_care_checkflight"}', 'SHV-Weisung Delta Doppelsitzer Stufe 3, Januar 2024, Ziff. 5.1', '2024-01-01', 2),
  ('paraglider', 'biplace_3_renewal', 'tandem_flights', 50, '{"withinYears": 3, "label": "tandem_last_3_years"}', 'SHV-Weisung Gleitschirm Doppelsitzer Stufe 3, Mai 2023, Ziff. 7.2 (vereinfacht: die letzten drei Jahre ab heute)', '2023-05-15', 1),
  ('paraglider', 'biplace_3_renewal', 'tandem_flights_per_year', 10, '{"years": 3}', 'SHV-Weisung Gleitschirm Doppelsitzer Stufe 3, Mai 2023, Ziff. 7.2 (vereinfacht: die letzten drei Jahre ab heute)', '2023-05-15', 2),
  ('hangglider', 'biplace_3_renewal', 'tandem_flights', 30, '{"withinYears": 3, "label": "tandem_last_3_years"}', 'SHV-Weisung Delta Doppelsitzer Stufe 3, Januar 2024, Ziff. 7.2 (vereinfacht: die letzten drei Jahre ab heute)', '2024-01-01', 1),
  ('hangglider', 'biplace_3_renewal', 'tandem_flights_per_year', 5, '{"years": 3}', 'SHV-Weisung Delta Doppelsitzer Stufe 3, Januar 2024, Ziff. 7.2 (vereinfacht: die letzten drei Jahre ab heute)', '2024-01-01', 2)
ON CONFLICT DO NOTHING;

-- Tandem flights of the pilot as the requirement's params select them (kind, since a licence,
-- confirmed by the passenger, within the last years).
CREATE OR REPLACE FUNCTION public.training_tandem_flights(_user_id uuid, _discipline text, _params jsonb, _since date)
RETURNS TABLE (flight_date date, takeoff_key text, landing_key text, passenger_key text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT f.date,
         COALESCE('site:' || lt.official_site_id, 'place:' || lt.id), COALESCE('site:' || ll.official_site_id, 'place:' || ll.id),
         CASE WHEN p.id IS NULL THEN NULL ELSE COALESCE('user:' || p.passenger_user_id, 'name:' || lower(trim(p.passenger_name))) END
  FROM public.flights f
  LEFT JOIN public.flight_passengers p ON p.flight_id = f.id
  LEFT JOIN public.locations lt ON lt.id = f.takeoff_location_id
  LEFT JOIN public.locations ll ON ll.id = f.landing_location_id
  WHERE f.user_id = _user_id AND f.discipline = _discipline AND f.is_tandem AND f.cancelled_at IS NULL
    AND (_params->>'kind' IS NULL OR f.tandem_kind = _params->>'kind')
    AND (_params->>'level' IS NULL OR f.date >= _since)
    AND (NOT COALESCE((_params->>'passengerConfirmed')::boolean, false) OR p.status = 'confirmed')
    AND (_params->>'withinYears' IS NULL OR f.date > current_date - make_interval(years => (_params->>'withinYears')::int));
$$;
REVOKE ALL ON FUNCTION public.training_tandem_flights(uuid, text, jsonb, date) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.training_status(_user_id uuid, _discipline text, _licence text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _req record;
  _value numeric;
  _issued date;
  _rows jsonb := '[]'::jsonb;
BEGIN
  IF NOT public.can_view_training_of(auth.uid(), _user_id) THEN
    RAISE EXCEPTION 'No access to this training status' USING ERRCODE = '42501';
  END IF;

  FOR _req IN
    SELECT DISTINCT ON (rule, params) * FROM public.training_requirements
    WHERE discipline = _discipline AND licence = _licence AND valid_from <= current_date
    ORDER BY rule, params, valid_from DESC
  LOOP
    _value := NULL;
    _issued := (SELECT issued_at FROM public.pilot_licences WHERE user_id = _user_id AND discipline = _discipline
                  AND level = COALESCE(_req.params->>'level', 'pilot'));
    CASE _req.rule
      WHEN 'confirmed_altitude_flights' THEN
        SELECT count(*) INTO _value FROM public.training_confirmed_flights(_user_id, _discipline) WHERE kind = 'altitude';
      WHEN 'distinct_takeoff_sites' THEN
        SELECT count(DISTINCT takeoff_key) INTO _value FROM public.training_confirmed_flights(_user_id, _discipline) WHERE kind = 'altitude';
      WHEN 'distinct_landing_sites' THEN
        SELECT count(DISTINCT landing_key) INTO _value FROM public.training_confirmed_flights(_user_id, _discipline) WHERE kind = 'altitude';
      WHEN 'confirmed_solo_flights' THEN
        SELECT count(*) INTO _value FROM public.training_confirmed_flights(_user_id, _discipline) WHERE is_solo AND solo_ok;
      WHEN 'confirmed_long_flight_minutes' THEN
        SELECT COALESCE(max(minutes), 0) INTO _value FROM public.training_confirmed_flights(_user_id, _discipline) WHERE kind = 'altitude';
      WHEN 'licence_held_years' THEN
        _value := CASE WHEN _issued IS NULL THEN NULL
                  ELSE floor(extract(year FROM age(current_date, _issued)) + extract(month FROM age(current_date, _issued)) / 12.0) END;
      WHEN 'altitude_flights_since_licence' THEN
        SELECT CASE WHEN _issued IS NULL THEN NULL ELSE count(*) END INTO _value FROM public.flights
        WHERE user_id = _user_id AND discipline = _discipline AND cancelled_at IS NULL AND date >= _issued
          AND flight_kind IS DISTINCT FROM 'practice_slope';
      WHEN 'longest_flight_km_since_licence' THEN
        SELECT CASE WHEN _issued IS NULL THEN NULL ELSE COALESCE(max(distance_km), 0) END INTO _value FROM public.flights
        WHERE user_id = _user_id AND discipline = _discipline AND cancelled_at IS NULL AND date >= _issued;
      WHEN 'evidence_within_years' THEN
        SELECT floor(extract(epoch FROM age(current_date, max(completed_at))) / 31557600) INTO _value
        FROM public.pilot_evidence WHERE user_id = _user_id AND kind = _req.params->>'kind';
      WHEN 'evidence_present' THEN
        SELECT count(*) INTO _value FROM public.pilot_evidence WHERE user_id = _user_id AND kind = _req.params->>'kind';
      WHEN 'tandem_flights' THEN
        IF _req.params->>'level' IS NULL OR _issued IS NOT NULL THEN
          SELECT count(*) INTO _value FROM public.training_tandem_flights(_user_id, _discipline, _req.params, _issued);
        END IF;
      WHEN 'tandem_distinct_takeoff_sites' THEN
        IF _req.params->>'level' IS NULL OR _issued IS NOT NULL THEN
          SELECT count(DISTINCT takeoff_key) INTO _value FROM public.training_tandem_flights(_user_id, _discipline, _req.params, _issued);
        END IF;
      WHEN 'tandem_distinct_landing_sites' THEN
        IF _req.params->>'level' IS NULL OR _issued IS NOT NULL THEN
          SELECT count(DISTINCT landing_key) INTO _value FROM public.training_tandem_flights(_user_id, _discipline, _req.params, _issued);
        END IF;
      WHEN 'tandem_distinct_passengers' THEN
        IF _req.params->>'level' IS NULL OR _issued IS NOT NULL THEN
          SELECT count(DISTINCT passenger_key) INTO _value FROM public.training_tandem_flights(_user_id, _discipline, _req.params, _issued);
        END IF;
      WHEN 'tandem_flights_per_year' THEN
        -- The weakest of the last N years (each year counted back from today).
        SELECT min(n) INTO _value FROM (
          SELECT (SELECT count(*) FROM public.training_tandem_flights(_user_id, _discipline, '{}'::jsonb, NULL) t
                  WHERE t.flight_date > current_date - make_interval(years => y) AND t.flight_date <= current_date - make_interval(years => y - 1)) AS n
          FROM generate_series(1, COALESCE((_req.params->>'years')::int, 3)) AS y) per_year;
    END CASE;
    _rows := _rows || jsonb_build_object(
      'rule', _req.rule, 'threshold', _req.threshold, 'value', _value, 'params', _req.params, 'source', _req.source,
      'met', CASE WHEN _value IS NULL THEN false
                  WHEN _req.rule = 'evidence_within_years' THEN _value < _req.threshold
                  ELSE _value >= _req.threshold END,
      'sort', _req.sort);
  END LOOP;

  RETURN jsonb_build_object(
    'discipline', _discipline, 'licence', _licence,
    'requirements', COALESCE((SELECT jsonb_agg(r ORDER BY (r->>'sort')::int) FROM jsonb_array_elements(_rows) r), '[]'::jsonb),
    'confirmedWithoutKind', (SELECT count(*) FROM public.training_confirmed_flights(_user_id, _discipline) WHERE kind IS NULL),
    'confirmedPractice', (SELECT count(*) FROM public.training_confirmed_flights(_user_id, _discipline) WHERE kind = 'practice_slope'),
    'licenceIssuedAt', (SELECT issued_at FROM public.pilot_licences WHERE user_id = _user_id AND discipline = _discipline AND level = 'pilot'));
END;
$$;

NOTIFY pgrst, 'reload schema';
