-- Chat channels (stage 1): one model for group channels, event channels and (later) direct
-- messages. Replaces the fixed group chat (group_messages + is_team_only) and the event chat
-- (event_messages); their content is copied over, the old tables stay read-only for now.
--
-- Access is computed from the channel's audience at read time (no member lists to maintain):
--   group channel: 'all' members | 'team' (admin, school lead, instructor, launch helper)
--                  | 'students' (optionally only some training levels) | 'custom' (listed people)
--                  School staff (admin, school lead, instructor) see and manage every channel of
--                  their group; explicitly listed people are added on top of any audience.
--   event channel: signed-up pilots + the group's team + the event's staff.
--   direct:        exactly the listed members (stage 3).

-- ── Tables ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chat_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('group', 'event', 'direct')),
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE,
  event_id uuid UNIQUE REFERENCES public.flight_events(id) ON DELETE CASCADE,
  name text,
  description text,
  audience text NOT NULL DEFAULT 'all' CHECK (audience IN ('all', 'team', 'students', 'custom')),
  audience_levels text[],
  staff_only_posting boolean NOT NULL DEFAULT false,
  is_default boolean NOT NULL DEFAULT false,
  archived_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz,
  CONSTRAINT chat_channels_kind_shape CHECK (
    (kind = 'group' AND group_id IS NOT NULL AND event_id IS NULL AND name IS NOT NULL AND btrim(name) <> '')
    OR (kind = 'event' AND group_id IS NOT NULL AND event_id IS NOT NULL)
    OR (kind = 'direct' AND group_id IS NULL AND event_id IS NULL))
);
CREATE INDEX IF NOT EXISTS idx_chat_channels_group ON public.chat_channels(group_id);

