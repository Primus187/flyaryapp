-- Flightbook replacement, step 4 (docs/technical/flightbook-replacement-plan.md): training status
-- against the SHV directives, pilot licences and training evidence, and the supervised solo flight.
--
-- * training_requirements: the requirements as data, per discipline and licence, with the source
--   (directive, edition, section). A new edition is a new row with its own valid_from.
-- * pilot_licences / pilot_evidence: licences with issue date (for "since the licence" and "held for
--   N years") and dated courses (safety training at most 3 years old, ...).
-- * The supervised solo flight is confirmed on its own with the checklist (briefing, contact during
--   the flight, readiness); bulk confirmation skips solo flights.
-- * The instructor may set the flight kind of flights without one while confirming them (logged in
--   flight_changes with origin 'confirmation').
-- * training_status(): one server-side evaluation for the app, the dossier and later the PDF. Counts
--   only confirmed, not cancelled flights where the directive demands confirmation; take-off and
--   landing sites are counted separately, an official site once (decision 2026-09-29).
-- Tandem requirements (instruction flights, passengers) follow with step 4b.

-- 1. Licences and evidence
CREATE TABLE IF NOT EXISTS public.pilot_licences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  discipline text NOT NULL CHECK (discipline IN ('paraglider', 'hangglider')),
  level text NOT NULL CHECK (level IN ('pilot', 'biplace_1', 'biplace_2', 'biplace_3')),
  issued_at date NOT NULL,
  licence_number text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, discipline, level)
);
CREATE TABLE IF NOT EXISTS public.pilot_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('safety_training', 'passenger_care_course', 'passenger_care_checkflight', 'theory_exam')),
  completed_at date NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pilot_evidence_user_idx ON public.pilot_evidence (user_id, kind, completed_at);

