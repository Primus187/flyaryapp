-- Compact track previews and bounded, RLS-preserving read models.
-- Apply before deploying the frontend that calls these RPCs.
CREATE OR REPLACE FUNCTION public.build_track_thumbnail(raw jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE points jsonb; n integer; result jsonb;
BEGIN
  points := CASE WHEN jsonb_typeof(raw) = 'array' THEN raw ELSE raw->'points' END;
  IF points IS NULL OR jsonb_typeof(points) <> 'array' THEN RETURN '[]'::jsonb; END IF;
  n := jsonb_array_length(points);
  IF n < 2 THEN RETURN '[]'::jsonb; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_array(lat, lng) ORDER BY idx), '[]'::jsonb)
    INTO result
    FROM (
      SELECT idx,
        CASE WHEN jsonb_typeof(p) = 'array' THEN p->0 ELSE p->'lat' END AS lat,
        CASE WHEN jsonb_typeof(p) = 'array' THEN p->1 ELSE p->'lng' END AS lng
      FROM (
        SELECT idx, points->floor(idx::numeric * (n - 1) / (least(n, 40) - 1))::integer AS p
        FROM generate_series(0, least(n, 40) - 1) AS idx
      ) sampled
    ) coordinates
    WHERE jsonb_typeof(lat) = 'number' AND jsonb_typeof(lng) = 'number';
  RETURN result;
END;
$$;

ALTER TABLE public.igc_tracks ADD COLUMN IF NOT EXISTS track_thumbnail jsonb NOT NULL DEFAULT '[]'::jsonb;
CREATE OR REPLACE FUNCTION public.set_track_thumbnail()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.track_thumbnail := public.build_track_thumbnail(NEW.track_data);
  RETURN NEW;
END;
$$;
CREATE TRIGGER igc_track_thumbnail BEFORE INSERT OR UPDATE OF track_data ON public.igc_tracks
FOR EACH ROW EXECUTE FUNCTION public.set_track_thumbnail();
UPDATE public.igc_tracks SET track_thumbnail = public.build_track_thumbnail(track_data);

