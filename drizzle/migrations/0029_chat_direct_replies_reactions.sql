-- Chat stage 3: direct messages, replies, reactions, search.
--   Direct messages: 1:1 channels between two people who share at least one group
--     (chat_open_direct creates or reuses the channel; direct_key keeps it unique per pair).
--   Replies: chat_messages.reply_to (same channel only).
--   Reactions: chat_message_reactions, one row per person, message and emoji.
--   Search: chat_search over every message the caller can read.
--   Push: a direct message counts like a mention (level 'mentions' → every message, bundled);
--   bundled pushes restart as soon as the person has read the channel since the last push.

-- ── Direct messages ─────────────────────────────────────────────────────────
ALTER TABLE public.chat_channels ADD COLUMN IF NOT EXISTS direct_key text;
CREATE UNIQUE INDEX IF NOT EXISTS chat_channels_direct_key ON public.chat_channels(direct_key) WHERE direct_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.chat_shares_group(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.group_members a JOIN public.group_members b ON b.group_id = a.group_id
    WHERE a.user_id = _a AND b.user_id = _b)
    AND auth.uid() IN (_a, _b);  -- only about oneself: no probing who shares groups with whom
$$;

-- Opens (creates if needed) the direct channel between the caller and _other.
CREATE OR REPLACE FUNCTION public.chat_open_direct(_other uuid)
RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _me uuid := auth.uid();
  _key text;
  _id uuid;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501'; END IF;
  IF _other IS NULL OR _other = _me THEN RAISE EXCEPTION 'invalid person' USING ERRCODE = '22023'; END IF;
  _key := least(_me::text, _other::text) || ':' || greatest(_me::text, _other::text);
  SELECT id INTO _id FROM public.chat_channels WHERE direct_key = _key;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF NOT public.chat_shares_group(_me, _other) THEN
    RAISE EXCEPTION 'direct messages need a shared group' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.chat_channels (kind, direct_key, created_by) VALUES ('direct', _key, _me)
  ON CONFLICT (direct_key) WHERE direct_key IS NOT NULL DO NOTHING
  RETURNING id INTO _id;
  IF _id IS NULL THEN  -- created concurrently
    SELECT id INTO _id FROM public.chat_channels WHERE direct_key = _key;
    RETURN _id;
  END IF;
  INSERT INTO public.chat_channel_members (channel_id, user_id, added_by) VALUES (_id, _me, _me), (_id, _other, _me);
  RETURN _id;
END;
$$;
REVOKE ALL ON FUNCTION public.chat_open_direct(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_open_direct(uuid), public.chat_shares_group(uuid, uuid) TO authenticated;

-- People the caller can write to: everyone sharing a group, with the shared group names.
CREATE OR REPLACE FUNCTION public.chat_direct_candidates()
RETURNS TABLE (user_id uuid, pilot_name text, groups text[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT b.user_id, coalesce(p.pilot_name, ''), array_agg(DISTINCT g.name ORDER BY g.name)
  FROM public.group_members a
  JOIN public.group_members b ON b.group_id = a.group_id AND b.user_id <> a.user_id
  JOIN public.groups g ON g.id = a.group_id
  LEFT JOIN public.profiles p ON p.user_id = b.user_id
  WHERE a.user_id = auth.uid()
  GROUP BY b.user_id, p.pilot_name
  ORDER BY lower(coalesce(p.pilot_name, ''));
$$;
REVOKE ALL ON FUNCTION public.chat_direct_candidates() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_direct_candidates() TO authenticated;

-- ── Replies ─────────────────────────────────────────────────────────────────
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS reply_to uuid REFERENCES public.chat_messages(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.chat_message_in_channel(_message uuid, _channel uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.chat_messages WHERE id = _message AND channel_id = _channel);
$$;
REVOKE ALL ON FUNCTION public.chat_message_in_channel(uuid, uuid), public.chat_shares_group(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_message_in_channel(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "Post where allowed" ON public.chat_messages;
CREATE POLICY "Post where allowed" ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.chat_can_post(auth.uid(), channel_id)
    AND ((NOT is_announcement AND NOT requires_confirmation) OR public.chat_can_manage(auth.uid(), channel_id))
    AND (reply_to IS NULL OR public.chat_message_in_channel(reply_to, channel_id)));

-- ── Reactions ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chat_message_reactions (
  message_id uuid NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL CHECK (char_length(emoji) BETWEEN 1 AND 16),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id, emoji)
);
ALTER TABLE public.chat_message_reactions ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON public.chat_message_reactions TO authenticated;

DROP POLICY IF EXISTS "Read reactions of accessible messages" ON public.chat_message_reactions;
CREATE POLICY "Read reactions of accessible messages" ON public.chat_message_reactions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.chat_messages m WHERE m.id = message_id AND public.chat_can_read(auth.uid(), m.channel_id)));
DROP POLICY IF EXISTS "React to readable messages" ON public.chat_message_reactions;
CREATE POLICY "React to readable messages" ON public.chat_message_reactions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.chat_messages m
    WHERE m.id = message_id AND public.chat_can_read(auth.uid(), m.channel_id)));
