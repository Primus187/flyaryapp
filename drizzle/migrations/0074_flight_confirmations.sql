-- Flightbook replacement, step 3 (docs/technical/flightbook-replacement-plan.md): instructors confirm
-- training flights one by one (the UI may send several at once, one record per flight).
--
-- Decisions of 2026-09-29: a confirmation is not voided by later changes, the change history
-- (flight_changes, 0073) is the record of them; imported Flightbook flights count only once an
-- instructor confirms them in Flyary (variant B). The stamped printout stays the legal proof.
--
-- * Who confirms: instructor or school lead of the school WITH a valid instructor certificate for the
--   flight's discipline (cert_type 'instructor' = paraglider, 'instructor_hg' = hang glider), never
--   the own flight. Admin rights alone or launch helpers do not confirm.
-- * flight_confirmations: current state per flight (submitted, confirmed, returned, revoked,
--   withdrawn) with the flight data as confirmed, the instructor's and school's names kept as text so
--   the record survives a school change or a deleted school (group_id then becomes NULL).
-- * flight_confirmation_events: append-only history of every step.
-- * Storno instead of delete: a confirmed flight cannot be deleted by app users; it is cancelled with
--   a reason (flights.cancelled_at / cancel_reason, logged in flight_changes). Deleting the account
--   still removes everything (runs without a user session).
-- * Hang glider details on gliders: wing area and class.

-- 1. Hang glider details
ALTER TABLE public.pilot_gliders
  ADD COLUMN IF NOT EXISTS wing_area_m2 numeric(4,1),
  ADD COLUMN IF NOT EXISTS glider_class text;

-- 2. Cancelling a flight
ALTER TABLE public.flights
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_reason text;
ALTER TABLE public.flights DROP CONSTRAINT IF EXISTS flights_cancel_reason_check;
ALTER TABLE public.flights ADD CONSTRAINT flights_cancel_reason_check
  CHECK (cancelled_at IS NULL OR length(trim(COALESCE(cancel_reason, ''))) > 0);

-- The change log of 0073 also records cancelling and restoring.
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

-- 3. Confirmations and their history
CREATE TABLE IF NOT EXISTS public.flight_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flight_id uuid NOT NULL UNIQUE REFERENCES public.flights(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  group_id uuid REFERENCES public.groups(id) ON DELETE SET NULL,
  school_name text NOT NULL,
  status text NOT NULL CHECK (status IN ('submitted', 'confirmed', 'returned', 'revoked', 'withdrawn')),
  instructor_id uuid,
  instructor_name text,
  instructor_cert text,
  confirmed_data jsonb,
  reason text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS flight_confirmations_group_status_idx ON public.flight_confirmations (group_id, status);
CREATE INDEX IF NOT EXISTS flight_confirmations_student_idx ON public.flight_confirmations (student_id);

CREATE TABLE IF NOT EXISTS public.flight_confirmation_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  flight_id uuid NOT NULL REFERENCES public.flights(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  group_id uuid REFERENCES public.groups(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('submitted', 'confirmed', 'returned', 'revoked', 'withdrawn')),
  actor_id uuid,
  actor_name text,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS flight_confirmation_events_flight_idx ON public.flight_confirmation_events (flight_id, created_at);

ALTER TABLE public.flight_confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flight_confirmation_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.flight_confirmations, public.flight_confirmation_events FROM anon, authenticated;
GRANT SELECT ON public.flight_confirmations, public.flight_confirmation_events TO authenticated;
GRANT ALL ON public.flight_confirmations, public.flight_confirmation_events TO service_role;

DROP POLICY IF EXISTS "Student and school staff read confirmations" ON public.flight_confirmations;
CREATE POLICY "Student and school staff read confirmations" ON public.flight_confirmations
  FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR (group_id IS NOT NULL AND public.is_group_staff(auth.uid(), group_id)));
DROP POLICY IF EXISTS "Student and school staff read confirmation events" ON public.flight_confirmation_events;
CREATE POLICY "Student and school staff read confirmation events" ON public.flight_confirmation_events
  FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR (group_id IS NOT NULL AND public.is_group_staff(auth.uid(), group_id)));

