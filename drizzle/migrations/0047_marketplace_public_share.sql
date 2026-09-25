-- Marketplace (plan 8.4): public share link for people without Flyary (revises decision E3, 2026-09-25).
--   share_token: secret per listing (like flights.share_token); the link goes to the Edge Function
--   get-shared-listing, which shows a preview to WhatsApp & co. and sends browsers to /shared/market/<token>.
--   marketplace_public_listing(token): what the public may see – only listed offers/wanted ads (active or
--   reserved, not expired), visible to everyone (not "school students only"), school listings only with an
--   active shop. No names of private sellers, no chat, no exact position; schools with their legal details.
--   Called by the Edge Function with the service role only.

ALTER TABLE public.marketplace_listings ADD COLUMN IF NOT EXISTS share_token uuid NOT NULL DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX IF NOT EXISTS marketplace_listings_share_token ON public.marketplace_listings (share_token);

CREATE OR REPLACE FUNCTION public.marketplace_public_listing(_token uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'id', l.id, 'title', l.title, 'description', l.description, 'listing_type', l.listing_type, 'category', l.category,
    'price_cents', l.price_cents, 'price_type', l.price_type, 'condition', l.condition,
    'manufacturer', l.manufacturer, 'model', l.model, 'size', l.size, 'year', l.year, 'attributes', l.attributes,
    'quantity', l.quantity, 'postal_code', l.postal_code, 'locality', l.locality, 'canton', l.canton, 'delivery', l.delivery,
    'status', l.status, 'bumped_at', l.bumped_at, 'is_school', l.seller_group_id IS NOT NULL,
    'school', CASE WHEN l.seller_group_id IS NOT NULL THEN (
      SELECT jsonb_build_object('name', g.name, 'legal_name', s.legal_name, 'street', s.street, 'postal_code', s.postal_code,
        'locality', s.locality, 'uid_number', s.uid_number, 'vat_registered', s.vat_registered, 'email', s.email, 'phone', s.phone,
        'warranty_text', s.warranty_text)
      FROM public.groups g JOIN public.school_shop_profiles s ON s.group_id = g.id WHERE g.id = l.seller_group_id) END,
    'photos', coalesce((SELECT jsonb_agg(jsonb_build_object('path', ph.path, 'thumb_path', ph.thumb_path) ORDER BY ph.position)
      FROM public.marketplace_listing_photos ph WHERE ph.listing_id = l.id), '[]'::jsonb))
  FROM public.marketplace_listings l
  WHERE l.share_token = _token
    AND l.status IN ('active', 'reserved') AND (l.expires_at IS NULL OR l.expires_at > now())
    AND l.visibility = 'all'
    AND (l.seller_group_id IS NULL OR public.market_shop_ready(l.seller_group_id));
$$;
-- Only the Edge Function (service role) reads public listings; the app itself uses the normal RLS.
REVOKE ALL ON FUNCTION public.marketplace_public_listing(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_public_listing(uuid) TO service_role;