CREATE TABLE IF NOT EXISTS public.chat_channel_members (
  channel_id uuid NOT NULL REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  added_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (channel_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_chat_channel_members_user ON public.chat_channel_members(user_id);

-- Per person and channel: read position and notification preference (stage 2 uses notify_level).
CREATE TABLE IF NOT EXISTS public.chat_read_state (
  channel_id uuid NOT NULL REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  notify_level text NOT NULL DEFAULT 'mentions' CHECK (notify_level IN ('all', 'mentions', 'none')),
  PRIMARY KEY (channel_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text NOT NULL DEFAULT '',
  attachment_path text,
  is_announcement boolean NOT NULL DEFAULT false,
  requires_confirmation boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_channel_created ON public.chat_messages(channel_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.chat_message_receipts (
  message_id uuid NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);

-- ── Access functions ────────────────────────────────────────────────────────
-- A "student" is a plain member with the student function, or a plain member without any
-- function (same rule as the event page).
CREATE OR REPLACE FUNCTION public.chat_is_student(_uid uuid, _group uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.group_members m WHERE m.group_id = _group AND m.user_id = _uid AND m.role = 'member')
    AND (EXISTS (SELECT 1 FROM public.group_member_functions f WHERE f.group_id = _group AND f.user_id = _uid AND f.function = 'student')
      OR NOT EXISTS (SELECT 1 FROM public.group_member_functions f WHERE f.group_id = _group AND f.user_id = _uid));
$$;

CREATE OR REPLACE FUNCTION public.chat_can_read(_uid uuid, _channel uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.chat_channels%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN RETURN false; END IF;
  SELECT * INTO c FROM public.chat_channels WHERE id = _channel;
  IF NOT FOUND THEN RETURN false; END IF;
  IF c.kind = 'direct' THEN
    RETURN EXISTS (SELECT 1 FROM public.chat_channel_members m WHERE m.channel_id = _channel AND m.user_id = _uid);
  END IF;
  IF NOT public.is_group_member(_uid, c.group_id) THEN RETURN false; END IF;
  IF c.kind = 'event' THEN
    RETURN public.is_group_team_member(_uid, c.group_id)
      OR EXISTS (SELECT 1 FROM public.event_signups s WHERE s.event_id = c.event_id AND s.user_id = _uid AND s.signed_up)
      OR EXISTS (SELECT 1 FROM public.event_staff st WHERE st.event_id = c.event_id AND st.user_id = _uid);
  END IF;
  IF public.is_group_staff(_uid, c.group_id) THEN RETURN true; END IF;
  IF EXISTS (SELECT 1 FROM public.chat_channel_members m WHERE m.channel_id = _channel AND m.user_id = _uid) THEN RETURN true; END IF;
  RETURN CASE c.audience
    WHEN 'all' THEN true
    WHEN 'team' THEN public.is_group_team_member(_uid, c.group_id)
    WHEN 'students' THEN public.chat_is_student(_uid, c.group_id) AND (
      coalesce(cardinality(c.audience_levels), 0) = 0
      OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = _uid AND p.training_level = ANY (c.audience_levels)))
    ELSE false
  END;
END;
$$;

-- Manage = rename, change audience/members, archive, delete, post announcements.
CREATE OR REPLACE FUNCTION public.chat_can_manage(_uid uuid, _channel uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.chat_channels c
    WHERE c.id = _channel AND c.kind IN ('group', 'event') AND public.is_group_staff(_uid, c.group_id));
$$;

CREATE OR REPLACE FUNCTION public.chat_can_post(_uid uuid, _channel uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.chat_can_read(_uid, _channel) AND EXISTS (SELECT 1 FROM public.chat_channels c
    WHERE c.id = _channel AND c.archived_at IS NULL
      AND (NOT c.staff_only_posting OR public.is_group_team_member(_uid, c.group_id)));
$$;

-- ── Row level security ──────────────────────────────────────────────────────
ALTER TABLE public.chat_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_read_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_message_receipts ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_channels, public.chat_channel_members, public.chat_read_state,
  public.chat_messages, public.chat_message_receipts TO authenticated;

DROP POLICY IF EXISTS "Read accessible channels" ON public.chat_channels;
CREATE POLICY "Read accessible channels" ON public.chat_channels FOR SELECT TO authenticated
  USING (public.chat_can_read(auth.uid(), id));
DROP POLICY IF EXISTS "Staff create group channels" ON public.chat_channels;
CREATE POLICY "Staff create group channels" ON public.chat_channels FOR INSERT TO authenticated
  WITH CHECK (kind = 'group' AND created_by = auth.uid() AND public.is_group_staff(auth.uid(), group_id));
DROP POLICY IF EXISTS "Staff update channels" ON public.chat_channels;
CREATE POLICY "Staff update channels" ON public.chat_channels FOR UPDATE TO authenticated
  USING (public.chat_can_manage(auth.uid(), id)) WITH CHECK (public.is_group_staff(auth.uid(), group_id));
DROP POLICY IF EXISTS "Staff delete own-made channels" ON public.chat_channels;
CREATE POLICY "Staff delete own-made channels" ON public.chat_channels FOR DELETE TO authenticated
  USING (kind = 'group' AND NOT is_default AND public.chat_can_manage(auth.uid(), id));

DROP POLICY IF EXISTS "Read members of accessible channels" ON public.chat_channel_members;
CREATE POLICY "Read members of accessible channels" ON public.chat_channel_members FOR SELECT TO authenticated
  USING (public.chat_can_read(auth.uid(), channel_id));
DROP POLICY IF EXISTS "Staff add group members to channels" ON public.chat_channel_members;
CREATE POLICY "Staff add group members to channels" ON public.chat_channel_members FOR INSERT TO authenticated
  WITH CHECK (public.chat_can_manage(auth.uid(), channel_id) AND EXISTS (
    SELECT 1 FROM public.chat_channels c WHERE c.id = channel_id AND public.is_group_member(user_id, c.group_id)));
DROP POLICY IF EXISTS "Staff remove, members leave" ON public.chat_channel_members;
CREATE POLICY "Staff remove, members leave" ON public.chat_channel_members FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.chat_can_manage(auth.uid(), channel_id));

DROP POLICY IF EXISTS "Own read state" ON public.chat_read_state;
CREATE POLICY "Own read state" ON public.chat_read_state FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid() AND public.chat_can_read(auth.uid(), channel_id));

DROP POLICY IF EXISTS "Read messages of accessible channels" ON public.chat_messages;
CREATE POLICY "Read messages of accessible channels" ON public.chat_messages FOR SELECT TO authenticated
  USING (public.chat_can_read(auth.uid(), channel_id));
DROP POLICY IF EXISTS "Post where allowed" ON public.chat_messages;
CREATE POLICY "Post where allowed" ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.chat_can_post(auth.uid(), channel_id)
    AND ((NOT is_announcement AND NOT requires_confirmation) OR public.chat_can_manage(auth.uid(), channel_id)));
DROP POLICY IF EXISTS "Authors and staff delete" ON public.chat_messages;
CREATE POLICY "Authors and staff delete" ON public.chat_messages FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.chat_can_manage(auth.uid(), channel_id));

DROP POLICY IF EXISTS "Read receipts of accessible messages" ON public.chat_message_receipts;
CREATE POLICY "Read receipts of accessible messages" ON public.chat_message_receipts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.chat_messages m WHERE m.id = message_id AND public.chat_can_read(auth.uid(), m.channel_id)));
DROP POLICY IF EXISTS "Confirm own receipt" ON public.chat_message_receipts;
CREATE POLICY "Confirm own receipt" ON public.chat_message_receipts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.chat_messages m
    WHERE m.id = message_id AND m.requires_confirmation AND public.chat_can_read(auth.uid(), m.channel_id)));

