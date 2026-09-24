-- Marketplace (plan 4.3): listing photos.
--   Private bucket marketplace-photos, files at <listing_id>/<photo_id>.<ext> and <listing_id>/<photo_id>_thumb.<ext>.
--   The app compresses in the browser (1280 px + 320 px thumbnail, WebP or JPEG), so the bucket only takes
--   those two types and at most 2 MB per file.
--   Reading follows the listing: whoever may see the listing may see its photos (the listing's own RLS
--   decides, via a subquery that runs as the caller). Uploading and deleting: whoever manages the listing,
--   deleting also the global moderation. Max. 6 photos per listing (12 files incl. thumbnails).
--   Order: marketplace_reorder_photos, so positions change in one statement.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('marketplace-photos', 'marketplace-photos', false, 2097152, ARRAY['image/webp', 'image/jpeg'])
ON CONFLICT (id) DO NOTHING;

-- First path segment as listing id; NULL when it is not a uuid (no cast errors inside policies).
CREATE OR REPLACE FUNCTION public.market_photo_listing(_name text)
RETURNS uuid LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN split_part(_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN split_part(_name, '/', 1)::uuid END;
$$;

-- May _uid add photos to / remove photos from this listing?
CREATE OR REPLACE FUNCTION public.market_can_manage_listing(_uid uuid, _listing uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.marketplace_listings l
    WHERE l.id = _listing AND public.market_can_manage(_uid, l.seller_user_id, l.seller_group_id));
$$;

-- Photos can be added while the listing is still in use (not sold, expired or removed).
CREATE OR REPLACE FUNCTION public.market_listing_accepts_photos(_listing uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.marketplace_listings WHERE id = _listing AND status IN ('draft', 'active', 'reserved'));
$$;

CREATE OR REPLACE FUNCTION public.market_photo_file_count(_listing uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::integer FROM storage.objects
  WHERE bucket_id = 'marketplace-photos' AND public.market_photo_listing(name) = _listing;
$$;

REVOKE ALL ON FUNCTION public.market_photo_listing(text), public.market_can_manage_listing(uuid, uuid),
  public.market_listing_accepts_photos(uuid), public.market_photo_file_count(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.market_photo_listing(text), public.market_can_manage_listing(uuid, uuid),
  public.market_listing_accepts_photos(uuid), public.market_photo_file_count(uuid) TO authenticated;

-- ── Storage policies ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Marketplace photos follow the listing" ON storage.objects;
CREATE POLICY "Marketplace photos follow the listing" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'marketplace-photos'
    AND EXISTS (SELECT 1 FROM public.marketplace_listings l WHERE l.id = public.market_photo_listing(name)));

DROP POLICY IF EXISTS "Sellers upload marketplace photos" ON storage.objects;
CREATE POLICY "Sellers upload marketplace photos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'marketplace-photos'
    AND public.market_can_manage_listing(auth.uid(), public.market_photo_listing(name))
    AND public.market_listing_accepts_photos(public.market_photo_listing(name))
    AND public.market_photo_file_count(public.market_photo_listing(name)) < 12);

DROP POLICY IF EXISTS "Sellers or moderation delete marketplace photos" ON storage.objects;
CREATE POLICY "Sellers or moderation delete marketplace photos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'marketplace-photos'
    AND (public.market_can_manage_listing(auth.uid(), public.market_photo_listing(name))
      OR public.is_market_staff(auth.uid())));

-- ── Photo table ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.marketplace_listing_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.marketplace_listings(id) ON DELETE CASCADE,
  path text NOT NULL,
  thumb_path text NOT NULL,
  position smallint NOT NULL CHECK (position BETWEEN 0 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT marketplace_listing_photos_paths CHECK (
    split_part(path, '/', 1) = listing_id::text AND split_part(thumb_path, '/', 1) = listing_id::text),
  CONSTRAINT marketplace_listing_photos_position UNIQUE (listing_id, position) DEFERRABLE INITIALLY DEFERRED
);
ALTER TABLE public.marketplace_listing_photos ENABLE ROW LEVEL SECURITY;

-- Max. 6 photos; the listing row is locked so two parallel uploads cannot both become the 7th.
CREATE OR REPLACE FUNCTION public.marketplace_photo_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM 1 FROM public.marketplace_listings WHERE id = NEW.listing_id FOR UPDATE;
  IF (SELECT count(*) FROM public.marketplace_listing_photos WHERE listing_id = NEW.listing_id) >= 6 THEN
    RAISE EXCEPTION 'a listing has at most 6 photos' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.marketplace_photo_limit() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_marketplace_photo_limit ON public.marketplace_listing_photos;
CREATE TRIGGER trg_marketplace_photo_limit BEFORE INSERT ON public.marketplace_listing_photos
  FOR EACH ROW EXECUTE FUNCTION public.marketplace_photo_limit();

REVOKE ALL ON public.marketplace_listing_photos FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.marketplace_listing_photos TO authenticated;

CREATE POLICY "Photos follow the listing" ON public.marketplace_listing_photos FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.marketplace_listings l WHERE l.id = listing_id));
CREATE POLICY "Sellers add photos" ON public.marketplace_listing_photos FOR INSERT TO authenticated
  WITH CHECK (public.market_can_manage_listing(auth.uid(), listing_id) AND public.market_listing_accepts_photos(listing_id));
CREATE POLICY "Sellers or moderation remove photos" ON public.marketplace_listing_photos FOR DELETE TO authenticated
  USING (public.market_can_manage_listing(auth.uid(), listing_id) OR public.is_market_staff(auth.uid()));

-- Sets the order of all photos of a listing at once (first = cover photo).
CREATE OR REPLACE FUNCTION public.marketplace_reorder_photos(_listing uuid, _photo_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.market_can_manage_listing(auth.uid(), _listing) THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;
  IF (SELECT array_agg(id ORDER BY id) FROM public.marketplace_listing_photos WHERE listing_id = _listing)
     IS DISTINCT FROM (SELECT array_agg(x ORDER BY x) FROM unnest(_photo_ids) x) THEN
    RAISE EXCEPTION 'the list must contain every photo of the listing exactly once' USING ERRCODE = '22023';
  END IF;
  UPDATE public.marketplace_listing_photos p SET position = o.ord - 1
  FROM unnest(_photo_ids) WITH ORDINALITY AS o(id, ord)
  WHERE p.id = o.id AND p.listing_id = _listing;
END;
$$;
REVOKE ALL ON FUNCTION public.marketplace_reorder_photos(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marketplace_reorder_photos(uuid, uuid[]) TO authenticated;
