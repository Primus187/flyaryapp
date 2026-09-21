-- Abschnitt 7.3: Fluggebiets-Wetter-Matching
--
-- Nur die vom Plan selbst benannte Spalte wird ergänzt (optimal_wind_directions); shv_approved,
-- wind_sock und usage_permission_ref aus der ursprünglichen §3-Datenmodell-Zeile gehören zu
-- anderen, noch nicht beauftragten Akzeptanzkriterien ausserhalb von 7.3 und werden hier bewusst
-- nicht mitgebaut. Keine neue RLS-Policy nötig: locations hat bereits eine reine
-- Eigentümer-Policy (auth.uid() = user_id), die automatisch auch für die neue Spalte gilt.

ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS optimal_wind_directions text[] NOT NULL DEFAULT '{}';
