-- Marketplace (plan 4.8): reports and moderation.
--   Anyone who can see a listing (but does not sell it) reports it once, with a reason.
--   Who handles what (decision E5):
--     private listings: Flyary admins/moderators (app_role) and school moderators (function market_moderator
--                       in a school with an active shop)
--     school listings:  only Flyary admins/moderators – no moderating among competing schools
--   Three open reports from different people hide a listing automatically until someone decides.
--   Actions (marketplace_moderate): hide, restore, dismiss the open reports. Every action is logged.
--   Only admins ban people (marketplace_set_ban) and delete listings for good.
--   The seller gets a bell notification and a push when a listing is hidden.
--   Moderators get a push for new reports, at most once per hour.

ALTER TABLE public.marketplace_listings ADD COLUMN IF NOT EXISTS removed_at timestamptz;
ALTER TABLE public.marketplace_listings ADD COLUMN IF NOT EXISTS removed_from_status text
  CHECK (removed_from_status IN ('active', 'reserved', 'expired', 'draft', 'sold'));

CREATE TABLE IF NOT EXISTS public.marketplace_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.marketplace_listings(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('scam', 'unsafe', 'wrong_category', 'offensive', 'other')),
  note text CHECK (char_length(note) <= 500),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'dismissed', 'actioned')),
  handled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  handled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (listing_id, reporter_id)
);
CREATE INDEX IF NOT EXISTS marketplace_reports_open ON public.marketplace_reports (listing_id) WHERE status = 'open';
ALTER TABLE public.marketplace_reports ENABLE ROW LEVEL SECURITY;

