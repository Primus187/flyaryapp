-- Marketplace (plan 6.2): saved searches with push.
--   market_listing_matches(listing, filters): the filter rules of marketplace_search as one function, so a saved
--   search finds exactly what the search shows. marketplace_search (0035) now uses it too.
--   marketplace_saved_searches: at most 5 per person; filters in the format of marketplace_search ("filters")
--   plus the app's URL query ("query") to open the search again.
--   When a listing goes live (published, or back from expired), everyone with a matching saved search who may see
--   it gets a bell notification and a push – at most one per search and day.
--   marketplace_saved_searches_overview(): the searches with the number of new matches since last opened.

CREATE OR REPLACE FUNCTION public.market_listing_matches(l public.marketplace_listings, _filters jsonb)
RETURNS boolean LANGUAGE plpgsql STABLE SET search_path = public, extensions AS $$
DECLARE
  _q text := nullif(btrim(coalesce(_filters->>'q', '')), '');
  _tsq tsquery;
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
REVOKE ALL ON FUNCTION public.market_listing_matches(public.marketplace_listings, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.market_listing_matches(public.marketplace_listings, jsonb) TO authenticated;

-- ── Search, now with the shared filter function ─────────────────────────────
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
      'thumb_path', (SELECT ph.thumb_path FROM public.marketplace_listing_photos ph WHERE ph.listing_id = n.id ORDER BY ph.position LIMIT 1)
    ) ORDER BY n.n) FILTER (WHERE n.n <= _size), '[]'::jsonb),
    count(*) > _size,
    (array_agg(jsonb_build_object('t', n.bumped_at, 'p', n.sort_price, 'id', n.id) ORDER BY n.n) FILTER (WHERE n.n <= _size))[_size]
  INTO _items, _more, _last
  FROM numbered n;

  RETURN jsonb_build_object('items', _items, 'next_cursor', CASE WHEN _more THEN _last END);
END;
$$;

-- ── Saved searches ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.marketplace_saved_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 60),
  filters jsonb NOT NULL CHECK (jsonb_typeof(filters) = 'object'),
  query text NOT NULL DEFAULT '' CHECK (char_length(query) <= 1000),
  notify boolean NOT NULL DEFAULT true,
  last_notified_at timestamptz,
  last_viewed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS marketplace_saved_searches_user ON public.marketplace_saved_searches (user_id);
ALTER TABLE public.marketplace_saved_searches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.marketplace_saved_searches FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.marketplace_saved_searches TO authenticated;
GRANT UPDATE (name, filters, query, notify, last_viewed_at) ON public.marketplace_saved_searches TO authenticated;
CREATE POLICY "Own saved searches" ON public.marketplace_saved_searches FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.marketplace_saved_search_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('saved_search:' || NEW.user_id::text));
  IF (SELECT count(*) FROM public.marketplace_saved_searches WHERE user_id = NEW.user_id) >= 5 THEN
    RAISE EXCEPTION 'marketplace:limit_saved_searches' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.marketplace_saved_search_limit() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_marketplace_saved_search_limit ON public.marketplace_saved_searches;
CREATE TRIGGER trg_marketplace_saved_search_limit BEFORE INSERT ON public.marketplace_saved_searches
  FOR EACH ROW EXECUTE FUNCTION public.marketplace_saved_search_limit();

-- ── Notify when a matching listing goes live ────────────────────────────────
CREATE OR REPLACE FUNCTION public.marketplace_notify_saved_searches()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _s record;
BEGIN
  IF NOT (NEW.status = 'active' AND OLD.status IN ('draft', 'expired')) THEN RETURN NEW; END IF;
  FOR _s IN
    SELECT s.id, s.user_id, s.name, s.filters FROM public.marketplace_saved_searches s
    WHERE s.notify AND (s.last_notified_at IS NULL OR s.last_notified_at < now() - interval '1 day')
      AND NOT public.market_can_manage(s.user_id, NEW.seller_user_id, NEW.seller_group_id)
  LOOP
    IF public.market_listing_visible(_s.user_id, NEW) AND public.market_listing_matches(NEW, _s.filters) THEN
      INSERT INTO public.notifications (user_id, actor_id, type, reference_id, reference_type)
      VALUES (_s.user_id, NULL, 'market_search', _s.id, 'saved_search');
      PERFORM public.send_push_notification(_s.user_id, 'Neu im Marktplatz: ' || left(_s.name, 60), left(NEW.title, 80), '/market?saved=' || _s.id);
      UPDATE public.marketplace_saved_searches SET last_notified_at = now() WHERE id = _s.id;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.marketplace_notify_saved_searches() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_marketplace_notify_saved_searches ON public.marketplace_listings;
CREATE TRIGGER trg_marketplace_notify_saved_searches AFTER UPDATE OF status ON public.marketplace_listings
  FOR EACH ROW EXECUTE FUNCTION public.marketplace_notify_saved_searches();

-- Own searches with the number of listed matches that went live since the search was last opened.
CREATE OR REPLACE FUNCTION public.marketplace_saved_searches_overview()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id, 'name', s.name, 'query', s.query, 'notify', s.notify, 'created_at', s.created_at,
      'new_count', (SELECT count(*) FROM public.marketplace_listings l
        WHERE l.status IN ('active', 'reserved') AND (l.expires_at IS NULL OR l.expires_at > now())
          AND l.bumped_at > s.last_viewed_at AND public.market_listing_matches(l, s.filters)))
    ORDER BY s.created_at), '[]'::jsonb)
  FROM public.marketplace_saved_searches s
  WHERE s.user_id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.marketplace_saved_searches_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marketplace_saved_searches_overview() TO authenticated;
