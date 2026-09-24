-- Chat stage 2: push level per channel, @mentions, bundling.
--   notify level (chat_read_state.notify_level, default 'mentions'):
--     'all'      every message pushes, bundled to at most one push per channel every 5 minutes
--     'mentions' only messages that mention the person (default)
--     'none'     muted
--   Announcements always push. A mention also creates a bell notification (type 'chat_mention';
--   push_on_notification ignores that type, so there is no double push).

ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS mentions uuid[] NOT NULL DEFAULT '{}';

-- When each person last got a (bundled) push per channel. Separate from chat_read_state so that
-- sending a push never moves anyone's read position.
CREATE TABLE IF NOT EXISTS public.chat_push_state (
  channel_id uuid NOT NULL REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_pushed_at timestamptz NOT NULL,
  PRIMARY KEY (channel_id, user_id)
);
ALTER TABLE public.chat_push_state ENABLE ROW LEVEL SECURITY; -- written by the trigger only

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

  FOR _r IN
    SELECT u.user_id, rs.notify_level, ps.last_pushed_at
    FROM (SELECT gm.user_id FROM public.group_members gm WHERE gm.group_id = _c.group_id
          UNION SELECT m.user_id FROM public.chat_channel_members m WHERE m.channel_id = NEW.channel_id) u
    LEFT JOIN public.chat_read_state rs ON rs.channel_id = NEW.channel_id AND rs.user_id = u.user_id
    LEFT JOIN public.chat_push_state ps ON ps.channel_id = NEW.channel_id AND ps.user_id = u.user_id
    WHERE u.user_id <> NEW.user_id AND public.chat_can_read(u.user_id, NEW.channel_id)
  LOOP
    _level := coalesce(_r.notify_level, 'mentions');
    _mentioned := _r.user_id = ANY (NEW.mentions);

    IF _mentioned THEN
      INSERT INTO public.notifications (user_id, actor_id, type, reference_id, reference_type)
      VALUES (_r.user_id, NEW.user_id, 'chat_mention', NEW.channel_id, 'chat');
    END IF;

    IF NEW.is_announcement THEN
      PERFORM public.send_push_notification(_r.user_id, 'Ankündigung: ' || _title, _body, '/messages/' || NEW.channel_id);
    ELSIF _mentioned AND _level <> 'none' THEN
      PERFORM public.send_push_notification(_r.user_id, _author || ' hat dich erwähnt · ' || _title, left(coalesce(NEW.message, ''), 140), '/messages/' || NEW.channel_id);
    ELSIF _level = 'all' AND (_r.last_pushed_at IS NULL OR _r.last_pushed_at < now() - interval '5 minutes') THEN
      PERFORM public.send_push_notification(_r.user_id, _title, _body, '/messages/' || NEW.channel_id);
      INSERT INTO public.chat_push_state (channel_id, user_id, last_pushed_at) VALUES (NEW.channel_id, _r.user_id, now())
      ON CONFLICT (channel_id, user_id) DO UPDATE SET last_pushed_at = now();
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_chat_push_announcement ON public.chat_messages;
DROP TRIGGER IF EXISTS trg_chat_notify_message ON public.chat_messages;
CREATE TRIGGER trg_chat_notify_message AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.chat_notify_message();
REVOKE ALL ON FUNCTION public.chat_notify_message() FROM PUBLIC, anon, authenticated;

-- The caller's push level for one channel (upserts the own read state).
CREATE OR REPLACE FUNCTION public.chat_set_notify_level(_channel uuid, _level text)
RETURNS void LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = public AS $$
  INSERT INTO public.chat_read_state (channel_id, user_id, notify_level) VALUES (_channel, auth.uid(), _level)
  ON CONFLICT (channel_id, user_id) DO UPDATE SET notify_level = excluded.notify_level;
$$;
REVOKE ALL ON FUNCTION public.chat_set_notify_level(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_set_notify_level(uuid, text) TO authenticated;

-- Channel JSON now also carries the caller's push level.
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

NOTIFY pgrst, 'reload schema';