-- ── Automatic channels ──────────────────────────────────────────────────────
-- Every group gets "Allgemein" (all members); school groups also "Team".
CREATE OR REPLACE FUNCTION public.chat_ensure_default_channels()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.chat_channels (kind, group_id, name, audience, is_default, created_by)
  SELECT 'group', NEW.id, 'Allgemein', 'all', true, NEW.created_by
  WHERE NOT EXISTS (SELECT 1 FROM public.chat_channels c WHERE c.group_id = NEW.id AND c.is_default AND c.audience = 'all');
  IF NEW.group_type = 'school' THEN
    INSERT INTO public.chat_channels (kind, group_id, name, audience, is_default, created_by)
    SELECT 'group', NEW.id, 'Team', 'team', true, NEW.created_by
    WHERE NOT EXISTS (SELECT 1 FROM public.chat_channels c WHERE c.group_id = NEW.id AND c.is_default AND c.audience = 'team');
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_chat_default_channels ON public.groups;
CREATE TRIGGER trg_chat_default_channels AFTER INSERT OR UPDATE OF group_type ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.chat_ensure_default_channels();

CREATE OR REPLACE FUNCTION public.chat_ensure_event_channel()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.chat_channels (kind, group_id, event_id, created_by)
  VALUES ('event', NEW.group_id, NEW.id, NEW.created_by) ON CONFLICT (event_id) DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_chat_event_channel ON public.flight_events;
CREATE TRIGGER trg_chat_event_channel AFTER INSERT ON public.flight_events
  FOR EACH ROW EXECUTE FUNCTION public.chat_ensure_event_channel();

CREATE OR REPLACE FUNCTION public.chat_touch_channel()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.chat_channels SET last_message_at = greatest(coalesce(last_message_at, NEW.created_at), NEW.created_at)
  WHERE id = NEW.channel_id;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_chat_touch_channel ON public.chat_messages;
CREATE TRIGGER trg_chat_touch_channel AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.chat_touch_channel();

REVOKE ALL ON FUNCTION public.chat_ensure_default_channels(), public.chat_ensure_event_channel(),
  public.chat_touch_channel() FROM PUBLIC, anon, authenticated;

