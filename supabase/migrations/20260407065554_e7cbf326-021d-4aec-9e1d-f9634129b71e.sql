
-- 1) Server-side stats aggregation function
CREATE OR REPLACE FUNCTION public.get_pilot_stats(_user_id uuid, _year integer DEFAULT NULL)
RETURNS TABLE(
  total_flights bigint,
  total_minutes bigint,
  unique_takeoffs bigint,
  unique_landings bigint,
  total_altitude bigint,
  total_distance numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*)::bigint,
    COALESCE(SUM(duration_minutes), 0)::bigint,
    COUNT(DISTINCT takeoff_location_id)::bigint,
    COUNT(DISTINCT landing_location_id)::bigint,
    COALESCE(SUM(altitude_gain), 0)::bigint,
    COALESCE(SUM(distance_km), 0)::numeric
  FROM public.flights
  WHERE user_id = _user_id
    AND (_year IS NULL OR EXTRACT(YEAR FROM date) = _year);
$$;

-- 2) Add reaction_type to feed_likes
ALTER TABLE public.feed_likes ADD COLUMN IF NOT EXISTS reaction_type text NOT NULL DEFAULT 'heart';

-- Drop old unique constraints if any, then add new ones
-- We need unique per (user_id, flight_id, reaction_type) etc.
CREATE UNIQUE INDEX IF NOT EXISTS feed_likes_user_flight_reaction_idx 
  ON public.feed_likes (user_id, flight_id, reaction_type) WHERE flight_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS feed_likes_user_event_reaction_idx 
  ON public.feed_likes (user_id, event_id, reaction_type) WHERE event_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS feed_likes_user_achievement_reaction_idx 
  ON public.feed_likes (user_id, achievement_id, reaction_type) WHERE achievement_id IS NOT NULL;
