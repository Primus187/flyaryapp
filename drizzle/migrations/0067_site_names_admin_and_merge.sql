-- Stage C (decision 2026-09-28).
-- 1. The app admin curates official names (official_sites.name_override, see 0064). The change reaches
--    every linked place without an own name (trigger official_sites_propagate).
-- 2. A pilot merges two own places into one: every reference moves to the place that stays, then the
--    other one is deleted. The referencing columns are read from the catalogue at run time, so a
--    future table with a place reference is included without touching this function.

CREATE OR REPLACE FUNCTION public.set_official_site_name(_site_id uuid, _name text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin required' USING ERRCODE = '42501';
  END IF;
  UPDATE public.official_sites SET name_override = nullif(btrim(_name), ''), updated_at = now() WHERE id = _site_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown site' USING ERRCODE = 'P0002'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.set_official_site_name(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_official_site_name(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.merge_locations(_keep uuid, _remove uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ref record;
  moved integer := 0;
  n integer;
BEGIN
  IF _keep = _remove THEN RAISE EXCEPTION 'A place cannot be merged into itself' USING ERRCODE = '22023'; END IF;
  IF auth.uid() IS NULL
     OR (SELECT count(*) FROM public.locations WHERE id IN (_keep, _remove) AND user_id = auth.uid()) <> 2 THEN
    RAISE EXCEPTION 'Only own places can be merged' USING ERRCODE = '42501';
  END IF;
  -- Also rows of other people that point at the place (e.g. a student's flight taken from a school day).
  FOR ref IN
    SELECT c.conrelid::regclass AS tbl, a.attname AS col
    FROM pg_constraint c JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
    WHERE c.contype = 'f' AND c.confrelid = 'public.locations'::regclass
  LOOP
    EXECUTE format('UPDATE %s SET %I = $1 WHERE %I = $2', ref.tbl, ref.col, ref.col) USING _keep, _remove;
    GET DIAGNOSTICS n = ROW_COUNT;
    moved := moved + n;
  END LOOP;
  -- Keep notes and wind directions that only the removed place had.
  UPDATE public.locations k SET
    description = coalesce(nullif(btrim(k.description), ''), r.description),
    optimal_wind_directions = CASE WHEN cardinality(k.optimal_wind_directions) = 0 THEN r.optimal_wind_directions ELSE k.optimal_wind_directions END
  FROM public.locations r WHERE k.id = _keep AND r.id = _remove;
  DELETE FROM public.locations WHERE id = _remove;
  RETURN moved;
END $$;
REVOKE ALL ON FUNCTION public.merge_locations(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merge_locations(uuid, uuid) TO authenticated;