-- ── Read models ─────────────────────────────────────────────────────────────
-- One channel as the app needs it (title data, rights, last message, unread count for the
-- caller); NULL when the caller cannot read it. Unread counts start at the caller's group join
-- (or the channel creation) as long as the channel was never opened.
CREATE OR REPLACE FUNCTION public.chat_channel_json(_channel uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT jsonb_build_object(
      'id', c.id, 'kind', c.kind, 'name', c.name, 'description', c.description, 'group_id', c.group_id,
      'group_name', g.name, 'group_type', g.group_type::text, 'event_id', c.event_id, 'event_title', e.title,
      'event_date', e.event_date, 'audience', c.audience, 'audience_levels', to_jsonb(c.audience_levels),
      'staff_only_posting', c.staff_only_posting, 'is_default', c.is_default, 'archived_at', c.archived_at,
      'created_at', c.created_at, 'last_message_at', c.last_message_at,
      'can_manage', public.chat_can_manage(auth.uid(), c.id), 'can_post', public.chat_can_post(auth.uid(), c.id),
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
  WHERE c.id = _channel;  -- RLS on chat_channels: no row (NULL) when the caller cannot read it
$$;

-- Inbox: every channel the caller can read; event channels only around their date or while active.
CREATE OR REPLACE FUNCTION public.chat_inbox()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(public.chat_channel_json(c.id) ORDER BY coalesce(c.last_message_at, c.created_at) DESC), '[]'::jsonb)
  FROM public.chat_channels c
  LEFT JOIN public.flight_events e ON e.id = c.event_id
  WHERE c.kind <> 'event' OR e.event_date >= now() - interval '14 days' OR c.last_message_at >= now() - interval '14 days';
$$;

-- The chat of one event (NULL when the caller is neither signed up nor in the team).
CREATE OR REPLACE FUNCTION public.chat_event_channel(_event uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT public.chat_channel_json(c.id) FROM public.chat_channels c WHERE c.event_id = _event;
$$;

-- People who can read a channel (for "confirmed by X of Y" and the member overview).
CREATE OR REPLACE FUNCTION public.chat_channel_readers(_channel uuid)
RETURNS TABLE (user_id uuid, pilot_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT gm.user_id, coalesce(p.pilot_name, '')
  FROM public.chat_channels c
  JOIN public.group_members gm ON gm.group_id = c.group_id
  LEFT JOIN public.profiles p ON p.user_id = gm.user_id
  WHERE c.id = _channel AND public.chat_can_read(auth.uid(), _channel) AND public.chat_can_read(gm.user_id, _channel)
  UNION
  SELECT m.user_id, coalesce(p.pilot_name, '')
  FROM public.chat_channel_members m LEFT JOIN public.profiles p ON p.user_id = m.user_id
  WHERE m.channel_id = _channel AND public.chat_can_read(auth.uid(), _channel);
$$;

CREATE OR REPLACE FUNCTION public.chat_mark_read(_channel uuid)
RETURNS void LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = public AS $$
  INSERT INTO public.chat_read_state (channel_id, user_id, last_read_at) VALUES (_channel, auth.uid(), now())
  ON CONFLICT (channel_id, user_id) DO UPDATE SET last_read_at = now();
$$;

REVOKE ALL ON FUNCTION public.chat_channel_json(uuid), public.chat_inbox(), public.chat_event_channel(uuid),
  public.chat_channel_readers(uuid), public.chat_mark_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_channel_json(uuid), public.chat_inbox(), public.chat_event_channel(uuid),
  public.chat_channel_readers(uuid), public.chat_mark_read(uuid),
  public.chat_can_read(uuid, uuid), public.chat_can_post(uuid, uuid), public.chat_can_manage(uuid, uuid),
  public.chat_is_student(uuid, uuid) TO authenticated;

-- ── Storage: channel attachments under channel/<channel_id>/<user_id>/<file> ─────────────
DROP POLICY IF EXISTS "Channel readers read attachments" ON storage.objects;
CREATE POLICY "Channel readers read attachments" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'chat-attachments' AND (storage.foldername(name))[1] = 'channel'
    AND public.chat_can_read(auth.uid(), ((storage.foldername(name))[2])::uuid));
DROP POLICY IF EXISTS "Channel posters upload attachments" ON storage.objects;
CREATE POLICY "Channel posters upload attachments" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-attachments' AND (storage.foldername(name))[1] = 'channel'
    AND (storage.foldername(name))[3] = auth.uid()::text
    AND public.chat_can_post(auth.uid(), ((storage.foldername(name))[2])::uuid));
DROP POLICY IF EXISTS "Uploader or channel staff delete attachments" ON storage.objects;
CREATE POLICY "Uploader or channel staff delete attachments" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'chat-attachments' AND (storage.foldername(name))[1] = 'channel'
    AND ((storage.foldername(name))[3] = auth.uid()::text
      OR public.chat_can_manage(auth.uid(), ((storage.foldername(name))[2])::uuid)));

-- ── Backfill: channels for existing groups/events, copy existing chats ──────────────────
INSERT INTO public.chat_channels (kind, group_id, name, audience, is_default, created_by)
SELECT 'group', g.id, 'Allgemein', 'all', true, g.created_by FROM public.groups g
WHERE NOT EXISTS (SELECT 1 FROM public.chat_channels c WHERE c.group_id = g.id AND c.is_default AND c.audience = 'all');
INSERT INTO public.chat_channels (kind, group_id, name, audience, is_default, created_by)
SELECT 'group', g.id, 'Team', 'team', true, g.created_by FROM public.groups g
WHERE (g.group_type = 'school' OR EXISTS (SELECT 1 FROM public.group_messages gm WHERE gm.group_id = g.id AND gm.is_team_only))
  AND NOT EXISTS (SELECT 1 FROM public.chat_channels c WHERE c.group_id = g.id AND c.is_default AND c.audience = 'team');
INSERT INTO public.chat_channels (kind, group_id, event_id, created_by)
SELECT 'event', e.group_id, e.id, e.created_by FROM public.flight_events e ON CONFLICT (event_id) DO NOTHING;

INSERT INTO public.chat_messages (id, channel_id, user_id, message, attachment_path, is_announcement, requires_confirmation, created_at)
SELECT gm.id, c.id, gm.user_id, coalesce(gm.message, ''), gm.attachment_path, coalesce(gm.is_announcement, false),
  coalesce(gm.requires_confirmation, false), gm.created_at
