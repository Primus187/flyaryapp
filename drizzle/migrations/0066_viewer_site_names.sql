-- Stage B (decision 2026-09-28): reads that show places of other people use the viewer's name for
-- a site (public.display_name, migration 0065). The SHV training proof is an official document and
-- shows official names; it counts flying sites per official site, so two places of the school at the
-- same site count once. The function bodies are otherwise unchanged (taken from the live database).

CREATE OR REPLACE FUNCTION public.feed_flight_item(_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'id', f.id, 'date', f.date, 'created_at', f.created_at, 'published_at', f.published_at,
    'feedDescription', nullif(f.comments, ''), 'glider', f.glider, 'duration_minutes', f.duration_minutes,
    'altitude_gain', f.altitude_gain, 'distance_km', f.distance_km,
    'takeoff_name', public.display_name(t), 'landing_name', public.display_name(l), 'user_id', f.user_id,
    'pilot_name', coalesce(p.pilot_name, 'Pilot'), 'avatar_path', p.avatar_url,
    -- Group name only for the caller's own groups (followed pilots' flights show none).
    'group_name', coalesce((SELECT g.name FROM public.group_members m JOIN public.groups g ON g.id = m.group_id
      WHERE m.user_id = auth.uid() AND g.id = f.group_id), ''),
    'photoPaths', coalesce((SELECT jsonb_agg(ph.storage_path ORDER BY ph.created_at) FROM public.flight_photos ph
      WHERE ph.flight_id = f.id AND (jsonb_typeof(f.feed_photo_ids) IS DISTINCT FROM 'array' OR f.feed_photo_ids ? ph.id::text)), '[]'::jsonb),
    'videoUrls', coalesce((SELECT jsonb_agg(v.youtube_url) FROM public.flight_videos v
      WHERE v.flight_id = f.id AND v.youtube_url IS NOT NULL), '[]'::jsonb),
    'uploadedVideoPaths', coalesce((SELECT jsonb_agg(jsonb_build_object('video', v.storage_path, 'poster', v.poster_path))
      FROM public.flight_videos v WHERE v.flight_id = f.id AND v.youtube_url IS NULL AND v.storage_path IS NOT NULL), '[]'::jsonb),
    'hasTrack', EXISTS (SELECT 1 FROM public.igc_tracks it WHERE it.flight_id = f.id),
    'takeoff', CASE WHEN t.latitude IS NOT NULL THEN jsonb_build_object('latitude', t.latitude, 'longitude', t.longitude, 'name', public.display_name(t)) END,
    'landing', CASE WHEN l.latitude IS NOT NULL THEN jsonb_build_object('latitude', l.latitude, 'longitude', l.longitude, 'name', public.display_name(l)) END,
    'tags', to_jsonb(f.tags)
  ) || public.feed_social('flight', f.id)
  FROM public.flights f
  LEFT JOIN public.locations t ON t.id = f.takeoff_location_id
  LEFT JOIN public.locations l ON l.id = f.landing_location_id
  LEFT JOIN public.profiles p ON p.user_id = f.user_id
  WHERE f.id = _id;
$function$;

