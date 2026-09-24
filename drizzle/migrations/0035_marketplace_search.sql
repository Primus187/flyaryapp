-- Marketplace (plan 4.5): browsing, search and the seller card on the detail page.
--   market_listing_visible  the visibility rule of 0032 as one function; the SELECT policy now uses it,
--                           and SECURITY DEFINER functions check the same rule explicitly.
--   marketplace_search      listed offers/wanted ads with filters, sorting and keyset paging. Runs as the
--                           caller (RLS applies) and returns only listed ones (active/reserved, not expired).
--                           Text search: word prefixes over title, manufacturer, model, size and description
--                           (tsvector 'simple') or, for typos, trigram similarity on title/manufacturer/model.
--   marketplace_seller_cards  name, avatar, member since and number of logged flights of the seller (or the
--                           school's name) for listings the caller may see; profiles and flights are not
--                           readable for strangers otherwise.

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.market_listing_visible(_uid uuid, l public.marketplace_listings)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _uid IS NOT NULL AND (
    public.market_can_manage(_uid, l.seller_user_id, l.seller_group_id)
    OR public.is_market_staff(_uid)
    OR (l.status IN ('active', 'reserved')
        AND (l.expires_at IS NULL OR l.expires_at > now())
        AND (l.visibility = 'all' OR public.is_group_member(_uid, l.seller_group_id))));
$$;
REVOKE ALL ON FUNCTION public.market_listing_visible(uuid, public.marketplace_listings) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.market_listing_visible(uuid, public.marketplace_listings) TO authenticated;

DROP POLICY IF EXISTS "Visible listings" ON public.marketplace_listings;
CREATE POLICY "Visible listings" ON public.marketplace_listings FOR SELECT TO authenticated
  USING (public.market_listing_visible(auth.uid(), marketplace_listings));

CREATE INDEX IF NOT EXISTS marketplace_listings_title_trgm ON public.marketplace_listings
  USING gin (lower(title || ' ' || coalesce(manufacturer, '') || ' ' || coalesce(model, '')) extensions.gin_trgm_ops);

CREATE OR REPLACE FUNCTION public.marketplace_search(_filters jsonb DEFAULT '{}'::jsonb, _cursor jsonb DEFAULT NULL, _limit integer DEFAULT 24)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public, extensions AS $$
DECLARE
  _q text := nullif(btrim(coalesce(_filters->>'q', '')), '');
  _sort text := coalesce(_filters->>'sort', 'newest');
  _size integer := least(greatest(coalesce(_limit, 24), 1), 60);
  _tsq tsquery;
  _items jsonb;
  _more boolean;
  _last jsonb;
BEGIN
  IF _q IS NOT NULL THEN
    SELECT to_tsquery('simple', string_agg(w || ':*', ' & ')) INTO _tsq
    FROM regexp_split_to_table(lower(regexp_replace(left(_q, 100), '[&|!():*''"\\<>]', ' ', 'g')), '\s+') AS w
    WHERE w <> '';
  END IF;

  WITH hits AS (
    SELECT l.*,
      -- free counts as 0; "on request" goes last in both directions
      CASE _sort
        WHEN 'price_asc' THEN coalesce(l.price_cents, CASE WHEN l.price_type = 'free' THEN 0 END, 2147483647)
        WHEN 'price_desc' THEN coalesce(l.price_cents, CASE WHEN l.price_type = 'free' THEN 0 END, -1) END AS sort_price
    FROM public.marketplace_listings l
    WHERE l.status IN ('active', 'reserved') AND (l.expires_at IS NULL OR l.expires_at > now())
      AND (_q IS NULL OR (_tsq IS NOT NULL AND l.search_vector @@ _tsq)
           OR word_similarity(lower(_q), lower(l.title || ' ' || coalesce(l.manufacturer, '') || ' ' || coalesce(l.model, ''))) >= 0.5)
      AND (_filters->>'type' IS NULL OR l.listing_type = _filters->>'type')
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
      AND (coalesce((_filters->>'schools_only')::boolean, false) = false OR l.seller_group_id IS NOT NULL)
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
      'thumb_path', (SELECT ph.thumb_path FROM public.marketplace_listing_photos ph WHERE ph.listing_id = n.id ORDER BY ph.position LIMIT 1)
    ) ORDER BY n.n) FILTER (WHERE n.n <= _size), '[]'::jsonb),
    count(*) > _size,
    (array_agg(jsonb_build_object('t', n.bumped_at, 'p', n.sort_price, 'id', n.id) ORDER BY n.n) FILTER (WHERE n.n <= _size))[_size]
  INTO _items, _more, _last
  FROM numbered n;

  RETURN jsonb_build_object('items', _items, 'next_cursor', CASE WHEN _more THEN _last END);
END;
$$;
REVOKE ALL ON FUNCTION public.marketplace_search(jsonb, jsonb, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marketplace_search(jsonb, jsonb, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.marketplace_seller_cards(_listing_ids uuid[])
RETURNS TABLE (listing_id uuid, seller_kind text, seller_id uuid, name text, avatar_url text, member_since timestamptz, flight_count integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT l.id,
    CASE WHEN l.seller_group_id IS NULL THEN 'person' ELSE 'school' END,
    coalesce(l.seller_user_id, l.seller_group_id),
    coalesce(g.name, p.pilot_name),
    CASE WHEN l.seller_group_id IS NULL THEN p.avatar_url END,
    coalesce(g.created_at, p.created_at),
    CASE WHEN l.seller_user_id IS NOT NULL THEN (SELECT count(*)::integer FROM public.flights f WHERE f.user_id = l.seller_user_id) END
  FROM public.marketplace_listings l
  LEFT JOIN public.profiles p ON p.user_id = l.seller_user_id
  LEFT JOIN public.groups g ON g.id = l.seller_group_id
  WHERE l.id = ANY(_listing_ids) AND public.market_listing_visible(auth.uid(), l);
$$;
REVOKE ALL ON FUNCTION public.marketplace_seller_cards(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marketplace_seller_cards(uuid[]) TO authenticated;
