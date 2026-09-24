-- Marketplace (plan 6.1): favourites ("Merkliste").
--   Anyone can keep listings they are allowed to see on their list (not their own).
--   When a favourite gets cheaper, reserved or sold, everyone who keeps it gets a bell notification and a push
--   (types market_fav_price / market_fav_reserved / market_fav_sold; sender "Marktplatz").
--   marketplace_my_favorites(): the list with the current state – also for listings the person can no longer
--   open (sold, hidden, expired), so the list can say why; photos only while the listing is visible.

CREATE TABLE IF NOT EXISTS public.marketplace_favorites (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES public.marketplace_listings(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, listing_id)
);
CREATE INDEX IF NOT EXISTS marketplace_favorites_listing ON public.marketplace_favorites (listing_id);
ALTER TABLE public.marketplace_favorites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.marketplace_favorites FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.marketplace_favorites TO authenticated;

CREATE POLICY "Own favourites" ON public.marketplace_favorites FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Keep visible listings of others" ON public.marketplace_favorites FOR INSERT TO authenticated WITH CHECK (
  user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.marketplace_listings l WHERE l.id = listing_id
    AND public.market_listing_visible(auth.uid(), l)
    AND NOT public.market_can_manage(auth.uid(), l.seller_user_id, l.seller_group_id)));
CREATE POLICY "Remove own favourites" ON public.marketplace_favorites FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ── Notifications on changes that matter to people keeping the listing ──────
CREATE OR REPLACE FUNCTION public.marketplace_notify_favorites()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _type text;
  _title text;
  _r record;
BEGIN
  IF NEW.status = 'sold' AND OLD.status IS DISTINCT FROM 'sold' THEN
    _type := 'market_fav_sold'; _title := 'Gemerkte Anzeige verkauft';
  ELSIF NEW.status = 'reserved' AND OLD.status = 'active' THEN
    _type := 'market_fav_reserved'; _title := 'Gemerkte Anzeige reserviert';
  ELSIF NEW.status IN ('active', 'reserved') AND OLD.status IN ('active', 'reserved')
        AND NEW.price_cents IS NOT NULL AND OLD.price_cents IS NOT NULL AND NEW.price_cents < OLD.price_cents THEN
    _type := 'market_fav_price'; _title := 'Gemerkte Anzeige günstiger';
  ELSE
    RETURN NEW;
  END IF;

  FOR _r IN
    SELECT f.user_id FROM public.marketplace_favorites f
    WHERE f.listing_id = NEW.id AND NOT public.market_can_manage(f.user_id, NEW.seller_user_id, NEW.seller_group_id)
  LOOP
    INSERT INTO public.notifications (user_id, actor_id, type, reference_id, reference_type)
    VALUES (_r.user_id, NULL, _type, NEW.id, 'listing');
    PERFORM public.send_push_notification(_r.user_id, _title,
      left(NEW.title, 80) || CASE WHEN _type = 'market_fav_price'
        THEN ' – jetzt CHF ' || to_char(NEW.price_cents / 100.0, 'FM999999990.00') ELSE '' END,
      '/market/' || NEW.id);
  END LOOP;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.marketplace_notify_favorites() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_marketplace_notify_favorites ON public.marketplace_listings;
CREATE TRIGGER trg_marketplace_notify_favorites AFTER UPDATE OF status, price_cents ON public.marketplace_listings
  FOR EACH ROW EXECUTE FUNCTION public.marketplace_notify_favorites();

-- ── The list ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.marketplace_my_favorites()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', l.id, 'title', l.title, 'category', l.category, 'listing_type', l.listing_type,
      'price_cents', l.price_cents, 'price_type', l.price_type, 'locality', l.locality,
      'is_school', l.seller_group_id IS NOT NULL,
      'status', CASE WHEN NOT public.market_listing_visible(auth.uid(), l) AND l.status IN ('active', 'reserved') THEN 'removed'
                     WHEN l.status IN ('active', 'reserved') AND l.expires_at <= now() THEN 'expired' ELSE l.status END,
      'available', public.market_listing_visible(auth.uid(), l) AND l.status IN ('active', 'reserved')
                   AND (l.expires_at IS NULL OR l.expires_at > now()),
      'thumb_path', CASE WHEN public.market_listing_visible(auth.uid(), l) THEN
        (SELECT ph.thumb_path FROM public.marketplace_listing_photos ph WHERE ph.listing_id = l.id ORDER BY ph.position LIMIT 1) END,
      'saved_at', f.created_at)
    ORDER BY f.created_at DESC), '[]'::jsonb)
  FROM public.marketplace_favorites f
  JOIN public.marketplace_listings l ON l.id = f.listing_id
  WHERE f.user_id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.marketplace_my_favorites() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marketplace_my_favorites() TO authenticated;