FROM public.group_messages gm
JOIN public.chat_channels c ON c.group_id = gm.group_id AND c.is_default
  AND c.audience = CASE WHEN gm.is_team_only THEN 'team' ELSE 'all' END
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.chat_message_receipts (message_id, user_id, confirmed_at)
SELECT r.message_id, r.user_id, r.confirmed_at FROM public.announcement_read_receipts r
WHERE EXISTS (SELECT 1 FROM public.chat_messages m WHERE m.id = r.message_id)
ON CONFLICT DO NOTHING;
INSERT INTO public.chat_messages (id, channel_id, user_id, message, created_at)
SELECT em.id, c.id, em.user_id, em.message, em.created_at
FROM public.event_messages em JOIN public.chat_channels c ON c.event_id = em.event_id
ON CONFLICT (id) DO NOTHING;
UPDATE public.chat_channels c SET last_message_at = x.last_at
FROM (SELECT channel_id, max(created_at) AS last_at FROM public.chat_messages GROUP BY channel_id) x
WHERE x.channel_id = c.id;

-- ── Transition: app versions still open in a browser write to the old tables ────────────
-- Forward those inserts into the channels (same id) so nothing is lost until they reload; the
-- channel trigger now sends announcement pushes, so the old one is dropped to avoid doubles.
CREATE OR REPLACE FUNCTION public.chat_forward_group_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.chat_messages (id, channel_id, user_id, message, attachment_path, is_announcement, requires_confirmation, created_at)
  SELECT NEW.id, c.id, NEW.user_id, coalesce(NEW.message, ''), NEW.attachment_path, coalesce(NEW.is_announcement, false),
    coalesce(NEW.requires_confirmation, false), NEW.created_at
  FROM public.chat_channels c
  WHERE c.group_id = NEW.group_id AND c.is_default AND c.audience = CASE WHEN NEW.is_team_only THEN 'team' ELSE 'all' END
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_chat_forward_group_message ON public.group_messages;
CREATE TRIGGER trg_chat_forward_group_message AFTER INSERT ON public.group_messages
  FOR EACH ROW EXECUTE FUNCTION public.chat_forward_group_message();
DROP TRIGGER IF EXISTS trg_push_on_group_announcement ON public.group_messages;

CREATE OR REPLACE FUNCTION public.chat_forward_event_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.chat_messages (id, channel_id, user_id, message, created_at)
  SELECT NEW.id, c.id, NEW.user_id, NEW.message, NEW.created_at FROM public.chat_channels c WHERE c.event_id = NEW.event_id
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_chat_forward_event_message ON public.event_messages;
CREATE TRIGGER trg_chat_forward_event_message AFTER INSERT ON public.event_messages
  FOR EACH ROW EXECUTE FUNCTION public.chat_forward_event_message();
REVOKE ALL ON FUNCTION public.chat_forward_group_message(), public.chat_forward_event_message() FROM PUBLIC, anon, authenticated;

-- ── Announcement push (created after the backfill: copied history must not push again) ──
-- Announcements push to everyone who can read the channel (as the old group chat did).
CREATE OR REPLACE FUNCTION public.chat_push_announcement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _member record; _author text; _title text; _group uuid;
BEGIN
  IF NOT NEW.is_announcement THEN RETURN NEW; END IF;
  SELECT coalesce(nullif(p.pilot_name, ''), 'Jemand') INTO _author FROM public.profiles p WHERE p.user_id = NEW.user_id;
  SELECT c.group_id, coalesce(c.name, e.title, 'Chat') INTO _group, _title
    FROM public.chat_channels c LEFT JOIN public.flight_events e ON e.id = c.event_id WHERE c.id = NEW.channel_id;
  FOR _member IN SELECT gm.user_id FROM public.group_members gm
      WHERE gm.group_id = _group AND gm.user_id <> NEW.user_id AND public.chat_can_read(gm.user_id, NEW.channel_id) LOOP
    PERFORM public.send_push_notification(_member.user_id, 'Ankündigung: ' || _title,
      coalesce(_author, 'Jemand') || ': ' || left(NEW.message, 120), '/messages/' || NEW.channel_id);
  END LOOP;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_chat_push_announcement ON public.chat_messages;
CREATE TRIGGER trg_chat_push_announcement AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.chat_push_announcement();

REVOKE ALL ON FUNCTION public.chat_push_announcement() FROM PUBLIC, anon, authenticated;

-- ── Realtime ────────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'chat_messages') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'chat_message_receipts') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_message_receipts;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
