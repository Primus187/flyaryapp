-- Marketplace (plan 8.1): reviews after a sale.
--   sold_to: who bought it. Set when the seller marks the listing sold to one of the people who asked in a
--   listing chat (marketplace_mark_sold_to), or by the sale to a member's bill (7.2).
--   Buyer and selling side review each other once per sale (1–5 stars, optional comment):
--     of_seller: the buyer reviews the seller (a person or the school)
--     of_buyer:  whoever manages the listing reviews the buyer (one review per listing for a school)
--   The buyer keeps seeing the sold listing, so they can review it from there.
--   Reviews can be reported; Flyary admins/moderators hide or keep them. Hidden ones do not count.
--   The seller card shows the average and the number of reviews.

ALTER TABLE public.marketplace_listings ADD COLUMN IF NOT EXISTS sold_to uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.marketplace_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid REFERENCES public.marketplace_listings(id) ON DELETE SET NULL,
  listing_title text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('of_seller', 'of_buyer')),
  reviewer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewee_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  reviewee_group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text CHECK (char_length(comment) <= 500),
  reported_at timestamptz,
  hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT marketplace_reviews_one_reviewee CHECK ((reviewee_user_id IS NULL) <> (reviewee_group_id IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS marketplace_reviews_once ON public.marketplace_reviews (listing_id, direction) WHERE listing_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS marketplace_reviews_user ON public.marketplace_reviews (reviewee_user_id) WHERE reviewee_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS marketplace_reviews_group ON public.marketplace_reviews (reviewee_group_id) WHERE reviewee_group_id IS NOT NULL;
ALTER TABLE public.marketplace_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.marketplace_reviews FROM anon, authenticated;
GRANT SELECT ON public.marketplace_reviews TO authenticated;
-- Visible reviews for everyone signed in; hidden ones only for the moderation. Writing only through the RPCs.
CREATE POLICY "Visible reviews" ON public.marketplace_reviews FOR SELECT TO authenticated
  USING (NOT hidden OR public.is_market_staff(auth.uid()));

-- ── Visibility: the buyer keeps seeing what they bought ──────────────────────
CREATE OR REPLACE FUNCTION public.market_listing_visible(_uid uuid, l public.marketplace_listings)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _uid IS NOT NULL AND (
    public.market_can_manage(_uid, l.seller_user_id, l.seller_group_id)
    OR public.is_market_staff(_uid)
    OR l.sold_to IS NOT DISTINCT FROM _uid
    OR (l.status IN ('active', 'reserved')
        AND (l.expires_at IS NULL OR l.expires_at > now())
        AND (l.seller_group_id IS NULL OR public.market_shop_ready(l.seller_group_id))
        AND (l.visibility = 'all' OR public.is_group_member(_uid, l.seller_group_id)))
    OR (l.seller_group_id IS NULL AND public.is_market_moderator(_uid)
        AND EXISTS (SELECT 1 FROM public.marketplace_reports r WHERE r.listing_id = l.id)));
$$;

-- ── Who bought it ───────────────────────────────────────────────────────────
-- People who asked about the listing in a listing chat (the seller picks the buyer from them).
CREATE OR REPLACE FUNCTION public.marketplace_chat_buyers(_listing uuid)
RETURNS TABLE (user_id uuid, pilot_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.buyer_id, coalesce(nullif(p.pilot_name, ''), '–')
  FROM public.chat_channels c
  JOIN public.marketplace_listings l ON l.id = c.listing_id
  LEFT JOIN public.profiles p ON p.user_id = c.buyer_id
  WHERE c.kind = 'listing' AND c.listing_id = _listing AND c.buyer_id IS NOT NULL
    AND c.last_message_at IS NOT NULL
    AND public.market_can_manage(auth.uid(), l.seller_user_id, l.seller_group_id)
  ORDER BY c.last_message_at DESC;
$$;
REVOKE ALL ON FUNCTION public.marketplace_chat_buyers(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marketplace_chat_buyers(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.marketplace_mark_sold_to(_listing uuid, _buyer uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  l public.marketplace_listings := public.marketplace_locked_listing(_listing);
  _result jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.chat_channels c WHERE c.kind = 'listing' AND c.listing_id = l.id AND c.buyer_id = _buyer) THEN
    RAISE EXCEPTION 'marketplace:buyer_not_in_chat' USING ERRCODE = '22023';
  END IF;
  _result := public.marketplace_mark_sold(_listing);
  -- several pieces (school new goods): the listing stays live, the buyer is recorded with the last piece
  UPDATE public.marketplace_listings SET sold_to = _buyer WHERE id = _listing AND status = 'sold';
  IF FOUND THEN
    INSERT INTO public.notifications (user_id, actor_id, type, reference_id, reference_type)
    VALUES (_buyer, NULL, 'market_review_invite', l.id, 'listing');
  END IF;
  RETURN _result;
END;
$$;
REVOKE ALL ON FUNCTION public.marketplace_mark_sold_to(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marketplace_mark_sold_to(uuid, uuid) TO authenticated;

-- The sale to a member's bill (7.2) also records the buyer.
CREATE OR REPLACE FUNCTION public.marketplace_sell_to_member(_listing uuid, _buyer uuid, _price_cents integer DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  l public.marketplace_listings := public.marketplace_locked_listing(_listing);
  _cents integer;
  _item uuid;
BEGIN
  IF l.seller_group_id IS NULL THEN RAISE EXCEPTION 'marketplace:school_only' USING ERRCODE = '22023'; END IF;
  IF l.status NOT IN ('active', 'reserved') OR (l.expires_at IS NOT NULL AND l.expires_at <= now()) THEN
    RAISE EXCEPTION 'marketplace:wrong_status' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.group_members WHERE group_id = l.seller_group_id AND user_id = _buyer) THEN
    RAISE EXCEPTION 'marketplace:buyer_not_member' USING ERRCODE = '22023';
  END IF;
  _cents := coalesce(_price_cents, l.price_cents);
  IF _cents IS NULL OR _cents <= 0 OR _cents > 10000000 THEN RAISE EXCEPTION 'marketplace:missing_price' USING ERRCODE = '23514'; END IF;

  INSERT INTO public.billing_items (group_id, user_id, item_type, description, quantity, unit_amount, amount, billing_date,
    note, created_by, listing_id)
  VALUES (l.seller_group_id, _buyer, 'purchase', left('Marktplatz: ' || l.title, 200), 1, _cents / 100.0, _cents / 100.0, current_date,
    NULL, auth.uid(), l.id)
  RETURNING id INTO _item;

  PERFORM public.marketplace_mark_sold(_listing);
  -- the last piece: the buyer can review the school (with several pieces the listing stays live)
  UPDATE public.marketplace_listings SET sold_to = _buyer WHERE id = _listing AND status = 'sold';
  IF FOUND THEN
    INSERT INTO public.notifications (user_id, actor_id, type, reference_id, reference_type)
    VALUES (_buyer, NULL, 'market_review_invite', l.id, 'listing');
  END IF;
  RETURN _item;
END;
$$;

-- ── Reviewing ───────────────────────────────────────────────────────────────
-- What the caller may still review on this listing: 'of_seller' (buyer), 'of_buyer' (selling side) or NULL.
CREATE OR REPLACE FUNCTION public.marketplace_review_state(_listing uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN l.sold_to = auth.uid() AND NOT EXISTS (SELECT 1 FROM public.marketplace_reviews r WHERE r.listing_id = l.id AND r.direction = 'of_seller')
      THEN 'of_seller'
    WHEN public.market_can_manage(auth.uid(), l.seller_user_id, l.seller_group_id)
      AND NOT EXISTS (SELECT 1 FROM public.marketplace_reviews r WHERE r.listing_id = l.id AND r.direction = 'of_buyer')
      THEN 'of_buyer'
  END
  FROM public.marketplace_listings l
  WHERE l.id = _listing AND l.status = 'sold' AND l.sold_to IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.marketplace_review_state(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marketplace_review_state(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.marketplace_review(_listing uuid, _rating integer, _comment text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  l public.marketplace_listings;
  _direction text := public.marketplace_review_state(_listing);
  _id uuid;
  _notify uuid;
BEGIN
  IF _direction IS NULL THEN RAISE EXCEPTION 'marketplace:cannot_review' USING ERRCODE = '42501'; END IF;
  IF _rating IS NULL OR _rating NOT BETWEEN 1 AND 5 THEN RAISE EXCEPTION 'marketplace:invalid_rating' USING ERRCODE = '22023'; END IF;
  SELECT * INTO l FROM public.marketplace_listings WHERE id = _listing;
  INSERT INTO public.marketplace_reviews (listing_id, listing_title, direction, reviewer_id, reviewee_user_id, reviewee_group_id, rating, comment)
  VALUES (l.id, l.title, _direction, auth.uid(),
    CASE WHEN _direction = 'of_buyer' THEN l.sold_to ELSE l.seller_user_id END,
    CASE WHEN _direction = 'of_seller' THEN l.seller_group_id END,
    _rating, nullif(btrim(left(_comment, 500)), ''))
  RETURNING id INTO _id;
  _notify := CASE WHEN _direction = 'of_buyer' THEN l.sold_to ELSE coalesce(l.seller_user_id, l.created_by) END;
  IF _notify IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, actor_id, type, reference_id, reference_type)
    VALUES (_notify, NULL, 'market_reviewed', l.id, 'listing');
  END IF;
  RETURN _id;
END;
$$;
REVOKE ALL ON FUNCTION public.marketplace_review(uuid, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marketplace_review(uuid, integer, text) TO authenticated;

-- Reviews of a person or a school (latest first, visible ones; the moderation also sees hidden ones).
CREATE OR REPLACE FUNCTION public.marketplace_reviews_of(_user uuid, _group uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', r.id, 'rating', r.rating, 'comment', r.comment, 'direction', r.direction, 'listing_title', r.listing_title,
      'created_at', r.created_at, 'hidden', r.hidden, 'reported', r.reported_at IS NOT NULL,
      'reviewer_name', coalesce(nullif(split_part(p.pilot_name, ' ', 1), ''), '–'))
    ORDER BY r.created_at DESC), '[]'::jsonb)
  FROM (SELECT * FROM public.marketplace_reviews
        WHERE (reviewee_user_id = _user OR reviewee_group_id = _group) AND (NOT hidden OR public.is_market_staff(auth.uid()))
        ORDER BY created_at DESC LIMIT 50) r
  LEFT JOIN public.profiles p ON p.user_id = r.reviewer_id
  WHERE auth.uid() IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.marketplace_reviews_of(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marketplace_reviews_of(uuid, uuid) TO authenticated;

-- Reporting and moderating reviews.
CREATE OR REPLACE FUNCTION public.marketplace_report_review(_review uuid)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE _r record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'marketplace:not_allowed' USING ERRCODE = '42501'; END IF;
  UPDATE public.marketplace_reviews SET reported_at = coalesce(reported_at, now()) WHERE id = _review AND NOT hidden;
  FOR _r IN SELECT DISTINCT user_id FROM public.user_roles WHERE role IN ('admin', 'moderator') LOOP
    PERFORM public.send_push_notification(_r.user_id, 'Marktplatz: Bewertung gemeldet', 'Eine Bewertung wurde gemeldet.', '/market/moderation');
  END LOOP;
END;
$$;
CREATE OR REPLACE FUNCTION public.marketplace_moderate_review(_review uuid, _hide boolean)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_market_staff(auth.uid()) THEN RAISE EXCEPTION 'marketplace:not_allowed' USING ERRCODE = '42501'; END IF;
  UPDATE public.marketplace_reviews SET hidden = _hide, reported_at = NULL WHERE id = _review;
END;
$$;
CREATE OR REPLACE FUNCTION public.marketplace_reported_reviews()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'rating', r.rating, 'comment', r.comment, 'listing_title', r.listing_title,
      'reported_at', r.reported_at) ORDER BY r.reported_at), '[]'::jsonb)
  FROM public.marketplace_reviews r
  WHERE r.reported_at IS NOT NULL AND NOT r.hidden AND public.is_market_staff(auth.uid());
$$;
REVOKE ALL ON FUNCTION public.marketplace_report_review(uuid), public.marketplace_moderate_review(uuid, boolean),
  public.marketplace_reported_reviews() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marketplace_report_review(uuid), public.marketplace_moderate_review(uuid, boolean),
  public.marketplace_reported_reviews() TO authenticated;

-- ── Seller card with rating ─────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.marketplace_seller_cards(uuid[]);
CREATE FUNCTION public.marketplace_seller_cards(_listing_ids uuid[])
RETURNS TABLE (listing_id uuid, seller_kind text, seller_id uuid, name text, avatar_url text, member_since timestamptz,
  flight_count integer, rating_avg numeric, rating_count integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT l.id,
    CASE WHEN l.seller_group_id IS NULL THEN 'person' ELSE 'school' END,
    coalesce(l.seller_user_id, l.seller_group_id),
    coalesce(g.name, p.pilot_name),
    CASE WHEN l.seller_group_id IS NULL THEN p.avatar_url END,
    coalesce(g.created_at, p.created_at),
    CASE WHEN l.seller_user_id IS NOT NULL THEN (SELECT count(*)::integer FROM public.flights f WHERE f.user_id = l.seller_user_id) END,
    (SELECT round(avg(r.rating), 1) FROM public.marketplace_reviews r
      WHERE NOT r.hidden AND (r.reviewee_user_id = l.seller_user_id OR r.reviewee_group_id = l.seller_group_id)),
    (SELECT count(*)::integer FROM public.marketplace_reviews r
      WHERE NOT r.hidden AND (r.reviewee_user_id = l.seller_user_id OR r.reviewee_group_id = l.seller_group_id))
  FROM public.marketplace_listings l
  LEFT JOIN public.profiles p ON p.user_id = l.seller_user_id
  LEFT JOIN public.groups g ON g.id = l.seller_group_id
  WHERE l.id = ANY(_listing_ids) AND public.market_listing_visible(auth.uid(), l);
$$;
REVOKE ALL ON FUNCTION public.marketplace_seller_cards(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marketplace_seller_cards(uuid[]) TO authenticated;