-- The school a flight was submitted to also sees the flight's change history.
DROP POLICY IF EXISTS "Pilot and school staff read flight changes" ON public.flight_changes;
CREATE POLICY "Pilot and school staff read flight changes" ON public.flight_changes
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.flights f
               WHERE f.id = flight_changes.flight_id AND f.group_id IS NOT NULL
                 AND public.is_group_staff(auth.uid(), f.group_id))
    OR EXISTS (SELECT 1 FROM public.flight_confirmations c
               WHERE c.flight_id = flight_changes.flight_id AND c.group_id IS NOT NULL
                 AND public.is_group_staff(auth.uid(), c.group_id))
  );

-- 4. Helpers
CREATE OR REPLACE FUNCTION public.instructor_cert_for(_discipline text)
RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN _discipline = 'hangglider' THEN 'instructor_hg' ELSE 'instructor' END;
$$;

-- Instructor or school lead of the school with a certificate for the discipline valid today.
CREATE OR REPLACE FUNCTION public.can_confirm_training(_user_id uuid, _group_id uuid, _discipline text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id IS NOT NULL AND _group_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.group_member_functions
                WHERE user_id = _user_id AND group_id = _group_id AND function IN ('instructor', 'school_lead'))
    AND EXISTS (SELECT 1 FROM public.instructor_certifications
                WHERE user_id = _user_id AND group_id = _group_id
                  AND cert_type = public.instructor_cert_for(_discipline)
                  AND valid_until >= current_date);
