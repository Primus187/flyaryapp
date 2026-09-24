-- Read models for the two slowest screens. The database is ~120 ms away from Swiss users, and
-- Feed/Event detail needed 8-11 sequential requests. Both RPCs are SECURITY INVOKER, so every
-- row still passes the caller's RLS policies exactly as the previous direct table reads did.

-- Foreign-key / lookup indexes (Postgres does not create them automatically). group_members is
-- consulted by most RLS policies on every query.
CREATE INDEX IF NOT EXISTS idx_group_members_user ON public.group_members(user_id, group_id);
CREATE INDEX IF NOT EXISTS idx_group_member_functions_group_user ON public.group_member_functions(group_id, user_id);
CREATE INDEX IF NOT EXISTS idx_follows_follower ON public.follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_flights_feed ON public.flights(published_at DESC) WHERE published_to_feed;
CREATE INDEX IF NOT EXISTS idx_events_feed ON public.flight_events(group_id) WHERE published_to_feed;
CREATE INDEX IF NOT EXISTS idx_feed_achievements_created ON public.feed_achievements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feed_likes_flight ON public.feed_likes(flight_id);
CREATE INDEX IF NOT EXISTS idx_feed_likes_event ON public.feed_likes(event_id);
CREATE INDEX IF NOT EXISTS idx_feed_likes_achievement ON public.feed_likes(achievement_id);
CREATE INDEX IF NOT EXISTS idx_feed_comments_flight ON public.feed_comments(flight_id, created_at);
CREATE INDEX IF NOT EXISTS idx_feed_comments_event ON public.feed_comments(event_id, created_at);
CREATE INDEX IF NOT EXISTS idx_feed_comments_achievement ON public.feed_comments(achievement_id, created_at);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON public.bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_flight_photos_flight ON public.flight_photos(flight_id);
CREATE INDEX IF NOT EXISTS idx_flight_videos_flight ON public.flight_videos(flight_id);
CREATE INDEX IF NOT EXISTS idx_event_photos_event ON public.event_photos(event_id);
CREATE INDEX IF NOT EXISTS idx_challenge_goals_challenge ON public.challenge_goals(challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenge_progress_challenge_user ON public.challenge_progress(challenge_id, user_id);

-- ── Event detail ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.event_detail_data(_event_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
DECLARE ev jsonb; gid uuid;
BEGIN
  SELECT to_jsonb(e) || jsonb_build_object('groups', jsonb_build_object('name', g.name, 'group_type', g.group_type)), e.group_id
    INTO ev, gid
    FROM public.flight_events e LEFT JOIN public.groups g ON g.id = e.group_id
    WHERE e.id = _event_id;
  IF ev IS NULL THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'event', ev,
    'signups', coalesce((SELECT jsonb_agg(to_jsonb(s)) FROM public.event_signups s WHERE s.event_id = _event_id), '[]'::jsonb),
    'members', coalesce((SELECT jsonb_agg(jsonb_build_object('user_id', m.user_id, 'role', m.role))
      FROM public.group_members m WHERE m.group_id = gid), '[]'::jsonb),
    'myFunctions', coalesce((SELECT jsonb_agg(f.function) FROM public.group_member_functions f
      WHERE f.group_id = gid AND f.user_id = auth.uid()), '[]'::jsonb),
    'profiles', coalesce((SELECT jsonb_object_agg(p.user_id, p.pilot_name) FROM public.profiles p
      WHERE p.user_id IN (SELECT s.user_id FROM public.event_signups s WHERE s.event_id = _event_id
                          UNION SELECT m.user_id FROM public.group_members m WHERE m.group_id = gid)), '{}'::jsonb),
    'me', (SELECT jsonb_build_object('pilot_name', p.pilot_name, 'avatar_url', p.avatar_url)
      FROM public.profiles p WHERE p.user_id = auth.uid()),
    'briefingTasks', coalesce((SELECT jsonb_agg(to_jsonb(b) ORDER BY b.sort_order)
      FROM public.event_briefing_tasks b WHERE b.event_id = _event_id), '[]'::jsonb),
    'maneuverNames', coalesce((SELECT jsonb_agg(i.name) FROM public.event_maneuvers em
      JOIN public.training_items i ON i.id = em.training_item_id WHERE em.event_id = _event_id), '[]'::jsonb),
    'photos', coalesce((SELECT jsonb_agg(jsonb_build_object('id', ph.id, 'storage_path', ph.storage_path) ORDER BY ph.created_at)
      FROM public.event_photos ph WHERE ph.event_id = _event_id), '[]'::jsonb)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.event_detail_data(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.event_detail_data(uuid) TO authenticated;

-- ── Feed ─────────────────────────────────────────────────────────────────────
-- Likes, comments (with author name) and the caller's bookmark for one feed item.
CREATE OR REPLACE FUNCTION public.feed_social(_kind text, _id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
DECLARE likes jsonb; comments jsonb; bookmarked boolean;
BEGIN
  IF _kind = 'flight' THEN
    SELECT jsonb_agg(jsonb_build_object('user_id', l.user_id, 'reaction_type', coalesce(l.reaction_type, 'heart'))) INTO likes
      FROM public.feed_likes l WHERE l.flight_id = _id;
    SELECT jsonb_agg(jsonb_build_object('id', c.id, 'user_id', c.user_id, 'message', c.message, 'created_at', c.created_at,
        'pilot_name', coalesce(p.pilot_name, 'Pilot')) ORDER BY c.created_at) INTO comments
      FROM public.feed_comments c LEFT JOIN public.profiles p ON p.user_id = c.user_id WHERE c.flight_id = _id;
    bookmarked := EXISTS (SELECT 1 FROM public.bookmarks b WHERE b.user_id = auth.uid() AND b.flight_id = _id);
  ELSIF _kind = 'event' THEN
    SELECT jsonb_agg(jsonb_build_object('user_id', l.user_id, 'reaction_type', coalesce(l.reaction_type, 'heart'))) INTO likes
      FROM public.feed_likes l WHERE l.event_id = _id;
    SELECT jsonb_agg(jsonb_build_object('id', c.id, 'user_id', c.user_id, 'message', c.message, 'created_at', c.created_at,
        'pilot_name', coalesce(p.pilot_name, 'Pilot')) ORDER BY c.created_at) INTO comments
      FROM public.feed_comments c LEFT JOIN public.profiles p ON p.user_id = c.user_id WHERE c.event_id = _id;
    bookmarked := EXISTS (SELECT 1 FROM public.bookmarks b WHERE b.user_id = auth.uid() AND b.event_id = _id);
  ELSE
    SELECT jsonb_agg(jsonb_build_object('user_id', l.user_id, 'reaction_type', coalesce(l.reaction_type, 'heart'))) INTO likes
      FROM public.feed_likes l WHERE l.achievement_id = _id;
    SELECT jsonb_agg(jsonb_build_object('id', c.id, 'user_id', c.user_id, 'message', c.message, 'created_at', c.created_at,
        'pilot_name', coalesce(p.pilot_name, 'Pilot')) ORDER BY c.created_at) INTO comments
      FROM public.feed_comments c LEFT JOIN public.profiles p ON p.user_id = c.user_id WHERE c.achievement_id = _id;
    bookmarked := EXISTS (SELECT 1 FROM public.bookmarks b WHERE b.user_id = auth.uid() AND b.achievement_id = _id);
  END IF;
  RETURN jsonb_build_object('likes', coalesce(likes, '[]'::jsonb), 'comments', coalesce(comments, '[]'::jsonb), 'isBookmarked', bookmarked);
END;
$$;

CREATE OR REPLACE FUNCTION public.feed_flight_item(_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'id', f.id, 'date', f.date, 'created_at', f.created_at, 'published_at', f.published_at,
    'feedDescription', nullif(f.comments, ''), 'glider', f.glider, 'duration_minutes', f.duration_minutes,
    'altitude_gain', f.altitude_gain, 'distance_km', f.distance_km,
    'takeoff_name', t.name, 'landing_name', l.name, 'user_id', f.user_id,
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
    'takeoff', CASE WHEN t.latitude IS NOT NULL THEN jsonb_build_object('latitude', t.latitude, 'longitude', t.longitude, 'name', t.name) END,
    'landing', CASE WHEN l.latitude IS NOT NULL THEN jsonb_build_object('latitude', l.latitude, 'longitude', l.longitude, 'name', l.name) END,
    'tags', to_jsonb(f.tags)
  ) || public.feed_social('flight', f.id)
  FROM public.flights f
  LEFT JOIN public.locations t ON t.id = f.takeoff_location_id
  LEFT JOIN public.locations l ON l.id = f.landing_location_id
  LEFT JOIN public.profiles p ON p.user_id = f.user_id
  WHERE f.id = _id;
$$;

CREATE OR REPLACE FUNCTION public.feed_event_item(_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'id', e.id, 'title', e.title, 'description', e.description, 'feed_description', e.feed_description,
    'event_date', e.event_date, 'event_type', e.event_type, 'meeting_point', e.meeting_point,
    'max_participants', e.max_participants, 'status', e.status, 'group_name', coalesce(g.name, ''),
    'created_at', coalesce(e.created_at, e.event_date), 'published_at', e.published_at, 'created_by', e.created_by,
    'pilot_name', coalesce(p.pilot_name, 'Pilot'), 'avatar_path', p.avatar_url,
    'photoRows', coalesce((SELECT jsonb_agg(jsonb_build_object('id', ph.id, 'storage_path', ph.storage_path) ORDER BY ph.created_at)
      FROM public.event_photos ph WHERE ph.event_id = e.id), '[]'::jsonb),
    'signup_count', (SELECT count(*) FROM public.event_signups s WHERE s.event_id = e.id AND s.signed_up),
    'user_signed_up', EXISTS (SELECT 1 FROM public.event_signups s WHERE s.event_id = e.id AND s.signed_up AND s.user_id = auth.uid())
  ) || public.feed_social('event', e.id)
  FROM public.flight_events e
  LEFT JOIN public.groups g ON g.id = e.group_id
  LEFT JOIN public.profiles p ON p.user_id = e.created_by
  WHERE e.id = _id;
$$;

CREATE OR REPLACE FUNCTION public.feed_achievement_item(_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'id', a.id, 'user_id', a.user_id, 'challenge_id', a.challenge_id, 'goal_id', a.goal_id,
    'achievement_type', a.achievement_type, 'created_at', a.created_at,
    'pilot_name', coalesce(p.pilot_name, 'Pilot'), 'avatar_path', p.avatar_url,
    'challenge_title', c.title,
    'goal_label', (SELECT nullif(cg.label, '') FROM public.challenge_goals cg WHERE cg.id = a.goal_id),
    'group_name', coalesce(g.name, ''),
    'total_goals', (SELECT count(*) FROM public.challenge_goals cg WHERE cg.challenge_id = a.challenge_id),
    'completed_goals', (SELECT count(DISTINCT cp.goal_id) FROM public.challenge_progress cp
      WHERE cp.challenge_id = a.challenge_id AND cp.user_id = a.user_id)
  ) || public.feed_social('achievement', a.id)
  FROM public.feed_achievements a
  JOIN public.challenges c ON c.id = a.challenge_id
  LEFT JOIN public.groups g ON g.id = c.group_id
  LEFT JOIN public.profiles p ON p.user_id = a.user_id
  WHERE a.id = _id;
$$;

-- One merged, date-ordered feed page. Each source contributes at most _limit candidates newer
-- than the cursor, so the top _limit of their union is exact (no skipped items between pages).
CREATE OR REPLACE FUNCTION public.feed_page(_cursor timestamptz DEFAULT NULL, _limit integer DEFAULT 10)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH lim AS (SELECT greatest(1, least(coalesce(_limit, 10), 50)) AS n),
  my_groups AS (SELECT m.group_id FROM public.group_members m WHERE m.user_id = auth.uid()),
  followed AS (SELECT fo.following_id FROM public.follows fo WHERE fo.follower_id = auth.uid()),
  candidates AS (
    (SELECT 'flight'::text AS type, f.id, f.published_at AS date FROM public.flights f
      WHERE f.published_to_feed AND f.published_at IS NOT NULL
        AND (f.group_id IN (SELECT group_id FROM my_groups) OR f.user_id IN (SELECT following_id FROM followed))
        AND (_cursor IS NULL OR f.published_at < _cursor)
      ORDER BY f.published_at DESC LIMIT (SELECT n FROM lim))
    UNION ALL
    (SELECT 'event', e.id, coalesce(e.published_at, e.created_at, e.event_date) FROM public.flight_events e
      WHERE e.published_to_feed AND e.group_id IN (SELECT group_id FROM my_groups)
        AND (_cursor IS NULL OR coalesce(e.published_at, e.created_at, e.event_date) < _cursor)
      ORDER BY 3 DESC LIMIT (SELECT n FROM lim))
    UNION ALL
    (SELECT 'achievement', a.id, a.created_at FROM public.feed_achievements a
      JOIN public.challenges c ON c.id = a.challenge_id
      WHERE c.group_id IN (SELECT group_id FROM my_groups) AND (_cursor IS NULL OR a.created_at < _cursor)
      ORDER BY a.created_at DESC LIMIT (SELECT n FROM lim))
  ),
  page AS (SELECT * FROM candidates ORDER BY date DESC, id DESC LIMIT (SELECT n FROM lim)),
  built AS (
    SELECT p.type, p.date, p.id, CASE p.type
        WHEN 'flight' THEN public.feed_flight_item(p.id)
        WHEN 'event' THEN public.feed_event_item(p.id)
        ELSE public.feed_achievement_item(p.id) END AS data
    FROM page p
  )
  SELECT jsonb_build_object(
    'items', coalesce((SELECT jsonb_agg(jsonb_build_object('type', b.type, 'date', b.date, 'data', b.data) ORDER BY b.date DESC, b.id DESC)
      FROM built b WHERE b.data IS NOT NULL), '[]'::jsonb),
    'nextCursor', CASE WHEN (SELECT count(*) FROM page) >= (SELECT n FROM lim) THEN (SELECT min(date) FROM page) END,
    'groupIds', coalesce((SELECT jsonb_agg(group_id) FROM my_groups), '[]'::jsonb)
  );
$$;

-- Members of the caller's groups, for @mentions (loaded once, not on every feed page).
CREATE OR REPLACE FUNCTION public.feed_mention_members()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('user_id', p.user_id, 'pilot_name', coalesce(p.pilot_name, 'Pilot'))), '[]'::jsonb)
  FROM public.profiles p
  WHERE p.user_id IN (SELECT m2.user_id FROM public.group_members m1
    JOIN public.group_members m2 ON m2.group_id = m1.group_id WHERE m1.user_id = auth.uid());
$$;

REVOKE ALL ON FUNCTION public.feed_social(text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.feed_flight_item(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.feed_event_item(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.feed_achievement_item(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.feed_page(timestamptz, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.feed_mention_members() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.feed_social(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.feed_flight_item(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.feed_event_item(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.feed_achievement_item(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.feed_page(timestamptz, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.feed_mention_members() TO authenticated;

NOTIFY pgrst, 'reload schema';
