-- Take-off/landing sites were readable only by their owner, so flights of other pilots showed no
-- site in the feed, the school dossier and the coach views. A site is now also readable when it is
-- used by a flight the viewer may see; which flights that are is still decided by the flights
-- policies (own, same group, published + followed), because the subquery runs under the viewer's
-- RLS. Sites that are used in no visible flight stay private.
CREATE INDEX IF NOT EXISTS idx_flights_takeoff_location ON public.flights(takeoff_location_id);
CREATE INDEX IF NOT EXISTS idx_flights_landing_location ON public.flights(landing_location_id);

DROP POLICY IF EXISTS "Sites of visible flights are readable" ON public.locations;
CREATE POLICY "Sites of visible flights are readable" ON public.locations
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.flights f WHERE f.takeoff_location_id = locations.id)
    OR EXISTS (SELECT 1 FROM public.flights f WHERE f.landing_location_id = locations.id)
  );
