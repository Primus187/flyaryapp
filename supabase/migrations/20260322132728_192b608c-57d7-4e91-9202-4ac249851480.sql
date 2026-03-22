
-- Create pilot_badges table
CREATE TABLE public.pilot_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  badge_key text NOT NULL,
  unlocked_at timestamptz DEFAULT now(),
  UNIQUE(user_id, badge_key)
);
ALTER TABLE public.pilot_badges ENABLE ROW LEVEL SECURITY;

-- RLS: users can view own badges
CREATE POLICY "Users can view own badges" ON public.pilot_badges
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- RLS: group members can view badges
CREATE POLICY "Group members can view badges" ON public.pilot_badges
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM group_members gm1
      JOIN group_members gm2 ON gm1.group_id = gm2.group_id
      WHERE gm1.user_id = auth.uid() AND gm2.user_id = pilot_badges.user_id
    )
  );

-- Trigger function to check and award badges after flight changes
CREATE OR REPLACE FUNCTION public.check_and_award_badges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id uuid;
  _flight_count integer;
  _total_minutes integer;
  _total_altitude integer;
  _total_distance numeric;
  _unique_takeoffs integer;
  _max_duration integer;
  _max_distance numeric;
  _max_altitude integer;
BEGIN
  IF TG_OP = 'DELETE' THEN _user_id := OLD.user_id;
  ELSE _user_id := NEW.user_id; END IF;

  -- Aggregate stats
  SELECT COUNT(*), COALESCE(SUM(duration_minutes),0), COALESCE(SUM(altitude_gain),0),
         COALESCE(SUM(distance_km),0), COUNT(DISTINCT takeoff_location_id),
         COALESCE(MAX(duration_minutes),0), COALESCE(MAX(distance_km),0), COALESCE(MAX(altitude_gain),0)
  INTO _flight_count, _total_minutes, _total_altitude, _total_distance,
       _unique_takeoffs, _max_duration, _max_distance, _max_altitude
  FROM flights WHERE user_id = _user_id;

  -- Flight count badges
  IF _flight_count >= 1 THEN INSERT INTO pilot_badges (user_id, badge_key) VALUES (_user_id, 'first_flight') ON CONFLICT DO NOTHING; END IF;
  IF _flight_count >= 10 THEN INSERT INTO pilot_badges (user_id, badge_key) VALUES (_user_id, 'weekend_warrior') ON CONFLICT DO NOTHING; END IF;
  IF _flight_count >= 50 THEN INSERT INTO pilot_badges (user_id, badge_key) VALUES (_user_id, 'frequent_flyer') ON CONFLICT DO NOTHING; END IF;
  IF _flight_count >= 100 THEN INSERT INTO pilot_badges (user_id, badge_key) VALUES (_user_id, 'century_pilot') ON CONFLICT DO NOTHING; END IF;
  IF _flight_count >= 250 THEN INSERT INTO pilot_badges (user_id, badge_key) VALUES (_user_id, 'sky_addict') ON CONFLICT DO NOTHING; END IF;

  -- Flight time badges (minutes to hours)
  IF _total_minutes >= 60 THEN INSERT INTO pilot_badges (user_id, badge_key) VALUES (_user_id, 'airborne') ON CONFLICT DO NOTHING; END IF;
  IF _total_minutes >= 600 THEN INSERT INTO pilot_badges (user_id, badge_key) VALUES (_user_id, 'day_tripper') ON CONFLICT DO NOTHING; END IF;
  IF _total_minutes >= 3000 THEN INSERT INTO pilot_badges (user_id, badge_key) VALUES (_user_id, 'marathon_pilot') ON CONFLICT DO NOTHING; END IF;
  IF _total_minutes >= 6000 THEN INSERT INTO pilot_badges (user_id, badge_key) VALUES (_user_id, 'time_lord') ON CONFLICT DO NOTHING; END IF;
  IF _total_minutes >= 30000 THEN INSERT INTO pilot_badges (user_id, badge_key) VALUES (_user_id, 'eternal_wings') ON CONFLICT DO NOTHING; END IF;

  -- Altitude badges
  IF _total_altitude >= 1000 THEN INSERT INTO pilot_badges (user_id, badge_key) VALUES (_user_id, 'climber') ON CONFLICT DO NOTHING; END IF;
  IF _total_altitude >= 10000 THEN INSERT INTO pilot_badges (user_id, badge_key) VALUES (_user_id, 'cloud_surfer') ON CONFLICT DO NOTHING; END IF;
  IF _total_altitude >= 50000 THEN INSERT INTO pilot_badges (user_id, badge_key) VALUES (_user_id, 'eagle_eye') ON CONFLICT DO NOTHING; END IF;
  IF _total_altitude >= 100000 THEN INSERT INTO pilot_badges (user_id, badge_key) VALUES (_user_id, 'stratosphere') ON CONFLICT DO NOTHING; END IF;

  -- Distance badges
  IF _total_distance >= 50 THEN INSERT INTO pilot_badges (user_id, badge_key) VALUES (_user_id, 'explorer') ON CONFLICT DO NOTHING; END IF;
  IF _total_distance >= 200 THEN INSERT INTO pilot_badges (user_id, badge_key) VALUES (_user_id, 'cross_country') ON CONFLICT DO NOTHING; END IF;
  IF _total_distance >= 500 THEN INSERT INTO pilot_badges (user_id, badge_key) VALUES (_user_id, 'long_distance') ON CONFLICT DO NOTHING; END IF;
  IF _total_distance >= 1000 THEN INSERT INTO pilot_badges (user_id, badge_key) VALUES (_user_id, 'globe_trotter') ON CONFLICT DO NOTHING; END IF;

  -- Takeoff variety badges
  IF _unique_takeoffs >= 5 THEN INSERT INTO pilot_badges (user_id, badge_key) VALUES (_user_id, 'trailblazer') ON CONFLICT DO NOTHING; END IF;
  IF _unique_takeoffs >= 15 THEN INSERT INTO pilot_badges (user_id, badge_key) VALUES (_user_id, 'nomad') ON CONFLICT DO NOTHING; END IF;
  IF _unique_takeoffs >= 30 THEN INSERT INTO pilot_badges (user_id, badge_key) VALUES (_user_id, 'world_pilot') ON CONFLICT DO NOTHING; END IF;

  -- Single flight record badges
  IF _max_duration >= 120 THEN INSERT INTO pilot_badges (user_id, badge_key) VALUES (_user_id, 'thermik_king') ON CONFLICT DO NOTHING; END IF;
  IF _max_distance >= 50 THEN INSERT INTO pilot_badges (user_id, badge_key) VALUES (_user_id, 'xc_beast') ON CONFLICT DO NOTHING; END IF;
  IF _max_altitude >= 2000 THEN INSERT INTO pilot_badges (user_id, badge_key) VALUES (_user_id, 'high_flyer') ON CONFLICT DO NOTHING; END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- Create trigger on flights
CREATE TRIGGER check_badges_after_flight
  AFTER INSERT OR UPDATE OR DELETE ON public.flights
  FOR EACH ROW EXECUTE FUNCTION public.check_and_award_badges();
