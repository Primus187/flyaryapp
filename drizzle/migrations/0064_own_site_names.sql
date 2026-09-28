-- Own names for official sites (decision 2026-09-28). A site is identified by official_site_id; its
-- name is only a label. Every pilot may name a linked place as they like (locations.custom_name);
-- without an own name the place carries the official Flyary name. Type and position stay fixed.
-- The official name is derived from the DHV name by the import (source_name keeps the DHV original);
-- name_override lets the app admin set a better official name that no import overwrites.

ALTER TABLE public.official_sites
  ADD COLUMN IF NOT EXISTS source_name text,
  ADD COLUMN IF NOT EXISTS name_override text;
UPDATE public.official_sites SET source_name = name_de WHERE source_name IS NULL;

ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS custom_name text;

CREATE OR REPLACE FUNCTION public.sync_location_from_official_site()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  s public.official_sites;
  official text;
BEGIN
  IF NEW.official_site_id IS NULL THEN
    NEW.custom_name := NULL;
    RETURN NEW;
  END IF;
  SELECT * INTO s FROM public.official_sites WHERE id = NEW.official_site_id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  official := coalesce(nullif(btrim(s.name_override), ''), s.name_de);

  IF TG_OP = 'UPDATE' THEN
    IF OLD.official_site_id IS NULL AND NEW.custom_name IS NULL THEN
      -- Linking an existing own place keeps the pilot's name.
      NEW.custom_name := OLD.name;
    ELSIF NEW.name IS DISTINCT FROM OLD.name AND NEW.custom_name IS NOT DISTINCT FROM OLD.custom_name THEN
      -- Renamed through the name column (the app's normal edit).
      NEW.custom_name := NEW.name;
    END IF;
  END IF;
  -- Setting custom_name to NULL (or to the official name) goes back to the official name.
  NEW.custom_name := nullif(btrim(NEW.custom_name), '');
  IF NEW.custom_name = official THEN NEW.custom_name := NULL; END IF;

  NEW.name := coalesce(NEW.custom_name, official);
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

-- Official renames (import or admin) reach every linked place without an own name.
CREATE OR REPLACE FUNCTION public.propagate_official_site()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (NEW.name_de, NEW.name_override, NEW.type, NEW.latitude, NEW.longitude, NEW.altitude, NEW.country_code)
     IS DISTINCT FROM (OLD.name_de, OLD.name_override, OLD.type, OLD.latitude, OLD.longitude, OLD.altitude, OLD.country_code) THEN
    UPDATE public.locations SET updated_at = now() WHERE official_site_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.propagate_official_site() FROM PUBLIC, anon, authenticated;