CREATE INDEX IF NOT EXISTS idx_igc_tracks_flight ON public.igc_tracks(flight_id);
CREATE INDEX IF NOT EXISTS idx_flights_user_date_id ON public.flights(user_id, date DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_flights_group_user ON public.flights(group_id, user_id);
CREATE INDEX IF NOT EXISTS idx_events_group_date ON public.flight_events(group_id, event_date DESC);
CREATE INDEX IF NOT EXISTS idx_day_notes_event_student ON public.student_day_notes(event_id, student_user_id);

CREATE OR REPLACE FUNCTION public.list_flights_page(
  _offset integer DEFAULT 0, _limit integer DEFAULT 40, _search text DEFAULT '',
  _group text DEFAULT 'all', _filter text DEFAULT 'all', _year integer DEFAULT extract(year FROM current_date)::integer,
  _viewer_id uuid DEFAULT auth.uid()
) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH base AS MATERIALIZED (
    SELECT f.id, f.date, f.glider, f.duration_minutes, f.altitude_gain, f.distance_km, f.group_id,
      CASE WHEN t.id IS NOT NULL THEN jsonb_build_object('name', t.name) END AS takeoff_location,
      CASE WHEN l.id IS NOT NULL THEN jsonb_build_object('name', l.name) END AS landing_location,
      EXISTS (SELECT 1 FROM public.igc_tracks it WHERE it.flight_id = f.id) AS has_track
    FROM public.flights f
    LEFT JOIN public.locations t ON t.id = f.takeoff_location_id
    LEFT JOIN public.locations l ON l.id = f.landing_location_id
    WHERE f.user_id = auth.uid() AND _viewer_id = auth.uid()
  ), filtered AS MATERIALIZED (
    SELECT * FROM base b WHERE
      (_group = 'all' OR (_group = 'none' AND b.group_id IS NULL) OR b.group_id::text = _group)
      AND (_filter = 'all' OR (_filter = 'track' AND b.has_track) OR (_filter = 'season' AND extract(year FROM b.date) = _year))
      AND (coalesce(_search, '') = '' OR
        position(lower(_search) IN lower(coalesce(b.glider, '') || ' ' || b.date::text || ' ' ||
          coalesce(b.takeoff_location->>'name', '') || ' ' || coalesce(b.landing_location->>'name', ''))) > 0)
  ), page AS (
    SELECT * FROM filtered ORDER BY date DESC, id DESC
    LIMIT greatest(1, least(coalesce(_limit, 40), 100)) OFFSET greatest(0, coalesce(_offset, 0))
  )
  SELECT jsonb_build_object(
    'rows', coalesce((SELECT jsonb_agg(to_jsonb(p) || jsonb_build_object('thumbnail',
      coalesce((SELECT it.track_thumbnail FROM public.igc_tracks it WHERE it.flight_id = p.id ORDER BY it.id LIMIT 1), '[]'::jsonb))
      ORDER BY p.date DESC, p.id DESC) FROM page p), '[]'::jsonb),
    'total', (SELECT count(*) FROM filtered),
    'counts', jsonb_build_object('all', (SELECT count(*) FROM base),
      'season', (SELECT count(*) FROM base WHERE extract(year FROM date) = _year),
      'track', (SELECT count(*) FROM base WHERE has_track))
  );
$$;
REVOKE ALL ON FUNCTION public.list_flights_page(integer, integer, text, text, text, integer, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_flights_page(integer, integer, text, text, text, integer, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.school_dashboard_data(_group_id uuid, _section text DEFAULT 'overview', _viewer_id uuid DEFAULT auth.uid())
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
DECLARE result jsonb; students jsonb := '[]'::jsonb; events jsonb := '[]'::jsonb;
BEGIN
  IF auth.uid() IS NULL OR _viewer_id IS DISTINCT FROM auth.uid() OR NOT public.is_group_staff(auth.uid(), _group_id) THEN
    RAISE EXCEPTION 'School staff access required' USING ERRCODE = '42501';
  END IF;
  -- Independent sections only need the caller's admin status; no student history is read.
  result := jsonb_build_object('isAdmin', public.is_group_admin(auth.uid(), _group_id));
  IF _section = 'overview' THEN
    WITH statuses AS (
      SELECT DISTINCT ON (student_id) student_id, status
      FROM public.student_status_history WHERE group_id = _group_id
      ORDER BY student_id, changed_at DESC, id DESC
    )
    SELECT result || jsonb_build_object(
      'studentCount', (SELECT count(*) FROM public.group_members m LEFT JOIN statuses s ON s.student_id = m.user_id
        WHERE m.group_id = _group_id AND m.role = 'member' AND coalesce(s.status, 'active') = 'active'),
      'nextEvent', (SELECT jsonb_build_object('id', id, 'title', title, 'event_date', event_date)
        FROM public.flight_events WHERE group_id = _group_id AND event_date >= now() AND status <> 'cancelled' ORDER BY event_date, id LIMIT 1),
      'openNotesCount', (SELECT count(*) FROM public.flight_events e WHERE e.group_id = _group_id
        AND e.event_date BETWEEN now() - interval '30 days' AND now()
        AND NOT EXISTS (SELECT 1 FROM public.student_day_notes n WHERE n.event_id = e.id))
    ) INTO result;
    SELECT result || jsonb_build_object(
      'openBilling', (SELECT coalesce(round(sum(amount)::numeric, 2), 0) FROM public.billing_items WHERE group_id = _group_id AND paid_at IS NULL),
      'licensedCount', (SELECT count(*) FROM (
        SELECT DISTINCT user_id, extract(year FROM changed_at) AS year FROM public.training_level_history
        WHERE group_id = _group_id AND lower(training_level) = 'licensed'
          AND changed_at >= date_trunc('year', now()) - interval '2 years'
          AND changed_at < date_trunc('year', now()) + interval '1 year'
      ) completions),
      'nextSignups', (SELECT count(*) FROM public.event_signups WHERE event_id = (result->'nextEvent'->>'id')::uuid AND signed_up)
    ) INTO result;
  ELSIF _section = 'students' THEN
    WITH statuses AS (
      SELECT DISTINCT ON (student_id) student_id, status, reason, changed_at
      FROM public.student_status_history WHERE group_id = _group_id
      ORDER BY student_id, changed_at DESC, id DESC
    ), flight_counts AS (
      SELECT user_id, count(*) AS n FROM public.flights WHERE group_id = _group_id GROUP BY user_id
    ), progress AS (
      SELECT p.user_id, count(*) AS n FROM public.training_progress p
      JOIN public.training_items i ON i.id = p.item_id AND i.is_exam_maneuver
      WHERE p.rating >= 3 GROUP BY p.user_id
    ), summaries AS (
      SELECT DISTINCT ON (n.student_user_id) n.student_user_id, n.note
      FROM public.student_day_notes n JOIN public.flight_events e ON e.id = n.event_id
      WHERE e.group_id = _group_id AND n.flight_number IS NULL AND btrim(n.note) <> ''
      ORDER BY n.student_user_id, e.event_date DESC, n.id DESC
    ), next_steps AS (
      SELECT DISTINCT ON (n.student_user_id) n.student_user_id, n.note
      FROM public.student_day_notes n JOIN public.flight_events e ON e.id = n.event_id
      WHERE e.group_id = _group_id AND n.flight_number IS NULL AND n.is_next_step AND btrim(n.note) <> ''
      ORDER BY n.student_user_id, e.event_date DESC, n.id DESC
    )
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'userId', m.user_id, 'pilotName', coalesce(p.pilot_name, ''), 'trainingLevel', p.training_level,
      'flightCount', coalesce(f.n, 0), 'examProgress', least(100, coalesce(round(100.0 * pr.n /
        nullif((SELECT count(*) FROM public.training_items WHERE is_exam_maneuver), 0)), 0)),
      'lastSummary', su.note, 'nextStep', ns.note, 'status', coalesce(s.status, 'active'),
      'statusReason', s.reason, 'statusUpdatedAt', s.changed_at
    ) ORDER BY p.pilot_name, m.user_id), '[]'::jsonb) INTO students
    FROM public.group_members m LEFT JOIN public.profiles p ON p.user_id = m.user_id
    LEFT JOIN statuses s ON s.student_id = m.user_id LEFT JOIN flight_counts f ON f.user_id = m.user_id
    LEFT JOIN progress pr ON pr.user_id = m.user_id LEFT JOIN summaries su ON su.student_user_id = m.user_id
    LEFT JOIN next_steps ns ON ns.student_user_id = m.user_id
    WHERE m.group_id = _group_id AND m.role = 'member';
    result := result || jsonb_build_object('students', students);
  ELSIF _section = 'days' THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'title', e.title, 'event_date', e.event_date, 'status', e.status,
      'participantCount', (SELECT count(*) FROM public.event_signups s WHERE s.event_id = e.id AND s.signed_up),
      'notesCount', (SELECT count(*) FROM public.student_day_notes n WHERE n.event_id = e.id))
      ORDER BY e.event_date DESC, e.id DESC), '[]'::jsonb) INTO events
    FROM public.flight_events e WHERE e.group_id = _group_id;
    result := result || jsonb_build_object('events', events);
  END IF;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.school_dashboard_data(uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_dashboard_data(uuid, text, uuid) TO authenticated;
