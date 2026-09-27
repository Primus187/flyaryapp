-- Official takeoff/landing sites (catalogue from the DHV site database, Switzerland first).
-- Pilots keep their own places in public.locations; a place linked to an official site carries its
-- fixed name, type and position, so every pilot names the same site the same way. Places without a
-- link stay the pilot's own and remain freely editable. Filled by scripts/import-official-sites.mjs.

CREATE TABLE IF NOT EXISTS public.official_sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT 'dhv',
  source_id text NOT NULL,
  area_name text,
  name_de text NOT NULL,
  name_fr text NOT NULL,
  name_en text NOT NULL,
  type public.location_type NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  altitude integer,
  country_code text NOT NULL,
  region text,
  municipality text,
  wind_directions text[] NOT NULL DEFAULT '{}',
  paragliding boolean NOT NULL DEFAULT true,
  hanggliding boolean NOT NULL DEFAULT false,
  source_url text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, source_id)
);
CREATE INDEX IF NOT EXISTS official_sites_country_idx ON public.official_sites (country_code) WHERE active;

ALTER TABLE public.official_sites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Signed-in users read official sites" ON public.official_sites;
CREATE POLICY "Signed-in users read official sites" ON public.official_sites FOR SELECT TO authenticated USING (true);
-- Read-only for the app; only the import (service role / Management API) writes.
REVOKE ALL ON public.official_sites FROM anon, authenticated;
GRANT SELECT ON public.official_sites TO authenticated;

ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS official_site_id uuid REFERENCES public.official_sites(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS locations_official_site_idx ON public.locations (official_site_id) WHERE official_site_id IS NOT NULL;

-- A linked place always carries the site's fixed data; what the client sends for these columns is
-- overwritten. The pilot's own notes (description) and wind choice stay theirs.
CREATE OR REPLACE FUNCTION public.sync_location_from_official_site()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE s public.official_sites;
BEGIN
  IF NEW.official_site_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO s FROM public.official_sites WHERE id = NEW.official_site_id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  NEW.name := s.name_de;
  NEW.type := s.type;
  NEW.latitude := s.latitude;
  NEW.longitude := s.longitude;
  NEW.altitude := s.altitude;
  NEW.country_code := s.country_code;
  IF coalesce(cardinality(NEW.optimal_wind_directions), 0) = 0 THEN
    NEW.optimal_wind_directions := s.wind_directions;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS locations_official_site_sync ON public.locations;
CREATE TRIGGER locations_official_site_sync
  BEFORE INSERT OR UPDATE ON public.locations
  FOR EACH ROW EXECUTE FUNCTION public.sync_location_from_official_site();

-- A re-import that renames or moves a site carries the change to every linked place.
CREATE OR REPLACE FUNCTION public.propagate_official_site()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (NEW.name_de, NEW.type, NEW.latitude, NEW.longitude, NEW.altitude, NEW.country_code)
     IS DISTINCT FROM (OLD.name_de, OLD.type, OLD.latitude, OLD.longitude, OLD.altitude, OLD.country_code) THEN
    UPDATE public.locations SET updated_at = now() WHERE official_site_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.propagate_official_site() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS official_sites_propagate ON public.official_sites;
CREATE TRIGGER official_sites_propagate
  AFTER UPDATE ON public.official_sites
  FOR EACH ROW EXECUTE FUNCTION public.propagate_official_site();