CREATE OR REPLACE FUNCTION public.list_flights_page(_offset integer DEFAULT 0, _limit integer DEFAULT 40, _search text DEFAULT ''::text, _group text DEFAULT 'all'::text, _filter text DEFAULT 'all'::text, _year integer DEFAULT (EXTRACT(year FROM CURRENT_DATE))::integer, _viewer_id uuid DEFAULT auth.uid())
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  WITH base AS MATERIALIZED (
    SELECT f.id, f.date, f.glider, f.duration_minutes, f.altitude_gain, f.distance_km, f.group_id,
      CASE WHEN t.id IS NOT NULL THEN jsonb_build_object('name', public.display_name(t)) END AS takeoff_location,
      CASE WHEN l.id IS NOT NULL THEN jsonb_build_object('name', public.display_name(l)) END AS landing_location,
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
$function$;

CREATE OR REPLACE FUNCTION public.my_school_flight_imports()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(jsonb_agg(day ORDER BY day->>'date' DESC), '[]'::jsonb) FROM (
    SELECT jsonb_build_object(
      'eventId', e.id,
      'title', e.title,
      'date', (e.event_date AT TIME ZONE 'Europe/Zurich')::date,
      'groupId', e.group_id,
      'flights', (
        SELECT jsonb_agg(jsonb_build_object(
          'id', f.id, 'number', f.number, 'startedAt', f.started_at, 'landedAt', f.landed_at,
          'takeoff', public.display_name(lt), 'landing', public.display_name(ll)) ORDER BY f.number)
        FROM (SELECT sf.*, row_number() OVER (ORDER BY sf.seq) AS number FROM public.event_school_flights sf
              WHERE sf.event_id = e.id AND sf.student_user_id = auth.uid() AND sf.status = 'landed') f
        LEFT JOIN public.locations lt ON lt.id = f.takeoff_location_id
        LEFT JOIN public.locations ll ON ll.id = f.landing_location_id
        WHERE f.logbook_flight_id IS NULL),
      'candidates', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('id', fl.id, 'createdAt', fl.created_at, 'durationMinutes', fl.duration_minutes,
                                            'takeoff', public.display_name(lt)) ORDER BY fl.created_at)
        FROM public.flights fl LEFT JOIN public.locations lt ON lt.id = fl.takeoff_location_id
        WHERE fl.user_id = auth.uid() AND fl.school_flight_id IS NULL
          AND (fl.event_id = e.id OR (fl.group_id = e.group_id AND fl.date = (e.event_date AT TIME ZONE 'Europe/Zurich')::date))), '[]'::jsonb)
    ) AS day
    FROM public.flight_events e
    JOIN public.event_signups s ON s.event_id = e.id AND s.user_id = auth.uid()
    WHERE s.logbook_import_dismissed_at IS NULL
      AND e.event_date >= timestamptz '2026-09-25 00:00 Europe/Zurich'
      AND public.flight_day_feedback_released(e.id)
      AND EXISTS (SELECT 1 FROM public.event_school_flights sf WHERE sf.event_id = e.id AND sf.student_user_id = auth.uid()
                  AND sf.status = 'landed' AND sf.logbook_flight_id IS NULL)
  ) days
$function$;

CREATE OR REPLACE FUNCTION public.my_school_flights(_event_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', f.id,
      'number', f.number,
      'startedAt', f.started_at,
      'landedAt', f.landed_at,
      'takeoff', public.display_name(lt),
      'landing', public.display_name(ll),
      'feedback', n.feedback,
      'items', COALESCE((SELECT jsonb_agg(jsonb_build_object('name', ti.name, 'rating', i.rating) ORDER BY ti.sort_order, ti.name)
                         FROM public.event_school_flight_items i JOIN public.training_items ti ON ti.id = i.training_item_id
                         WHERE i.flight_id = f.id), '[]'::jsonb)
    ) ORDER BY f.number), '[]'::jsonb)
  FROM (
    SELECT sf.*, row_number() OVER (ORDER BY sf.seq) AS number
    FROM public.event_school_flights sf
    WHERE sf.event_id = _event_id AND sf.student_user_id = auth.uid() AND sf.status = 'landed'
  ) f
  LEFT JOIN public.event_school_flight_notes n ON n.flight_id = f.id
  LEFT JOIN public.locations lt ON lt.id = f.takeoff_location_id
  LEFT JOIN public.locations ll ON ll.id = f.landing_location_id
  WHERE public.flight_day_feedback_released(_event_id)
$function$;