DROP POLICY IF EXISTS "Remove own reactions" ON public.chat_message_reactions;
CREATE POLICY "Remove own reactions" ON public.chat_message_reactions FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ── Search ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.chat_search(_q text, _limit int DEFAULT 30)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(x.row ORDER BY x.created_at DESC), '[]'::jsonb)
  FROM (
    SELECT m.created_at, jsonb_build_object('id', m.id, 'channel_id', m.channel_id, 'message', m.message,
        'created_at', m.created_at, 'author', coalesce(p.pilot_name, ''),
        'channel', CASE c.kind WHEN 'event' THEN e.title WHEN 'direct' THEN coalesce(peer.pilot_name, '') ELSE c.name END,
        'kind', c.kind, 'group_name', g.name) AS row
    FROM public.chat_messages m
    JOIN public.chat_channels c ON c.id = m.channel_id
    LEFT JOIN public.groups g ON g.id = c.group_id
    LEFT JOIN public.flight_events e ON e.id = c.event_id
    LEFT JOIN public.profiles p ON p.user_id = m.user_id
    LEFT JOIN LATERAL (SELECT pp.pilot_name FROM public.chat_channel_members cm
      LEFT JOIN public.profiles pp ON pp.user_id = cm.user_id
      WHERE c.kind = 'direct' AND cm.channel_id = c.id AND cm.user_id <> auth.uid() LIMIT 1) peer ON true
    WHERE char_length(btrim(_q)) >= 2
      AND m.message ILIKE '%' || replace(replace(replace(btrim(_q), '\', '\\'), '%', '\%'), '_', '\_') || '%'
    ORDER BY m.created_at DESC
    LIMIT least(greatest(_limit, 1), 100)
  ) x;
$$;
REVOKE ALL ON FUNCTION public.chat_search(text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_search(text, int) TO authenticated;

-- ── Channel JSON: direct peer ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.chat_channel_json(_channel uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT jsonb_build_object(
      'id', c.id, 'kind', c.kind, 'name', c.name, 'description', c.description, 'group_id', c.group_id,
      'group_name', g.name, 'group_type', g.group_type::text, 'event_id', c.event_id, 'event_title', e.title,
      'event_date', e.event_date, 'audience', c.audience, 'audience_levels', to_jsonb(c.audience_levels),
      'staff_only_posting', c.staff_only_posting, 'is_default', c.is_default, 'archived_at', c.archived_at,
      'created_at', c.created_at, 'last_message_at', c.last_message_at,
      'can_manage', public.chat_can_manage(auth.uid(), c.id), 'can_post', public.chat_can_post(auth.uid(), c.id),
      'notify_level', coalesce((SELECT rs.notify_level FROM public.chat_read_state rs WHERE rs.channel_id = c.id AND rs.user_id = auth.uid()), 'mentions'),
      'peer', CASE WHEN c.kind = 'direct' THEN (SELECT jsonb_build_object('user_id', cm.user_id, 'pilot_name', coalesce(pp.pilot_name, ''))
          FROM public.chat_channel_members cm LEFT JOIN public.profiles pp ON pp.user_id = cm.user_id
          WHERE cm.channel_id = c.id AND cm.user_id <> auth.uid() LIMIT 1) END,
      'last_message', (SELECT jsonb_build_object('message', lm.message, 'has_attachment', lm.attachment_path IS NOT NULL,
          'is_announcement', lm.is_announcement, 'created_at', lm.created_at, 'user_id', lm.user_id,
          'author', coalesce(p.pilot_name, ''))
        FROM public.chat_messages lm LEFT JOIN public.profiles p ON p.user_id = lm.user_id
        WHERE lm.channel_id = c.id ORDER BY lm.created_at DESC LIMIT 1),
      'unread', (SELECT count(*) FROM public.chat_messages um
        WHERE um.channel_id = c.id AND um.user_id <> auth.uid()
          AND um.created_at > coalesce(
            (SELECT rs.last_read_at FROM public.chat_read_state rs WHERE rs.channel_id = c.id AND rs.user_id = auth.uid()),
            (SELECT gm.joined_at FROM public.group_members gm WHERE gm.group_id = c.group_id AND gm.user_id = auth.uid()),
            c.created_at)))
  FROM public.chat_channels c
  LEFT JOIN public.groups g ON g.id = c.group_id
  LEFT JOIN public.flight_events e ON e.id = c.event_id
  WHERE c.id = _channel;
$$;

-- Direct channels without any message stay out of the inbox (opening a chat and leaving it empty).
CREATE OR REPLACE FUNCTION public.chat_inbox()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(public.chat_channel_json(c.id) ORDER BY coalesce(c.last_message_at, c.created_at) DESC), '[]'::jsonb)
  FROM public.chat_channels c
  LEFT JOIN public.flight_events e ON e.id = c.event_id
  WHERE (c.kind = 'group')
     OR (c.kind = 'direct' AND c.last_message_at IS NOT NULL)
     OR (c.kind = 'event' AND (e.event_date >= now() - interval '14 days' OR c.last_message_at >= now() - interval '14 days'));
$$;

-- ── Notifications: direct messages, read-aware bundling ─────────────────────
CREATE OR REPLACE FUNCTION public.chat_notify_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _c public.chat_channels%ROWTYPE;
  _title text;
  _author text;
  _body text;
  _r record;
  _level text;
  _mentioned boolean;
BEGIN
  SELECT * INTO _c FROM public.chat_channels WHERE id = NEW.channel_id;
  SELECT coalesce(_c.name, e.title, 'Chat') INTO _title FROM (SELECT 1) x LEFT JOIN public.flight_events e ON e.id = _c.event_id;
  SELECT coalesce(nullif(p.pilot_name, ''), 'Jemand') INTO _author FROM public.profiles p WHERE p.user_id = NEW.user_id;
  _author := coalesce(_author, 'Jemand');
  _body := _author || ': ' || left(coalesce(nullif(NEW.message, ''), '📎'), 120);
  IF _c.kind = 'direct' THEN
    _title := _author;
    _body := left(coalesce(nullif(NEW.message, ''), '📎'), 140);
  END IF;

  FOR _r IN
    SELECT u.user_id, rs.notify_level, rs.last_read_at, ps.last_pushed_at
    FROM (SELECT gm.user_id FROM public.group_members gm WHERE gm.group_id = _c.group_id
          UNION SELECT m.user_id FROM public.chat_channel_members m WHERE m.channel_id = NEW.channel_id) u
    LEFT JOIN public.chat_read_state rs ON rs.channel_id = NEW.channel_id AND rs.user_id = u.user_id
    LEFT JOIN public.chat_push_state ps ON ps.channel_id = NEW.channel_id AND ps.user_id = u.user_id
    WHERE u.user_id <> NEW.user_id AND public.chat_can_read(u.user_id, NEW.channel_id)
  LOOP
    _level := coalesce(_r.notify_level, 'mentions');
    IF _c.kind = 'direct' AND _level = 'mentions' THEN _level := 'all'; END IF;
    _mentioned := _r.user_id = ANY (NEW.mentions) AND _c.kind <> 'direct';

    IF _mentioned THEN
      INSERT INTO public.notifications (user_id, actor_id, type, reference_id, reference_type)
      VALUES (_r.user_id, NEW.user_id, 'chat_mention', NEW.channel_id, 'chat');
    END IF;

    IF NEW.is_announcement THEN
      PERFORM public.send_push_notification(_r.user_id, 'Ankündigung: ' || _title, _body, '/messages/' || NEW.channel_id);
    ELSIF _mentioned AND _level <> 'none' THEN
      PERFORM public.send_push_notification(_r.user_id, _author || ' hat dich erwähnt · ' || _title, left(coalesce(NEW.message, ''), 140), '/messages/' || NEW.channel_id);
    ELSIF _level = 'all' AND (_r.last_pushed_at IS NULL OR _r.last_pushed_at < now() - interval '5 minutes'
                              OR _r.last_read_at >= _r.last_pushed_at) THEN
      PERFORM public.send_push_notification(_r.user_id, _title, _body, '/messages/' || NEW.channel_id);
      INSERT INTO public.chat_push_state (channel_id, user_id, last_pushed_at) VALUES (NEW.channel_id, _r.user_id, now())
      ON CONFLICT (channel_id, user_id) DO UPDATE SET last_pushed_at = now();
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

-- ── Realtime ────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'chat_message_reactions') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_message_reactions;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
