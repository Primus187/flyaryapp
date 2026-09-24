-- Marketplace (plan 4.6): chat about a listing.
--   A new channel kind 'listing': one channel per (listing, buyer), created only by the buyer through
--   marketplace_open_chat. Direct messages keep requiring a shared group; listing chats do not, because
--   they can only start from a listing the buyer is allowed to see.
--   Readers: the buyer and, for a private listing, the seller (both as channel members); for a school
--   listing (group_id = the school) everyone who manages the school's listings (admin, school lead,
--   shop), computed at read time so new shop staff join automatically.
--   The chat stays readable when the listing is sold or deleted (listing_id then becomes NULL).
--   marketplace_chat_info: listing card and the other party's name for the chat header; profiles are
--   not readable for strangers, so it runs as definer and only for people who can read the channel.
--   Push: like direct messages (every message, bundled). Banned people cannot write.

ALTER TABLE public.chat_channels ADD COLUMN IF NOT EXISTS listing_id uuid REFERENCES public.marketplace_listings(id) ON DELETE SET NULL;
ALTER TABLE public.chat_channels ADD COLUMN IF NOT EXISTS buyer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS chat_channels_listing_buyer ON public.chat_channels (listing_id, buyer_id)
  WHERE kind = 'listing' AND listing_id IS NOT NULL AND buyer_id IS NOT NULL;

ALTER TABLE public.chat_channels DROP CONSTRAINT IF EXISTS chat_channels_kind_check;
ALTER TABLE public.chat_channels ADD CONSTRAINT chat_channels_kind_check CHECK (kind IN ('group', 'event', 'direct', 'listing'));
ALTER TABLE public.chat_channels DROP CONSTRAINT IF EXISTS chat_channels_kind_shape;
ALTER TABLE public.chat_channels ADD CONSTRAINT chat_channels_kind_shape CHECK (
  (kind = 'group' AND group_id IS NOT NULL AND event_id IS NULL AND name IS NOT NULL AND btrim(name) <> '')
  OR (kind = 'event' AND group_id IS NOT NULL AND event_id IS NOT NULL)
  OR (kind = 'direct' AND group_id IS NULL AND event_id IS NULL)
  OR (kind = 'listing' AND event_id IS NULL AND name IS NOT NULL));

-- ── Access ──────────────────────────────────────────────────────────────────
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
  IF c.kind = 'listing' THEN
    RETURN EXISTS (SELECT 1 FROM public.chat_channel_members m WHERE m.channel_id = _channel AND m.user_id = _uid)
      OR (c.group_id IS NOT NULL AND public.market_can_manage(_uid, NULL, c.group_id));
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