-- Kept when the listing is deleted (listing_id then NULL, the title stays). target_user_id has no foreign key
-- on purpose: an entry may be written while that very account is being deleted (cascade), and the log must
-- never block deleting an account.
CREATE TABLE IF NOT EXISTS public.marketplace_moderation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid REFERENCES public.marketplace_listings(id) ON DELETE SET NULL,
  listing_title text,
  target_user_id uuid,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('hide', 'auto_hide', 'restore', 'dismiss', 'delete', 'ban', 'unban')),
  reason text CHECK (char_length(reason) <= 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.marketplace_moderation_log ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.marketplace_moderator_push (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_pushed_at timestamptz NOT NULL
);
ALTER TABLE public.marketplace_moderator_push ENABLE ROW LEVEL SECURITY; -- written by functions only

-- ── Who moderates ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_market_moderator(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _uid IS NOT NULL AND (public.is_market_staff(_uid) OR EXISTS (
    SELECT 1 FROM public.group_member_functions f
    WHERE f.user_id = _uid AND f.function = 'market_moderator' AND public.market_shop_ready(f.group_id)));
$$;

-- Flyary staff moderate everything; school moderators private listings of others only.
CREATE OR REPLACE FUNCTION public.market_can_moderate(_uid uuid, l public.marketplace_listings)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_market_staff(_uid)
    OR (l.seller_group_id IS NULL AND l.seller_user_id IS DISTINCT FROM _uid AND public.is_market_moderator(_uid));
$$;

REVOKE ALL ON FUNCTION public.is_market_moderator(uuid), public.market_can_moderate(uuid, public.marketplace_listings) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_market_moderator(uuid), public.market_can_moderate(uuid, public.marketplace_listings) TO authenticated;

-- School moderators also see reported private listings (incl. hidden ones and their photos).
CREATE OR REPLACE FUNCTION public.market_listing_visible(_uid uuid, l public.marketplace_listings)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _uid IS NOT NULL AND (
    public.market_can_manage(_uid, l.seller_user_id, l.seller_group_id)
    OR public.is_market_staff(_uid)
    OR (l.status IN ('active', 'reserved')
        AND (l.expires_at IS NULL OR l.expires_at > now())
        AND (l.seller_group_id IS NULL OR public.market_shop_ready(l.seller_group_id))
        AND (l.visibility = 'all' OR public.is_group_member(_uid, l.seller_group_id)))
    OR (l.seller_group_id IS NULL AND public.is_market_moderator(_uid)
        AND EXISTS (SELECT 1 FROM public.marketplace_reports r WHERE r.listing_id = l.id)));
$$;

-- ── Access rules ────────────────────────────────────────────────────────────
REVOKE ALL ON public.marketplace_reports, public.marketplace_moderation_log, public.marketplace_moderator_push FROM anon, authenticated;
GRANT SELECT ON public.marketplace_reports, public.marketplace_moderation_log TO authenticated;

CREATE POLICY "Own reports and reports one moderates" ON public.marketplace_reports FOR SELECT TO authenticated USING (
  reporter_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.marketplace_listings l WHERE l.id = listing_id AND public.market_can_moderate(auth.uid(), l)));
CREATE POLICY "Log of listings one moderates, all for staff" ON public.marketplace_moderation_log FOR SELECT TO authenticated USING (
  public.is_market_staff(auth.uid())
  OR EXISTS (SELECT 1 FROM public.marketplace_listings l WHERE l.id = listing_id AND public.market_can_moderate(auth.uid(), l)));

-- Flyary admins delete any listing for good (files first, from the app); logged by trigger.
CREATE POLICY "Admins delete listings" ON public.marketplace_listings FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ── Helpers ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.marketplace_log(_listing public.marketplace_listings, _target uuid, _action text, _reason text)
RETURNS void LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.marketplace_moderation_log (listing_id, listing_title, target_user_id, actor_id, action, reason)
  VALUES ((_listing).id, (_listing).title, _target, auth.uid(), _action, left(_reason, 500));
$$;

-- Tells whoever runs the listing that it was hidden (private: the seller; school: who created it).
CREATE OR REPLACE FUNCTION public.marketplace_notify_hidden(l public.marketplace_listings)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE _to uuid := coalesce(l.seller_user_id, l.created_by);
BEGIN
  IF _to IS NULL THEN RETURN; END IF;
  INSERT INTO public.notifications (user_id, actor_id, type, reference_id, reference_type)
  VALUES (_to, NULL, 'market_removed', l.id, 'listing');
  PERFORM public.send_push_notification(_to, 'Anzeige ausgeblendet', left(l.title, 80) || ' – ' || coalesce(l.removed_reason, ''), '/market/' || l.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.marketplace_hide(l public.marketplace_listings, _reason text)
RETURNS public.marketplace_listings LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.marketplace_listings SET status = 'removed', removed_reason = left(_reason, 500), removed_at = now(),
    removed_from_status = CASE WHEN l.status = 'removed' THEN removed_from_status ELSE l.status END
  WHERE id = l.id RETURNING * INTO l;
  PERFORM public.marketplace_notify_hidden(l);
  RETURN l;
END;
$$;

REVOKE ALL ON FUNCTION public.marketplace_log(public.marketplace_listings, uuid, text, text),
  public.marketplace_notify_hidden(public.marketplace_listings), public.marketplace_hide(public.marketplace_listings, text)
  FROM PUBLIC, anon, authenticated;

-- ── Reporting ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.marketplace_report(_listing uuid, _reason text, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _me uuid := auth.uid();
  l public.marketplace_listings;
  _open integer;
  _r record;
BEGIN
  SELECT * INTO l FROM public.marketplace_listings WHERE id = _listing FOR UPDATE;
  IF NOT FOUND OR NOT public.market_listing_visible(_me, l) THEN RAISE EXCEPTION 'marketplace:not_found' USING ERRCODE = 'P0002'; END IF;
  IF public.market_can_manage(_me, l.seller_user_id, l.seller_group_id) THEN
    RAISE EXCEPTION 'marketplace:own_listing' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.marketplace_reports (listing_id, reporter_id, reason, note)
  VALUES (_listing, _me, _reason, nullif(btrim(left(_note, 500)), ''))
  ON CONFLICT (listing_id, reporter_id) DO NOTHING;
  IF NOT FOUND THEN RAISE EXCEPTION 'marketplace:already_reported' USING ERRCODE = '23505'; END IF;

  SELECT count(*) INTO _open FROM public.marketplace_reports WHERE listing_id = _listing AND status = 'open';
  IF _open >= 3 AND l.status IN ('active', 'reserved') THEN
    l := public.marketplace_hide(l, 'Mehrfach gemeldet – wird geprüft');
    PERFORM public.marketplace_log(l, coalesce(l.seller_user_id, l.created_by), 'auto_hide', NULL);
  END IF;

  -- Push the moderators who handle this listing, at most once an hour each.
  FOR _r IN
    SELECT DISTINCT u.user_id FROM (
      SELECT ur.user_id FROM public.user_roles ur WHERE ur.role IN ('admin', 'moderator')
      UNION
      SELECT f.user_id FROM public.group_member_functions f
      WHERE l.seller_group_id IS NULL AND f.function = 'market_moderator' AND public.market_shop_ready(f.group_id)) u
    LEFT JOIN public.marketplace_moderator_push p ON p.user_id = u.user_id
    WHERE u.user_id <> _me AND u.user_id IS DISTINCT FROM l.seller_user_id
      AND (p.last_pushed_at IS NULL OR p.last_pushed_at < now() - interval '1 hour')
  LOOP
    PERFORM public.send_push_notification(_r.user_id, 'Marktplatz: neue Meldung', left(l.title, 80), '/market/moderation');
    INSERT INTO public.marketplace_moderator_push (user_id, last_pushed_at) VALUES (_r.user_id, now())
    ON CONFLICT (user_id) DO UPDATE SET last_pushed_at = now();
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.marketplace_report(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marketplace_report(uuid, text, text) TO authenticated;

-- ── Moderating ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.marketplace_moderate(_listing uuid, _action text, _reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  l public.marketplace_listings;
  _target uuid;
BEGIN
  SELECT * INTO l FROM public.marketplace_listings WHERE id = _listing FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'marketplace:not_found' USING ERRCODE = 'P0002'; END IF;
  IF NOT public.market_can_moderate(auth.uid(), l) THEN RAISE EXCEPTION 'marketplace:not_allowed' USING ERRCODE = '42501'; END IF;
  _target := coalesce(l.seller_user_id, l.created_by);

  IF _action = 'hide' THEN
    IF coalesce(btrim(_reason), '') = '' THEN RAISE EXCEPTION 'marketplace:reason_required' USING ERRCODE = '22023'; END IF;
    l := public.marketplace_hide(l, btrim(_reason));
    UPDATE public.marketplace_reports SET status = 'actioned', handled_by = auth.uid(), handled_at = now()
    WHERE listing_id = _listing AND status = 'open';
  ELSIF _action = 'restore' THEN
    IF l.status <> 'removed' THEN RAISE EXCEPTION 'marketplace:wrong_status' USING ERRCODE = '22023'; END IF;
    UPDATE public.marketplace_listings SET status = coalesce(removed_from_status, 'active'), removed_reason = NULL,
      removed_at = NULL, removed_from_status = NULL
    WHERE id = _listing RETURNING * INTO l;
    UPDATE public.marketplace_reports SET status = 'dismissed', handled_by = auth.uid(), handled_at = now()
    WHERE listing_id = _listing AND status = 'open';
  ELSIF _action = 'dismiss' THEN
    UPDATE public.marketplace_reports SET status = 'dismissed', handled_by = auth.uid(), handled_at = now()
    WHERE listing_id = _listing AND status = 'open';
  ELSE
    RAISE EXCEPTION 'marketplace:wrong_status' USING ERRCODE = '22023';
  END IF;

  PERFORM public.marketplace_log(l, _target, _action, nullif(btrim(coalesce(_reason, '')), ''));
  RETURN jsonb_build_object('status', l.status);
END;
$$;
REVOKE ALL ON FUNCTION public.marketplace_moderate(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marketplace_moderate(uuid, text, text) TO authenticated;

-- Only Flyary admins ban (until NULL = indefinitely) and lift bans.
CREATE OR REPLACE FUNCTION public.marketplace_set_ban(_user uuid, _banned boolean, _until timestamptz DEFAULT NULL, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'marketplace:not_allowed' USING ERRCODE = '42501'; END IF;
  IF _banned THEN
    INSERT INTO public.marketplace_bans (user_id, until, reason, created_by) VALUES (_user, _until, left(_reason, 500), auth.uid())
    ON CONFLICT (user_id) DO UPDATE SET until = excluded.until, reason = excluded.reason, created_by = excluded.created_by, created_at = now();
  ELSE
    DELETE FROM public.marketplace_bans WHERE user_id = _user;
  END IF;
  INSERT INTO public.marketplace_moderation_log (target_user_id, actor_id, action, reason)
  VALUES (_user, auth.uid(), CASE WHEN _banned THEN 'ban' ELSE 'unban' END, left(_reason, 500));
END;
$$;
REVOKE ALL ON FUNCTION public.marketplace_set_ban(uuid, boolean, timestamptz, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marketplace_set_ban(uuid, boolean, timestamptz, text) TO authenticated;

-- An admin deleting someone else's listing is logged (not the seller's own deletes, not account deletion).
CREATE OR REPLACE FUNCTION public.marketplace_log_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') AND NOT public.market_can_manage(auth.uid(), OLD.seller_user_id, OLD.seller_group_id) THEN
    INSERT INTO public.marketplace_moderation_log (listing_title, target_user_id, actor_id, action)
    VALUES (OLD.title, coalesce(OLD.seller_user_id, OLD.created_by), auth.uid(), 'delete');
  END IF;
  RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION public.marketplace_log_delete() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_marketplace_log_delete ON public.marketplace_listings;
CREATE TRIGGER trg_marketplace_log_delete BEFORE DELETE ON public.marketplace_listings
  FOR EACH ROW EXECUTE FUNCTION public.marketplace_log_delete();

-- ── Queue ───────────────────────────────────────────────────────────────────
-- Listings with open reports (or hidden ones still waiting for a decision) the caller may moderate.
CREATE OR REPLACE FUNCTION public.marketplace_moderation_queue()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(x ORDER BY x->>'first_reported_at'), '[]'::jsonb) FROM (
    SELECT jsonb_build_object(
      'listing_id', l.id, 'title', l.title, 'status', l.status, 'removed_reason', l.removed_reason,
      'is_school', l.seller_group_id IS NOT NULL,
      'seller_id', coalesce(l.seller_user_id, l.created_by),
      'seller_name', coalesce(g.name, p.pilot_name),
      'open_reports', count(r.id) FILTER (WHERE r.status = 'open'),
      'reasons', coalesce(jsonb_agg(DISTINCT r.reason) FILTER (WHERE r.status = 'open'), '[]'::jsonb),
      'notes', coalesce(jsonb_agg(r.note) FILTER (WHERE r.status = 'open' AND r.note IS NOT NULL), '[]'::jsonb),
      'first_reported_at', min(r.created_at) FILTER (WHERE r.status = 'open'),
      'seller_banned', public.is_market_banned(coalesce(l.seller_user_id, l.created_by))) AS x
    FROM public.marketplace_listings l
    JOIN public.marketplace_reports r ON r.listing_id = l.id
    LEFT JOIN public.groups g ON g.id = l.seller_group_id
    LEFT JOIN public.profiles p ON p.user_id = l.seller_user_id
    WHERE public.market_can_moderate(auth.uid(), l)
    GROUP BY l.id, g.name, p.pilot_name
    HAVING count(r.id) FILTER (WHERE r.status = 'open') > 0
  ) q;
$$;
REVOKE ALL ON FUNCTION public.marketplace_moderation_queue() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marketplace_moderation_queue() TO authenticated;
