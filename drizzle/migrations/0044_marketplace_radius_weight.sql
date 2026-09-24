-- Marketplace (plan 6.4): radius search and take-off weight.
--   lat/lng: position of the listing's postal code, rounded to 2 decimals (about 1 km) – looked up by the app
--   (geo.admin.ch) when the listing is saved; never a street address. Swiss postal codes only.
--   market_listing_matches gains two filters, used by the search and the saved searches alike:
--     near {lat, lng, radius_km}: listings within the radius (listings without a position are left out)
--     weight (kg): wings whose weight range does not include it are left out; wings without a range and
--                  other categories stay (the range is often not given)
--   marketplace_search additionally says which results are the viewer's own ('mine': no heart on them).

ALTER TABLE public.marketplace_listings ADD COLUMN IF NOT EXISTS lat numeric(5, 2) CHECK (lat BETWEEN -90 AND 90);
ALTER TABLE public.marketplace_listings ADD COLUMN IF NOT EXISTS lng numeric(5, 2) CHECK (lng BETWEEN -180 AND 180);
GRANT UPDATE (lat, lng) ON public.marketplace_listings TO authenticated;

CREATE OR REPLACE FUNCTION public.market_distance_km(_lat1 numeric, _lng1 numeric, _lat2 numeric, _lng2 numeric)
RETURNS double precision LANGUAGE sql IMMUTABLE AS $$
  SELECT 6371 * 2 * asin(sqrt(
    power(sin(radians((_lat2 - _lat1)::double precision) / 2), 2)
    + cos(radians(_lat1::double precision)) * cos(radians(_lat2::double precision))
      * power(sin(radians((_lng2 - _lng1)::double precision) / 2), 2)));
$$;

CREATE OR REPLACE FUNCTION public.market_listing_matches(l public.marketplace_listings, _filters jsonb)
RETURNS boolean LANGUAGE plpgsql STABLE SET search_path = public, extensions AS $$
DECLARE
  _q text := nullif(btrim(coalesce(_filters->>'q', '')), '');
  _tsq tsquery;
  _weight numeric := (_filters->>'weight')::numeric;
BEGIN
  IF _q IS NOT NULL THEN
    SELECT to_tsquery('simple', string_agg(w || ':*', ' & ')) INTO _tsq
    FROM regexp_split_to_table(lower(regexp_replace(left(_q, 100), '[&|!():*''"\\<>]', ' ', 'g')), '\s+') AS w
    WHERE w <> '';
    IF NOT ((_tsq IS NOT NULL AND l.search_vector @@ _tsq)
            OR word_similarity(lower(_q), lower(l.title || ' ' || coalesce(l.manufacturer, '') || ' ' || coalesce(l.model, ''))) >= 0.5) THEN
      RETURN false;
    END IF;
  END IF;
  IF jsonb_typeof(_filters->'near') = 'object' THEN
    IF l.lat IS NULL OR l.lng IS NULL OR public.market_distance_km(l.lat, l.lng, (_filters->'near'->>'lat')::numeric,
         (_filters->'near'->>'lng')::numeric) > coalesce((_filters->'near'->>'radius_km')::numeric, 50) THEN
      RETURN false;
    END IF;
  END IF;
  IF _weight IS NOT NULL AND l.category IN ('glider', 'tandem')
     AND ((l.attributes->>'weight_min')::numeric > _weight OR (l.attributes->>'weight_max')::numeric < _weight) THEN
    RETURN false;
  END IF;
  RETURN (_filters->>'type' IS NULL OR l.listing_type = _filters->>'type')
    AND (jsonb_typeof(_filters->'categories') IS DISTINCT FROM 'array' OR jsonb_array_length(_filters->'categories') = 0
         OR l.category IN (SELECT jsonb_array_elements_text(_filters->'categories')))
    AND (jsonb_typeof(_filters->'conditions') IS DISTINCT FROM 'array' OR jsonb_array_length(_filters->'conditions') = 0
         OR l.condition IN (SELECT jsonb_array_elements_text(_filters->'conditions')))
    AND (jsonb_typeof(_filters->'certifications') IS DISTINCT FROM 'array' OR jsonb_array_length(_filters->'certifications') = 0
         OR l.attributes->>'certification' IN (SELECT jsonb_array_elements_text(_filters->'certifications')))
    AND (jsonb_typeof(_filters->'cantons') IS DISTINCT FROM 'array' OR jsonb_array_length(_filters->'cantons') = 0
         OR l.canton IN (SELECT jsonb_array_elements_text(_filters->'cantons')))
    AND (_filters->>'price_min' IS NULL OR coalesce(l.price_cents, CASE WHEN l.price_type = 'free' THEN 0 END) >= (_filters->>'price_min')::integer)
    AND (_filters->>'price_max' IS NULL OR coalesce(l.price_cents, CASE WHEN l.price_type = 'free' THEN 0 END) <= (_filters->>'price_max')::integer)
    AND (nullif(btrim(_filters->>'size'), '') IS NULL OR lower(btrim(l.size)) = lower(btrim(_filters->>'size')))
    AND (coalesce((_filters->>'schools_only')::boolean, false) = false OR l.seller_group_id IS NOT NULL);