CREATE OR REPLACE FUNCTION public.chat_can_post(_uid uuid, _channel uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.chat_can_read(_uid, _channel) AND EXISTS (SELECT 1 FROM public.chat_channels c
    WHERE c.id = _channel AND c.archived_at IS NULL
      AND (NOT c.staff_only_posting OR public.is_group_team_member(_uid, c.group_id))
      AND (c.kind <> 'listing' OR NOT public.is_market_banned(_uid)));
$$;

-- School staff see the group's own channels without chat_can_read (0026), but not the listing chats
-- of their school's shop: those only for the people who manage the listings.
DROP POLICY IF EXISTS "Read accessible channels" ON public.chat_channels;
CREATE POLICY "Read accessible channels" ON public.chat_channels FOR SELECT TO authenticated
  USING ((kind IN ('group', 'event') AND public.is_group_staff(auth.uid(), group_id)) OR public.chat_can_read(auth.uid(), id));

-- ── Opening a chat ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.marketplace_open_chat(_listing uuid)
RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _me uuid := auth.uid();
  l public.marketplace_listings;
  _id uuid;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'marketplace:not_allowed' USING ERRCODE = '42501'; END IF;
  SELECT id INTO _id FROM public.chat_channels WHERE kind = 'listing' AND listing_id = _listing AND buyer_id = _me;
  IF _id IS NOT NULL THEN RETURN _id; END IF;

  SELECT * INTO l FROM public.marketplace_listings WHERE id = _listing;
  IF NOT FOUND OR NOT public.market_listing_visible(_me, l) THEN
    RAISE EXCEPTION 'marketplace:not_found' USING ERRCODE = 'P0002';
  END IF;
  IF public.market_can_manage(_me, l.seller_user_id, l.seller_group_id) THEN
    RAISE EXCEPTION 'marketplace:own_listing' USING ERRCODE = '22023';
  END IF;
  IF l.status NOT IN ('active', 'reserved') OR (l.expires_at IS NOT NULL AND l.expires_at <= now()) THEN
    RAISE EXCEPTION 'marketplace:wrong_status' USING ERRCODE = '22023';
  END IF;
  IF public.is_market_banned(_me) THEN RAISE EXCEPTION 'marketplace:banned' USING ERRCODE = '42501'; END IF;

  INSERT INTO public.chat_channels (kind, group_id, listing_id, buyer_id, name, created_by)
  VALUES ('listing', l.seller_group_id, l.id, _me, left(l.title, 80), _me)
  ON CONFLICT (listing_id, buyer_id) WHERE kind = 'listing' AND listing_id IS NOT NULL AND buyer_id IS NOT NULL DO NOTHING
  RETURNING id INTO _id;
  IF _id IS NULL THEN  -- opened concurrently
    SELECT id INTO _id FROM public.chat_channels WHERE kind = 'listing' AND listing_id = _listing AND buyer_id = _me;
    RETURN _id;
  END IF;
  INSERT INTO public.chat_channel_members (channel_id, user_id, added_by) VALUES (_id, _me, _me);
  IF l.seller_user_id IS NOT NULL THEN
    INSERT INTO public.chat_channel_members (channel_id, user_id, added_by) VALUES (_id, l.seller_user_id, _me);
  END IF;
  RETURN _id;
END;
$$;
REVOKE ALL ON FUNCTION public.marketplace_open_chat(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marketplace_open_chat(uuid) TO authenticated;

-- Listing card and the other party for the chat header and the inbox.
CREATE OR REPLACE FUNCTION public.marketplace_chat_info(_channel uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'listing_id', l.id,
    'title', coalesce(l.title, c.name),
    'price_cents', l.price_cents, 'price_type', l.price_type, 'listing_type', l.listing_type,
    'status', CASE WHEN l.id IS NULL THEN 'removed'
                   WHEN l.status IN ('active', 'reserved') AND l.expires_at <= now() THEN 'expired' ELSE l.status END,
    'thumb_path', (SELECT ph.thumb_path FROM public.marketplace_listing_photos ph WHERE ph.listing_id = l.id ORDER BY ph.position LIMIT 1),
    'is_school', c.group_id IS NOT NULL,
    'i_am_buyer', c.buyer_id = auth.uid(),
    'buyer_id', c.buyer_id,
    'peer_name', CASE WHEN c.buyer_id = auth.uid()
      THEN coalesce(g.name, (SELECT p.pilot_name FROM public.profiles p WHERE p.user_id = l.seller_user_id))
      ELSE (SELECT p.pilot_name FROM public.profiles p WHERE p.user_id = c.buyer_id) END)
  FROM public.chat_channels c
  LEFT JOIN public.marketplace_listings l ON l.id = c.listing_id
  LEFT JOIN public.groups g ON g.id = c.group_id
  WHERE c.id = _channel AND c.kind = 'listing' AND public.chat_can_read(auth.uid(), _channel);
$$;
REVOKE ALL ON FUNCTION public.marketplace_chat_info(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marketplace_chat_info(uuid) TO authenticated;

-- ── Channel JSON and inbox: listing chats ───────────────────────────────────
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
      'listing', CASE WHEN c.kind = 'listing' THEN public.marketplace_chat_info(c.id) END,
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

-- Direct and listing chats without any message stay out of the inbox.
CREATE OR REPLACE FUNCTION public.chat_inbox()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(public.chat_channel_json(c.id) ORDER BY coalesce(c.last_message_at, c.created_at) DESC), '[]'::jsonb)
  FROM public.chat_channels c
  LEFT JOIN public.flight_events e ON e.id = c.event_id
  WHERE (c.kind = 'group')
     OR (c.kind IN ('direct', 'listing') AND c.last_message_at IS NOT NULL)
     OR (c.kind = 'event' AND (e.event_date >= now() - interval '14 days' OR c.last_message_at >= now() - interval '14 days'));
$$;

-- ── Notifications: listing chats push like direct messages ──────────────────
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
    IF _c.kind IN ('direct', 'listing') AND _level = 'mentions' THEN _level := 'all'; END IF;
    _mentioned := _r.user_id = ANY (NEW.mentions) AND _c.kind NOT IN ('direct', 'listing');

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

NOTIFY pgrst, 'reload schema';