CREATE OR REPLACE FUNCTION public.school_student_dossier(_group_id uuid, _student_id uuid, _section text DEFAULT 'overview'::text, _offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE result jsonb; rows jsonb; total bigint;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_group_staff(auth.uid(), _group_id)
    OR NOT EXISTS (SELECT 1 FROM public.groups WHERE id = _group_id AND group_type = 'school')
    OR NOT EXISTS (SELECT 1 FROM public.group_members WHERE group_id = _group_id AND user_id = _student_id AND role = 'member') THEN
    RAISE EXCEPTION 'School student access required' USING ERRCODE = '42501';
  END IF;
  IF _offset IS NULL OR _offset < 0 THEN RAISE EXCEPTION 'Invalid offset'; END IF;

  IF _section = 'overview' THEN
    result := public.school_student_training_profile(_group_id, _student_id);
    IF result IS NULL THEN RAISE EXCEPTION 'Student profile unavailable'; END IF;
    RETURN result || jsonb_build_object(
      'flightCount', (SELECT count(*) FROM public.flights WHERE user_id = _student_id AND group_id = _group_id),
      'lastFlight', (SELECT max(date) FROM public.flights WHERE user_id = _student_id AND group_id = _group_id),
      'examTotal', (SELECT count(*) FROM public.training_items WHERE is_exam_maneuver),
      'examDone', (SELECT count(*) FROM public.training_progress p JOIN public.training_items i ON i.id = p.item_id WHERE p.user_id = _student_id AND p.rating >= 3 AND i.is_exam_maneuver),
      'status', coalesce((SELECT jsonb_build_object('status', status, 'reason', reason, 'date', changed_at) FROM public.student_status_history WHERE group_id = _group_id AND student_id = _student_id ORDER BY changed_at DESC, id DESC LIMIT 1), '{"status":"active","reason":null,"date":null}'::jsonb),
      'nextStep', (SELECT jsonb_build_object('note', n.note, 'eventId', e.id, 'date', e.event_date) FROM public.student_day_notes n JOIN public.flight_events e ON e.id = n.event_id WHERE e.group_id = _group_id AND n.student_user_id = _student_id AND n.is_next_step AND btrim(n.note) <> '' ORDER BY e.event_date DESC, n.id DESC LIMIT 1),
      'upcoming', (SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM (SELECT e.id, e.title, e.event_date, s.status FROM public.event_signups s JOIN public.flight_events e ON e.id = s.event_id WHERE s.user_id = _student_id AND s.signed_up AND e.group_id = _group_id AND e.event_date >= now() AND e.status <> 'cancelled' ORDER BY e.event_date, e.id LIMIT 5) x)
    );
  ELSIF _section = 'training' THEN
    SELECT coalesce(jsonb_agg(x ORDER BY x.category_order, x.sort_order, x.id), '[]'::jsonb) INTO rows FROM (
      SELECT i.id, i.name, c.name AS category, c.sort_order AS category_order, i.sort_order,
        c.training_level, i.is_exam_maneuver, coalesce(p.rating, 0) AS rating, p.notes, p.updated_at
      FROM public.training_items i JOIN public.training_categories c ON c.id = i.category_id
      LEFT JOIN public.training_progress p ON p.item_id = i.id AND p.user_id = _student_id
    ) x;
    RETURN jsonb_build_object('rows', rows);
  ELSIF _section = 'flights' THEN
    SELECT count(*) INTO total FROM public.flights WHERE group_id = _group_id AND user_id = _student_id;
    SELECT coalesce(jsonb_agg(x ORDER BY x.date DESC, x.id DESC), '[]'::jsonb) INTO rows FROM (
      SELECT f.id, f.date, f.glider, f.duration_minutes, f.altitude_gain, f.comments,
        public.display_name(l) AS takeoff, public.display_name(d) AS landing,
        (SELECT coalesce(jsonb_agg(jsonb_build_object('id', n.id, 'note', n.note, 'author', p.pilot_name, 'visible', n.visible_to_student, 'date', n.updated_at) ORDER BY n.created_at, n.id), '[]'::jsonb)
         FROM public.flight_coach_notes n LEFT JOIN public.profiles p ON p.user_id = n.coach_id WHERE n.flight_id = f.id) AS notes
      FROM public.flights f LEFT JOIN public.locations l ON l.id = f.takeoff_location_id LEFT JOIN public.locations d ON d.id = f.landing_location_id
      WHERE f.group_id = _group_id AND f.user_id = _student_id ORDER BY f.date DESC, f.id DESC LIMIT 30 OFFSET _offset
    ) x;
  ELSIF _section = 'notes' THEN
    SELECT count(*) INTO total FROM public.student_day_notes n JOIN public.flight_events e ON e.id = n.event_id WHERE e.group_id = _group_id AND n.student_user_id = _student_id;
    SELECT coalesce(jsonb_agg(x ORDER BY x.event_date DESC, x.id DESC), '[]'::jsonb) INTO rows FROM (
      SELECT n.id, n.note, n.flight_number, n.visible_to_student AS visible, n.is_next_step,
        p.pilot_name AS author, e.id AS event_id, e.title, e.event_date
      FROM public.student_day_notes n JOIN public.flight_events e ON e.id = n.event_id LEFT JOIN public.profiles p ON p.user_id = n.instructor_id
      WHERE e.group_id = _group_id AND n.student_user_id = _student_id ORDER BY e.event_date DESC, n.id DESC LIMIT 30 OFFSET _offset
    ) x;
  ELSIF _section = 'equipment' THEN
    RETURN jsonb_build_object(
      'loans', (SELECT coalesce(jsonb_agg(x ORDER BY x.returned_on NULLS FIRST, x.assigned_on DESC, x.id), '[]'::jsonb) FROM (
        SELECT a.id, a.assigned_on, a.due_on, a.returned_on, a.note, e.name, e.equipment_type, e.inventory_number, e.size, e.next_check_date
        FROM public.equipment_assignments a JOIN public.school_equipment e ON e.id = a.equipment_id AND e.group_id = _group_id
        WHERE a.group_id = _group_id AND a.user_id = _student_id) x),
      'own', (SELECT coalesce(jsonb_agg(x ORDER BY x.is_default DESC, x.manufacturer, x.id), '[]'::jsonb) FROM (
        SELECT id, manufacturer, model, size, is_default, last_check_date, next_check_date, reserve_repack_date
        FROM public.pilot_gliders WHERE user_id = _student_id) x)
    );
  ELSIF _section = 'billing' THEN
    SELECT jsonb_build_object('open', coalesce(sum(amount) FILTER (WHERE paid_at IS NULL), 0), 'paid', coalesce(sum(amount) FILTER (WHERE paid_at IS NOT NULL), 0)), count(*) INTO result, total
      FROM public.billing_items WHERE group_id = _group_id AND user_id = _student_id;
    SELECT coalesce(jsonb_agg(x ORDER BY x.billing_date DESC, x.id DESC), '[]'::jsonb) INTO rows FROM (
      SELECT id, description, item_type, quantity, unit_amount, amount, billing_date, paid_at, note
      FROM public.billing_items WHERE group_id = _group_id AND user_id = _student_id ORDER BY billing_date DESC, id DESC LIMIT 30 OFFSET _offset
    ) x;
    RETURN result || jsonb_build_object('rows', rows, 'total', total);
  ELSE
    RAISE EXCEPTION 'Unknown dossier section';
  END IF;
  RETURN jsonb_build_object('rows', rows, 'total', total);
END;
$function$;

CREATE OR REPLACE FUNCTION public.school_student_proof(_group_id uuid, _student_id uuid, _from date DEFAULT NULL::date, _to date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_group_staff(auth.uid(), _group_id)
     OR NOT EXISTS (SELECT 1 FROM public.group_members WHERE group_id = _group_id AND user_id = _student_id) THEN
    RAISE EXCEPTION 'School student access required' USING ERRCODE = '42501';
  END IF;
  RETURN (
    WITH f AS (
      SELECT sf.seq, (e.event_date AT TIME ZONE 'Europe/Zurich')::date AS day, e.title, e.event_category,
             COALESCE(lt.official_site_id, sf.takeoff_location_id) AS site_key,
             public.official_name(lt) AS takeoff, public.official_name(ll) AS landing, p.pilot_name AS instructor
      FROM public.event_school_flights sf
      JOIN public.flight_events e ON e.id = sf.event_id
      LEFT JOIN public.locations lt ON lt.id = sf.takeoff_location_id
      LEFT JOIN public.locations ll ON ll.id = sf.landing_location_id
      LEFT JOIN public.profiles p ON p.user_id = COALESCE(sf.landed_by, sf.created_by)
      WHERE sf.group_id = _group_id AND sf.student_user_id = _student_id AND sf.status = 'landed'
        AND (_from IS NULL OR (e.event_date AT TIME ZONE 'Europe/Zurich')::date >= _from)
        AND (_to IS NULL OR (e.event_date AT TIME ZONE 'Europe/Zurich')::date <= _to)
    )
    SELECT jsonb_build_object(
      'school', (SELECT name FROM public.groups WHERE id = _group_id),
      'student', (SELECT jsonb_build_object('name', pilot_name, 'shvNumber', shv_number) FROM public.profiles WHERE user_id = _student_id),
      'from', min(day), 'to', max(day),
      'total', count(*),
      'practice', count(*) FILTER (WHERE event_category = 'basic_course'),
      'altitude', count(*) FILTER (WHERE event_category IS DISTINCT FROM 'basic_course'),
      'sites', count(DISTINCT site_key),
      'days', count(DISTINCT day),
      'selfLogged', (SELECT count(*) FROM public.flights WHERE user_id = _student_id AND group_id = _group_id),
      'flights', COALESCE(jsonb_agg(jsonb_build_object(
        'date', day, 'event', title, 'category', event_category, 'takeoff', takeoff, 'landing', landing, 'instructor', instructor)
        ORDER BY day, seq), '[]'::jsonb))
    FROM f);
END;
$function$;