END;
$$;

-- ── Search: mark the viewer's own listings (M2 audit) ───────────────────────
CREATE OR REPLACE FUNCTION public.marketplace_search(_filters jsonb DEFAULT '{}'::jsonb, _cursor jsonb DEFAULT NULL, _limit integer DEFAULT 24)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public, extensions AS $$
DECLARE
  _sort text := coalesce(_filters->>'sort', 'newest');
  _size integer := least(greatest(coalesce(_limit, 24), 1), 60);
  _items jsonb;
  _more boolean;
  _last jsonb;
BEGIN
  WITH hits AS (
    SELECT l.*,
      -- free counts as 0; "on request" goes last in both directions
      CASE _sort
        WHEN 'price_asc' THEN coalesce(l.price_cents, CASE WHEN l.price_type = 'free' THEN 0 END, 2147483647)
        WHEN 'price_desc' THEN coalesce(l.price_cents, CASE WHEN l.price_type = 'free' THEN 0 END, -1) END AS sort_price
    FROM public.marketplace_listings l
    WHERE l.status IN ('active', 'reserved') AND (l.expires_at IS NULL OR l.expires_at > now())
      AND public.market_listing_matches(l, _filters)
  ), page AS (
    SELECT * FROM hits h
    WHERE _cursor IS NULL OR CASE
      WHEN _sort = 'price_asc' THEN (h.sort_price, h.id) > ((_cursor->>'p')::integer, (_cursor->>'id')::uuid)
      WHEN _sort = 'price_desc' THEN (h.sort_price, h.id) < ((_cursor->>'p')::integer, (_cursor->>'id')::uuid)
      ELSE (h.bumped_at, h.id) < ((_cursor->>'t')::timestamptz, (_cursor->>'id')::uuid) END
    ORDER BY
      CASE WHEN _sort = 'price_asc' THEN h.sort_price END ASC,
      CASE WHEN _sort = 'price_asc' THEN h.id END ASC,
      CASE WHEN _sort = 'price_desc' THEN h.sort_price END DESC,
      CASE WHEN _sort NOT IN ('price_asc', 'price_desc') THEN h.bumped_at END DESC,
      h.id DESC
    LIMIT _size + 1
  ), numbered AS (
    SELECT h.*, row_number() OVER (ORDER BY
      CASE WHEN _sort = 'price_asc' THEN h.sort_price END ASC,
      CASE WHEN _sort = 'price_asc' THEN h.id END ASC,
      CASE WHEN _sort = 'price_desc' THEN h.sort_price END DESC,
      CASE WHEN _sort NOT IN ('price_asc', 'price_desc') THEN h.bumped_at END DESC,
      h.id DESC) AS n FROM page h
  )
  SELECT
    coalesce(jsonb_agg(jsonb_build_object(
      'id', n.id, 'title', n.title, 'category', n.category, 'listing_type', n.listing_type, 'price_cents', n.price_cents,
      'price_type', n.price_type, 'condition', n.condition, 'size', n.size, 'locality', n.locality, 'canton', n.canton,
      'status', n.status, 'is_school', n.seller_group_id IS NOT NULL, 'bumped_at', n.bumped_at,
      'mine', public.market_can_manage(auth.uid(), n.seller_user_id, n.seller_group_id),
      'thumb_path', (SELECT ph.thumb_path FROM public.marketplace_listing_photos ph WHERE ph.listing_id = n.id ORDER BY ph.position LIMIT 1)
    ) ORDER BY n.n) FILTER (WHERE n.n <= _size), '[]'::jsonb),
    count(*) > _size,
    (array_agg(jsonb_build_object('t', n.bumped_at, 'p', n.sort_price, 'id', n.id) ORDER BY n.n) FILTER (WHERE n.n <= _size))[_size]
  INTO _items, _more, _last
  FROM numbered n;

  RETURN jsonb_build_object('items', _items, 'next_cursor', CASE WHEN _more THEN _last END);
END;
$$;