-- The pilot and the staff of a school the pilot belongs to.
CREATE OR REPLACE FUNCTION public.can_view_training_of(_viewer uuid, _pilot uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _viewer IS NOT NULL AND (_viewer = _pilot OR EXISTS (
    SELECT 1 FROM public.group_members gm JOIN public.groups g ON g.id = gm.group_id AND g.group_type = 'school'
    WHERE gm.user_id = _pilot AND public.is_group_staff(_viewer, gm.group_id)));
$$;
REVOKE ALL ON FUNCTION public.can_view_training_of(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_training_of(uuid, uuid) TO authenticated;

ALTER TABLE public.pilot_licences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pilot_evidence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pilot_licences, public.pilot_evidence FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pilot_licences, public.pilot_evidence TO authenticated;
GRANT ALL ON public.pilot_licences, public.pilot_evidence TO service_role;

DROP POLICY IF EXISTS "Own licences" ON public.pilot_licences;
CREATE POLICY "Own licences" ON public.pilot_licences FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "School staff read licences" ON public.pilot_licences;
CREATE POLICY "School staff read licences" ON public.pilot_licences FOR SELECT TO authenticated
  USING (public.can_view_training_of(auth.uid(), user_id));
DROP POLICY IF EXISTS "Own evidence" ON public.pilot_evidence;
CREATE POLICY "Own evidence" ON public.pilot_evidence FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "School staff read evidence" ON public.pilot_evidence;
CREATE POLICY "School staff read evidence" ON public.pilot_evidence FOR SELECT TO authenticated
  USING (public.can_view_training_of(auth.uid(), user_id));

-- 2. Requirements from the SHV directives (flight-related admission requirements only)
CREATE TABLE IF NOT EXISTS public.training_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discipline text NOT NULL CHECK (discipline IN ('paraglider', 'hangglider')),
  licence text NOT NULL,
  rule text NOT NULL CHECK (rule IN ('confirmed_altitude_flights', 'distinct_takeoff_sites', 'distinct_landing_sites',
    'confirmed_solo_flights', 'confirmed_long_flight_minutes', 'licence_held_years', 'altitude_flights_since_licence',
    'longest_flight_km_since_licence', 'evidence_within_years')),
  threshold numeric NOT NULL,
  params jsonb NOT NULL DEFAULT '{}',
  source text NOT NULL,
  valid_from date NOT NULL,
  sort integer NOT NULL DEFAULT 0,
  UNIQUE (discipline, licence, rule, valid_from)
);
ALTER TABLE public.training_requirements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.training_requirements FROM anon, authenticated;
GRANT SELECT ON public.training_requirements TO authenticated;
GRANT ALL ON public.training_requirements TO service_role;
DROP POLICY IF EXISTS "Everyone signed in reads requirements" ON public.training_requirements;
CREATE POLICY "Everyone signed in reads requirements" ON public.training_requirements FOR SELECT TO authenticated USING (true);

INSERT INTO public.training_requirements (discipline, licence, rule, threshold, params, source, valid_from, sort) VALUES
  ('paraglider', 'pilot', 'confirmed_altitude_flights', 50, '{}', 'SHV-Weisung Gleitschirm-Pilot, Juli 2025, Ziff. 5.1', '2025-07-01', 1),
  ('paraglider', 'pilot', 'distinct_takeoff_sites', 5, '{}', 'SHV-Weisung Gleitschirm-Pilot, Juli 2025, Ziff. 5.1', '2025-07-01', 2),
  ('paraglider', 'pilot', 'distinct_landing_sites', 5, '{}', 'SHV-Weisung Gleitschirm-Pilot, Juli 2025, Ziff. 5.1', '2025-07-01', 3),
  ('paraglider', 'pilot', 'confirmed_solo_flights', 1, '{}', 'SHV-Weisung Gleitschirm-Pilot, Juli 2025, Ziff. 5.1', '2025-07-01', 4),
  ('hangglider', 'pilot', 'confirmed_altitude_flights', 30, '{}', 'SHV-Weisung Delta-Pilot, Juli 2019, Ziff. 5.1', '2019-07-01', 1),
  ('hangglider', 'pilot', 'distinct_takeoff_sites', 3, '{}', 'SHV-Weisung Delta-Pilot, Juli 2019, Ziff. 5.1 (Fluggebiete, gezählt als Start- und Landeplätze)', '2019-07-01', 2),
  ('hangglider', 'pilot', 'distinct_landing_sites', 3, '{}', 'SHV-Weisung Delta-Pilot, Juli 2019, Ziff. 5.1 (Fluggebiete, gezählt als Start- und Landeplätze)', '2019-07-01', 3),
  ('hangglider', 'pilot', 'confirmed_long_flight_minutes', 60, '{}', 'SHV-Weisung Delta-Pilot, Juli 2019, Ziff. 5.1', '2019-07-01', 4),
  ('paraglider', 'biplace_1', 'licence_held_years', 2, '{"level": "pilot"}', 'SHV-Weisung Gleitschirm Doppelsitzer Stufe 1, Januar 2024, Ziff. 4.1', '2024-01-01', 1),
  ('paraglider', 'biplace_1', 'altitude_flights_since_licence', 200, '{"level": "pilot"}', 'SHV-Weisung Gleitschirm Doppelsitzer Stufe 1, Januar 2024, Ziff. 4.1', '2024-01-01', 2),
  ('paraglider', 'biplace_1', 'longest_flight_km_since_licence', 50, '{"level": "pilot"}', 'SHV-Weisung Gleitschirm Doppelsitzer Stufe 1, Januar 2024, Ziff. 4.1 (in XContest dokumentiert)', '2024-01-01', 3),
  ('paraglider', 'biplace_1', 'evidence_within_years', 3, '{"kind": "safety_training"}', 'SHV-Weisung Gleitschirm Doppelsitzer Stufe 1, Januar 2024, Ziff. 4.1', '2024-01-01', 4),
  ('hangglider', 'biplace_1', 'licence_held_years', 2, '{"level": "pilot"}', 'SHV-Weisung Delta Doppelsitzer Stufe 1, Januar 2024, Ziff. 4.1', '2024-01-01', 1),
  ('hangglider', 'biplace_1', 'altitude_flights_since_licence', 200, '{"level": "pilot"}', 'SHV-Weisung Delta Doppelsitzer Stufe 1, Januar 2024, Ziff. 4.1', '2024-01-01', 2)
ON CONFLICT (discipline, licence, rule, valid_from) DO NOTHING;

-- 3. Solo checklist on the confirmation; solo flights are confirmed on their own
ALTER TABLE public.flight_confirmations ADD COLUMN IF NOT EXISTS solo_checklist jsonb;

CREATE OR REPLACE FUNCTION public.confirm_flights(_flight_ids uuid[], _group_id uuid, _set_kind text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _name text;
  _fid uuid;
  _c public.flight_confirmations%ROWTYPE;
  _flight public.flights%ROWTYPE;
  _done int := 0;
  _skipped jsonb := '[]'::jsonb;
BEGIN
  IF _uid IS NULL OR NOT public.is_group_staff(_uid, _group_id) THEN
    RAISE EXCEPTION 'School staff access required' USING ERRCODE = '42501';
  END IF;
  IF _set_kind IS NOT NULL AND _set_kind NOT IN ('practice_slope', 'altitude') THEN
    RAISE EXCEPTION 'Unknown flight kind' USING ERRCODE = '22023';
  END IF;
  SELECT pilot_name INTO _name FROM public.profiles WHERE user_id = _uid;
  FOREACH _fid IN ARRAY COALESCE(_flight_ids, '{}') LOOP
    SELECT * INTO _c FROM public.flight_confirmations WHERE flight_id = _fid AND group_id = _group_id FOR UPDATE;
    IF NOT FOUND OR _c.status <> 'submitted' THEN
      _skipped := _skipped || jsonb_build_object('id', _fid, 'reason', 'not_submitted'); CONTINUE;
    END IF;
    SELECT * INTO _flight FROM public.flights WHERE id = _fid;
    IF _flight.user_id = _uid THEN
      _skipped := _skipped || jsonb_build_object('id', _fid, 'reason', 'own_flight'); CONTINUE;
    END IF;
    IF _flight.cancelled_at IS NOT NULL THEN
      _skipped := _skipped || jsonb_build_object('id', _fid, 'reason', 'cancelled'); CONTINUE;
    END IF;
    IF _flight.is_solo_shv THEN
      _skipped := _skipped || jsonb_build_object('id', _fid, 'reason', 'solo_separately'); CONTINUE;
    END IF;
    IF NOT public.can_confirm_training(_uid, _group_id, _flight.discipline) THEN
      _skipped := _skipped || jsonb_build_object('id', _fid, 'reason', 'not_qualified'); CONTINUE;
    END IF;
    IF NOT public.is_group_member(_flight.user_id, _group_id) THEN
      _skipped := _skipped || jsonb_build_object('id', _fid, 'reason', 'not_member'); CONTINUE;
    END IF;
    IF _set_kind IS NOT NULL AND _flight.flight_kind IS NULL THEN
      PERFORM set_config('flyary.change_origin', 'confirmation', true);
      UPDATE public.flights SET flight_kind = _set_kind WHERE id = _fid;
      PERFORM set_config('flyary.change_origin', '', true);
    END IF;
    UPDATE public.flight_confirmations SET
      status = 'confirmed', instructor_id = _uid, instructor_name = _name,
      instructor_cert = public.instructor_cert_for(_flight.discipline),
      confirmed_data = public.flight_proof_snapshot(_fid), reason = NULL, decided_at = now(), updated_at = now()
    WHERE id = _c.id;
    PERFORM public.log_confirmation_event(_fid, _c.student_id, _group_id, 'confirmed', NULL);
    _done := _done + 1;
  END LOOP;
  RETURN jsonb_build_object('confirmed', _done, 'skipped', _skipped);
END;
$$;
DROP FUNCTION IF EXISTS public.confirm_flights(uuid[], uuid);
REVOKE ALL ON FUNCTION public.confirm_flights(uuid[], uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_flights(uuid[], uuid, text) TO authenticated;

-- The supervised solo flight: the instructor confirms briefing, contact during the flight and the
-- student's readiness (SHV solo checklist); all three are required.
CREATE OR REPLACE FUNCTION public.confirm_solo_flight(_flight_id uuid, _group_id uuid, _briefing boolean, _contact boolean,
  _readiness boolean, _note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _c public.flight_confirmations%ROWTYPE;
  _flight public.flights%ROWTYPE;
BEGIN
  IF NOT (COALESCE(_briefing, false) AND COALESCE(_contact, false) AND COALESCE(_readiness, false)) THEN
    RAISE EXCEPTION 'The solo checklist must be complete' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO _c FROM public.flight_confirmations WHERE flight_id = _flight_id AND group_id = _group_id FOR UPDATE;
  SELECT * INTO _flight FROM public.flights WHERE id = _flight_id;
  IF _c.id IS NULL OR _c.status <> 'submitted' THEN RAISE EXCEPTION 'Flight is not submitted' USING ERRCODE = 'P0001'; END IF;
  IF NOT _flight.is_solo_shv THEN RAISE EXCEPTION 'Not a solo flight' USING ERRCODE = 'P0001'; END IF;
  IF _flight.cancelled_at IS NOT NULL THEN RAISE EXCEPTION 'Flight is cancelled' USING ERRCODE = 'P0001'; END IF;
  IF _flight.user_id = _uid OR NOT public.can_confirm_training(_uid, _group_id, _flight.discipline)
     OR NOT public.is_group_member(_flight.user_id, _group_id) THEN
    RAISE EXCEPTION 'Qualified instructor of the school required' USING ERRCODE = '42501';
  END IF;
  IF _flight.flight_kind IS NULL THEN
    PERFORM set_config('flyary.change_origin', 'confirmation', true);
    UPDATE public.flights SET flight_kind = 'altitude' WHERE id = _flight_id;
    PERFORM set_config('flyary.change_origin', '', true);
  END IF;
  UPDATE public.flight_confirmations SET
    status = 'confirmed', instructor_id = _uid, instructor_name = (SELECT pilot_name FROM public.profiles WHERE user_id = _uid),
    instructor_cert = public.instructor_cert_for(_flight.discipline), confirmed_data = public.flight_proof_snapshot(_flight_id),
    solo_checklist = jsonb_build_object('briefing', true, 'contact', true, 'readiness', true, 'note', NULLIF(trim(COALESCE(_note, '')), '')),
    reason = NULL, decided_at = now(), updated_at = now()
  WHERE id = _c.id;
  PERFORM public.log_confirmation_event(_flight_id, _c.student_id, _group_id, 'confirmed', 'Soloflug mit Checkliste');
END;
$$;
REVOKE ALL ON FUNCTION public.confirm_solo_flight(uuid, uuid, boolean, boolean, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_solo_flight(uuid, uuid, boolean, boolean, boolean, text) TO authenticated;

-- 4. Training status
-- Confirmed, not cancelled flights of the discipline with their site keys (an official site once).
CREATE OR REPLACE FUNCTION public.training_confirmed_flights(_user_id uuid, _discipline text)
RETURNS TABLE (kind text, is_solo boolean, solo_ok boolean, minutes integer, takeoff_key text, landing_key text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT f.flight_kind, f.is_solo_shv, c.solo_checklist IS NOT NULL, f.duration_minutes,
         COALESCE('site:' || lt.official_site_id, 'place:' || lt.id), COALESCE('site:' || ll.official_site_id, 'place:' || ll.id)
  FROM public.flights f
  JOIN public.flight_confirmations c ON c.flight_id = f.id AND c.status = 'confirmed'
  LEFT JOIN public.locations lt ON lt.id = f.takeoff_location_id
  LEFT JOIN public.locations ll ON ll.id = f.landing_location_id
  WHERE f.user_id = _user_id AND f.discipline = _discipline AND f.cancelled_at IS NULL;
$$;
REVOKE ALL ON FUNCTION public.training_confirmed_flights(uuid, text) FROM PUBLIC, anon, authenticated;

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
    SELECT DISTINCT ON (rule) * FROM public.training_requirements
    WHERE discipline = _discipline AND licence = _licence AND valid_from <= current_date
    ORDER BY rule, valid_from DESC
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
        -- Logged flights after the licence need no instructor confirmation; practice-slope flights do not count.
        SELECT CASE WHEN _issued IS NULL THEN NULL ELSE count(*) END INTO _value FROM public.flights
        WHERE user_id = _user_id AND discipline = _discipline AND cancelled_at IS NULL AND date >= _issued
          AND flight_kind IS DISTINCT FROM 'practice_slope';
      WHEN 'longest_flight_km_since_licence' THEN
        SELECT CASE WHEN _issued IS NULL THEN NULL ELSE COALESCE(max(distance_km), 0) END INTO _value FROM public.flights
        WHERE user_id = _user_id AND discipline = _discipline AND cancelled_at IS NULL AND date >= _issued;
      WHEN 'evidence_within_years' THEN
        -- Value: whole years since the latest evidence of that kind (NULL if none); met when <= threshold.
        SELECT floor(extract(epoch FROM age(current_date, max(completed_at))) / 31557600) INTO _value
        FROM public.pilot_evidence WHERE user_id = _user_id AND kind = _req.params->>'kind';
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
REVOKE ALL ON FUNCTION public.training_status(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.training_status(uuid, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
