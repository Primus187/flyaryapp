-- Place names as the viewer sees them (decision 2026-09-28, stage B). A place of someone else that is
-- linked to an official site shows the viewer's own name for that site, otherwise the official name;
-- nobody sees another pilot's private name for an official site. Own places and places without a
-- link keep their name. Usable in SQL and as PostgREST computed field: locations(name:display_name).

CREATE OR REPLACE FUNCTION public.official_name(l public.locations)
RETURNS text LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT CASE
    WHEN l.official_site_id IS NULL THEN l.name
    ELSE coalesce(
      (SELECT coalesce(nullif(btrim(s.name_override), ''), s.name_de) FROM public.official_sites s WHERE s.id = l.official_site_id),
      l.name)
  END
$$;

CREATE OR REPLACE FUNCTION public.display_name(l public.locations)
RETURNS text LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT CASE
    WHEN l.official_site_id IS NULL OR l.user_id = auth.uid() THEN l.name
    ELSE coalesce(
      (SELECT o.name FROM public.locations o
        WHERE o.user_id = auth.uid() AND o.official_site_id = l.official_site_id
        ORDER BY o.created_at, o.id LIMIT 1),
      public.official_name(l))
  END
$$;

CREATE INDEX IF NOT EXISTS locations_user_official_site_idx
  ON public.locations (user_id, official_site_id) WHERE official_site_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
