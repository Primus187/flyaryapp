-- Marketplace (plan 4.4): status changes of a listing, only through these functions (0032 does not let
-- clients update status or dates). Every function checks that the caller manages the listing.
--   marketplace_publish   draft → active. Checks the required fields server-side (same rules as
--                         src/lib/marketplace-listing.ts) and the limits: 10 active listings per person,
--                         50 per school, 5 publications per person within 24 hours.
--   marketplace_reserve   active ↔ reserved
--   marketplace_mark_sold active/reserved → sold; school listings with several pieces only count down
--   marketplace_renew     extends by 60 days; an expired listing comes back (and to the top)
--   marketplace_bump      back to the top, at most once every 7 days (free for now, plan E6)
-- Private listings and school occasions run 60 days; new goods from a school do not expire.
-- Errors carry a stable code in the message ("marketplace:<code>") that the app translates.

CREATE OR REPLACE FUNCTION public.marketplace_locked_listing(_listing uuid)
RETURNS public.marketplace_listings LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l public.marketplace_listings;
BEGIN
  SELECT * INTO l FROM public.marketplace_listings WHERE id = _listing FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'marketplace:not_found' USING ERRCODE = 'P0002'; END IF;
  IF NOT public.market_can_manage(auth.uid(), l.seller_user_id, l.seller_group_id) THEN
    RAISE EXCEPTION 'marketplace:not_allowed' USING ERRCODE = '42501';
  END IF;
  RETURN l;
END;
$$;

CREATE OR REPLACE FUNCTION public.marketplace_expiry(l public.marketplace_listings)
RETURNS timestamptz LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT CASE WHEN l.seller_group_id IS NOT NULL AND l.condition = 'new' THEN NULL ELSE now() + interval '60 days' END;
$$;