$$;
REVOKE ALL ON FUNCTION public.can_confirm_training(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_confirm_training(uuid, uuid, text) TO authenticated;

-- The flight as it is confirmed (kept with the confirmation).
CREATE OR REPLACE FUNCTION public.flight_proof_snapshot(_flight_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'flightNo', f.flight_no, 'date', f.date, 'takeoffAt', f.takeoff_at, 'landingAt', f.landing_at,
    'durationMinutes', f.duration_minutes,
    'takeoff', CASE WHEN lt.id IS NULL THEN NULL ELSE jsonb_build_object('id', lt.id, 'name', COALESCE(lt.custom_name, lt.name), 'altitude', lt.altitude, 'officialSiteId', lt.official_site_id) END,
    'landing', CASE WHEN ll.id IS NULL THEN NULL ELSE jsonb_build_object('id', ll.id, 'name', COALESCE(ll.custom_name, ll.name), 'altitude', ll.altitude, 'officialSiteId', ll.official_site_id) END,
    'glider', f.glider, 'gliderId', f.glider_id, 'discipline', f.discipline, 'isTandem', f.is_tandem,
    'flightKind', f.flight_kind, 'isSoloShv', f.is_solo_shv, 'source', f.source, 'sourceRef', f.source_ref)
  FROM public.flights f
  LEFT JOIN public.locations lt ON lt.id = f.takeoff_location_id
  LEFT JOIN public.locations ll ON ll.id = f.landing_location_id
  WHERE f.id = _flight_id;
$$;
REVOKE ALL ON FUNCTION public.flight_proof_snapshot(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.log_confirmation_event(_flight_id uuid, _student uuid, _group uuid, _action text, _reason text)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.flight_confirmation_events (flight_id, student_id, group_id, action, actor_id, actor_name, reason)
  VALUES (_flight_id, _student, _group, _action, auth.uid(),
          (SELECT pilot_name FROM public.profiles WHERE user_id = auth.uid()), _reason);
$$;
REVOKE ALL ON FUNCTION public.log_confirmation_event(uuid, uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;

-- 5. Student: submit and withdraw
CREATE OR REPLACE FUNCTION public.submit_flights_for_confirmation(_flight_ids uuid[], _group_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _school text;
  _fid uuid;
  _flight public.flights%ROWTYPE;
  _status text;
  _done int := 0;
  _skipped jsonb := '[]'::jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not signed in' USING ERRCODE = '42501'; END IF;
  SELECT name INTO _school FROM public.groups WHERE id = _group_id AND group_type = 'school';
  IF _school IS NULL OR NOT public.is_group_member(_uid, _group_id) THEN
    RAISE EXCEPTION 'Not a member of this school' USING ERRCODE = '42501';
  END IF;
  FOREACH _fid IN ARRAY COALESCE(_flight_ids, '{}') LOOP
    SELECT * INTO _flight FROM public.flights WHERE id = _fid;
    IF NOT FOUND OR _flight.user_id <> _uid THEN
      _skipped := _skipped || jsonb_build_object('id', _fid, 'reason', 'not_own'); CONTINUE;
    END IF;
    IF _flight.cancelled_at IS NOT NULL THEN
      _skipped := _skipped || jsonb_build_object('id', _fid, 'reason', 'cancelled'); CONTINUE;
    END IF;
    SELECT status INTO _status FROM public.flight_confirmations WHERE flight_id = _fid;
    IF _status IN ('submitted', 'confirmed') THEN
      _skipped := _skipped || jsonb_build_object('id', _fid, 'reason', 'already_' || _status); CONTINUE;
    END IF;
    INSERT INTO public.flight_confirmations (flight_id, student_id, group_id, school_name, status, submitted_at)
    VALUES (_fid, _uid, _group_id, _school, 'submitted', now())
    ON CONFLICT (flight_id) DO UPDATE SET
      group_id = EXCLUDED.group_id, school_name = EXCLUDED.school_name, status = 'submitted',
      instructor_id = NULL, instructor_name = NULL, instructor_cert = NULL, confirmed_data = NULL,
      reason = NULL, submitted_at = now(), decided_at = NULL, updated_at = now();
    PERFORM public.log_confirmation_event(_fid, _uid, _group_id, 'submitted', NULL);
    _done := _done + 1;
  END LOOP;
  RETURN jsonb_build_object('submitted', _done, 'skipped', _skipped);
END;
$$;
REVOKE ALL ON FUNCTION public.submit_flights_for_confirmation(uuid[], uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_flights_for_confirmation(uuid[], uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.withdraw_flight_submission(_flight_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _c public.flight_confirmations%ROWTYPE;
BEGIN
  SELECT * INTO _c FROM public.flight_confirmations WHERE flight_id = _flight_id;
  IF NOT FOUND OR _c.student_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Not your submission' USING ERRCODE = '42501';
  END IF;
  IF _c.status NOT IN ('submitted', 'returned') THEN
    RAISE EXCEPTION 'Only open submissions can be withdrawn' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.flight_confirmations SET status = 'withdrawn', decided_at = now(), updated_at = now() WHERE id = _c.id;
  PERFORM public.log_confirmation_event(_flight_id, _c.student_id, _c.group_id, 'withdrawn', NULL);
END;
$$;
REVOKE ALL ON FUNCTION public.withdraw_flight_submission(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.withdraw_flight_submission(uuid) TO authenticated;

-- 6. Instructor: confirm (several at once, one record each), return, revoke
CREATE OR REPLACE FUNCTION public.confirm_flights(_flight_ids uuid[], _group_id uuid)
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
    IF NOT public.can_confirm_training(_uid, _group_id, _flight.discipline) THEN
      _skipped := _skipped || jsonb_build_object('id', _fid, 'reason', 'not_qualified'); CONTINUE;
    END IF;
    IF NOT public.is_group_member(_flight.user_id, _group_id) THEN
      _skipped := _skipped || jsonb_build_object('id', _fid, 'reason', 'not_member'); CONTINUE;
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
REVOKE ALL ON FUNCTION public.confirm_flights(uuid[], uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_flights(uuid[], uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.return_flight_for_correction(_flight_id uuid, _reason text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _c public.flight_confirmations%ROWTYPE;
BEGIN
  IF length(trim(COALESCE(_reason, ''))) = 0 THEN RAISE EXCEPTION 'A reason is required' USING ERRCODE = '22023'; END IF;
  SELECT * INTO _c FROM public.flight_confirmations WHERE flight_id = _flight_id FOR UPDATE;
  IF NOT FOUND OR _c.group_id IS NULL OR NOT public.is_group_staff(auth.uid(), _c.group_id) THEN
    RAISE EXCEPTION 'School staff access required' USING ERRCODE = '42501';
  END IF;
  IF _c.status <> 'submitted' THEN RAISE EXCEPTION 'Only submitted flights can be returned' USING ERRCODE = 'P0001'; END IF;
  UPDATE public.flight_confirmations SET status = 'returned', reason = trim(_reason), decided_at = now(), updated_at = now() WHERE id = _c.id;
  PERFORM public.log_confirmation_event(_flight_id, _c.student_id, _c.group_id, 'returned', trim(_reason));
END;
$$;
REVOKE ALL ON FUNCTION public.return_flight_for_correction(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.return_flight_for_correction(uuid, text) TO authenticated;

-- Revoking needs the same qualification as confirming, and always a reason.
CREATE OR REPLACE FUNCTION public.revoke_flight_confirmation(_flight_id uuid, _reason text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _c public.flight_confirmations%ROWTYPE; _discipline text;
BEGIN
  IF length(trim(COALESCE(_reason, ''))) = 0 THEN RAISE EXCEPTION 'A reason is required' USING ERRCODE = '22023'; END IF;
  SELECT * INTO _c FROM public.flight_confirmations WHERE flight_id = _flight_id FOR UPDATE;
  SELECT discipline INTO _discipline FROM public.flights WHERE id = _flight_id;
  IF NOT FOUND OR _c.id IS NULL OR NOT public.can_confirm_training(auth.uid(), _c.group_id, _discipline) THEN
    RAISE EXCEPTION 'Qualified instructor of the school required' USING ERRCODE = '42501';
  END IF;
  IF _c.status <> 'confirmed' THEN RAISE EXCEPTION 'Only confirmed flights can be revoked' USING ERRCODE = 'P0001'; END IF;
  UPDATE public.flight_confirmations SET status = 'revoked', reason = trim(_reason), decided_at = now(), updated_at = now() WHERE id = _c.id;
  PERFORM public.log_confirmation_event(_flight_id, _c.student_id, _c.group_id, 'revoked', trim(_reason));
END;
$$;
REVOKE ALL ON FUNCTION public.revoke_flight_confirmation(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_flight_confirmation(uuid, text) TO authenticated;

-- 7. The school's list: submitted or confirmed flights with the live flight data, whether the
--    caller may confirm each one and whether the flight changed after its confirmation.
CREATE OR REPLACE FUNCTION public.school_flight_confirmations(_group_id uuid, _status text DEFAULT 'submitted')
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_group_staff(auth.uid(), _group_id) THEN
    RAISE EXCEPTION 'School staff access required' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'flightId', c.flight_id, 'studentId', c.student_id, 'studentName', p.pilot_name, 'status', c.status,
      'submittedAt', c.submitted_at, 'decidedAt', c.decided_at, 'instructorName', c.instructor_name,
      'flight', public.flight_proof_snapshot(c.flight_id),
      'canConfirm', public.can_confirm_training(auth.uid(), _group_id, f.discipline) AND f.user_id <> auth.uid(),
      'changedAfterConfirmation', c.status = 'confirmed' AND EXISTS (
        SELECT 1 FROM public.flight_changes ch WHERE ch.flight_id = c.flight_id AND ch.changed_at > c.decided_at),
      'cancelled', f.cancelled_at IS NOT NULL)
      ORDER BY p.pilot_name, f.date, f.flight_no)
    FROM public.flight_confirmations c
    JOIN public.flights f ON f.id = c.flight_id
    LEFT JOIN public.profiles p ON p.user_id = c.student_id
    WHERE c.group_id = _group_id AND c.status = _status
  ), '[]'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.school_flight_confirmations(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_flight_confirmations(uuid, text) TO authenticated;

-- 8. A confirmed flight is cancelled, not deleted (account deletion runs without a session).
CREATE OR REPLACE FUNCTION public.protect_confirmed_flight()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.flight_confirmations WHERE flight_id = OLD.id AND status = 'confirmed') THEN
    RAISE EXCEPTION 'Confirmed flights cannot be deleted; cancel them instead' USING ERRCODE = '42501';
  END IF;
  RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION public.protect_confirmed_flight() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_protect_confirmed_flight ON public.flights;
CREATE TRIGGER trg_protect_confirmed_flight
  BEFORE DELETE ON public.flights
  FOR EACH ROW EXECUTE FUNCTION public.protect_confirmed_flight();

NOTIFY pgrst, 'reload schema';
