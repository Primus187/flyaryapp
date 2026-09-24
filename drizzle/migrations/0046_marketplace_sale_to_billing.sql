-- Marketplace (plan 7.2): a school sells one of its listings to one of its members and puts it on the
-- member's bill instead of taking payment online.
--   marketplace_sell_to_member(listing, member, price): only for school listings, by whoever manages them
--   (admin, school lead, shop); the buyer must belong to the school. Creates a billing item (type "purchase",
--   CHF like the rest of the billing) and marks the listing sold – several pieces count down one by one.
--   billing_items.listing_id keeps the link to the listing.
--   marketplace_sale_candidates(listing): the school's members to choose from.

ALTER TABLE public.billing_items ADD COLUMN IF NOT EXISTS listing_id uuid REFERENCES public.marketplace_listings(id) ON DELETE SET NULL;

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
  RETURN _item;
END;
$$;
REVOKE ALL ON FUNCTION public.marketplace_sell_to_member(uuid, uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marketplace_sell_to_member(uuid, uuid, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.marketplace_sale_candidates(_listing uuid)
RETURNS TABLE (user_id uuid, pilot_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT gm.user_id, coalesce(nullif(p.pilot_name, ''), '–')
  FROM public.marketplace_listings l
  JOIN public.group_members gm ON gm.group_id = l.seller_group_id
  LEFT JOIN public.profiles p ON p.user_id = gm.user_id
  WHERE l.id = _listing AND public.market_can_manage(auth.uid(), NULL, l.seller_group_id)
  ORDER BY 2;
$$;
REVOKE ALL ON FUNCTION public.marketplace_sale_candidates(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marketplace_sale_candidates(uuid) TO authenticated;