-- Counts live listings of the same seller (without the given one).
CREATE OR REPLACE FUNCTION public.marketplace_check_active_limit(l public.marketplace_listings)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (SELECT count(*) FROM public.marketplace_listings o
      WHERE o.id <> l.id AND o.status IN ('active', 'reserved') AND (o.expires_at IS NULL OR o.expires_at > now())
        AND (o.seller_user_id = l.seller_user_id OR o.seller_group_id = l.seller_group_id))
     >= (CASE WHEN l.seller_group_id IS NULL THEN 10 ELSE 50 END) THEN
    RAISE EXCEPTION 'marketplace:limit_active' USING ERRCODE = '23514';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.marketplace_publish(_listing uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  l public.marketplace_listings := public.marketplace_locked_listing(_listing);
  a jsonb := l.attributes;
  _missing text;
BEGIN
  IF public.is_market_banned(auth.uid()) THEN RAISE EXCEPTION 'marketplace:banned' USING ERRCODE = '42501'; END IF;
  IF l.status <> 'draft' THEN RAISE EXCEPTION 'marketplace:wrong_status' USING ERRCODE = '22023'; END IF;

  _missing := CASE
    WHEN l.postal_code IS NULL OR coalesce(btrim(l.locality), '') = '' THEN 'missing_place'
    WHEN l.listing_type = 'wanted' THEN NULL
    WHEN l.price_type IN ('fixed', 'negotiable') AND coalesce(l.price_cents, 0) <= 0 THEN 'missing_price'
    WHEN l.condition IS NULL THEN 'missing_condition'
    WHEN l.category IN ('glider', 'tandem') AND NOT a ? 'certification' THEN 'missing_attributes'
    WHEN l.category = 'harness' AND NOT a ? 'harness_type' THEN 'missing_attributes'
    WHEN l.category = 'reserve' AND NOT (a ? 'reserve_type' AND a ? 'max_load') THEN 'missing_attributes'
    WHEN l.category = 'instrument' AND NOT a ? 'instrument_type' THEN 'missing_attributes'
    WHEN NOT EXISTS (SELECT 1 FROM public.marketplace_listing_photos WHERE listing_id = l.id) THEN 'missing_photo'
  END;
  IF _missing IS NOT NULL THEN RAISE EXCEPTION 'marketplace:%', _missing USING ERRCODE = '23514'; END IF;

  PERFORM public.marketplace_check_active_limit(l);
  IF l.seller_group_id IS NULL AND (SELECT count(*) FROM public.marketplace_listings o
      WHERE o.seller_user_id = l.seller_user_id AND o.published_at > now() - interval '24 hours') >= 5 THEN
    RAISE EXCEPTION 'marketplace:limit_daily' USING ERRCODE = '23514';
  END IF;

  UPDATE public.marketplace_listings SET status = 'active', published_at = now(), bumped_at = now(),
    expires_at = public.marketplace_expiry(l)
  WHERE id = l.id RETURNING * INTO l;
  RETURN jsonb_build_object('status', l.status, 'expires_at', l.expires_at, 'bumped_at', l.bumped_at);
END;
$$;

CREATE OR REPLACE FUNCTION public.marketplace_reserve(_listing uuid, _reserved boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l public.marketplace_listings := public.marketplace_locked_listing(_listing);
BEGIN
  IF l.status NOT IN ('active', 'reserved') OR (l.expires_at IS NOT NULL AND l.expires_at <= now()) THEN
    RAISE EXCEPTION 'marketplace:wrong_status' USING ERRCODE = '22023';
  END IF;
  UPDATE public.marketplace_listings SET status = CASE WHEN _reserved THEN 'reserved' ELSE 'active' END
  WHERE id = l.id RETURNING * INTO l;
  RETURN jsonb_build_object('status', l.status, 'expires_at', l.expires_at, 'bumped_at', l.bumped_at);
END;
$$;

CREATE OR REPLACE FUNCTION public.marketplace_mark_sold(_listing uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l public.marketplace_listings := public.marketplace_locked_listing(_listing);
BEGIN
  IF l.status NOT IN ('active', 'reserved', 'expired') THEN
    RAISE EXCEPTION 'marketplace:wrong_status' USING ERRCODE = '22023';
  END IF;
  IF l.seller_group_id IS NOT NULL AND l.quantity > 1 THEN
    UPDATE public.marketplace_listings SET quantity = quantity - 1, status = 'active' WHERE id = l.id RETURNING * INTO l;
  ELSE
    UPDATE public.marketplace_listings SET status = 'sold', quantity = CASE WHEN seller_group_id IS NULL THEN quantity ELSE 0 END
    WHERE id = l.id RETURNING * INTO l;
  END IF;
  RETURN jsonb_build_object('status', l.status, 'quantity', l.quantity, 'expires_at', l.expires_at, 'bumped_at', l.bumped_at);
END;
$$;

CREATE OR REPLACE FUNCTION public.marketplace_renew(_listing uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  l public.marketplace_listings := public.marketplace_locked_listing(_listing);
  _was_expired boolean := l.status = 'expired' OR (l.status IN ('active', 'reserved') AND l.expires_at <= now());
BEGIN
  IF public.is_market_banned(auth.uid()) THEN RAISE EXCEPTION 'marketplace:banned' USING ERRCODE = '42501'; END IF;
  IF l.status NOT IN ('active', 'reserved', 'expired') THEN
    RAISE EXCEPTION 'marketplace:wrong_status' USING ERRCODE = '22023';
  END IF;
  IF _was_expired THEN PERFORM public.marketplace_check_active_limit(l); END IF;
  UPDATE public.marketplace_listings SET
    status = CASE WHEN status = 'expired' THEN 'active' ELSE status END,
    expires_at = public.marketplace_expiry(l),
    bumped_at = CASE WHEN _was_expired THEN now() ELSE bumped_at END
  WHERE id = l.id RETURNING * INTO l;
  RETURN jsonb_build_object('status', l.status, 'expires_at', l.expires_at, 'bumped_at', l.bumped_at);
END;
$$;

CREATE OR REPLACE FUNCTION public.marketplace_bump(_listing uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l public.marketplace_listings := public.marketplace_locked_listing(_listing);
BEGIN
  IF l.status NOT IN ('active', 'reserved') OR (l.expires_at IS NOT NULL AND l.expires_at <= now()) THEN
    RAISE EXCEPTION 'marketplace:wrong_status' USING ERRCODE = '22023';
  END IF;
  IF l.bumped_at > now() - interval '7 days' THEN
    RAISE EXCEPTION 'marketplace:bump_too_soon' USING ERRCODE = '23514';
  END IF;
  UPDATE public.marketplace_listings SET bumped_at = now() WHERE id = l.id RETURNING * INTO l;
  RETURN jsonb_build_object('status', l.status, 'expires_at', l.expires_at, 'bumped_at', l.bumped_at);
END;
$$;

REVOKE ALL ON FUNCTION public.marketplace_locked_listing(uuid), public.marketplace_expiry(public.marketplace_listings),
  public.marketplace_check_active_limit(public.marketplace_listings) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.marketplace_publish(uuid), public.marketplace_reserve(uuid, boolean),
  public.marketplace_mark_sold(uuid), public.marketplace_renew(uuid), public.marketplace_bump(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marketplace_publish(uuid), public.marketplace_reserve(uuid, boolean),
  public.marketplace_mark_sold(uuid), public.marketplace_renew(uuid), public.marketplace_bump(uuid) TO authenticated;
