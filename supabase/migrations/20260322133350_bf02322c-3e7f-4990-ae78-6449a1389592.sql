
-- Helper function for badge checking
CREATE OR REPLACE FUNCTION public.check_and_award_badges_for_user(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _flight_count integer;
  _total_minutes integer;
  _total_altitude integer;
  _total_distance numeric;
  _unique_takeoffs integer;
  _max_duration integer;
  _max_distance numeric;
  _max_altitude integer;
  _seasonal_count integer;
  _year integer;
  _yearly_count integer;
BEGIN
  SELECT COUNT(*), COALESCE(SUM(duration_minutes),0), COALESCE(SUM(altitude_gain),0),
         COALESCE(SUM(distance_km),0), COUNT(DISTINCT takeoff_location_id),
         COALESCE(MAX(duration_minutes),0), COALESCE(MAX(distance_km),0), COALESCE(MAX(altitude_gain),0)
  INTO _flight_count, _total_minutes, _total_altitude, _total_distance,
       _unique_takeoffs, _max_duration, _max_distance, _max_altitude
  FROM flights WHERE user_id = _user_id;

  IF _flight_count >= 1 THEN INSERT INTO pilot_badges (user_id, badge_key) VALUES (_user_id, 'first_flight') ON CONFLICT DO NOTHING; END IF;
  IF _flight_count >= 10 THEN INSERT INTO pilot_badges (user_id, badge_key) VALUES (_user_id, 'weekend_warrior') ON CONFLICT DO NOTHING; END IF;
  IF _flight_count >= 50 THEN INSERT INTO pilot_badges (user_id, badge_key) VALUES (_user_id, 'frequent_flyer') ON CONFLICT DO NOTHING; END IF;
  IF _flight_count >= 100 THEN INSERT INTO pilot_badges (user_id, badge_key) VALUES (_user_id, 'century_pilot') ON CONFLICT DO NOTHING; END IF;
  IF _flight_count >= 250 THEN INSERT INTO pilot_badges (user_id, badge_key) VALUES (_user_id, 'sky_addict') ON CONFLICT DO NOTHING; END IF;

  IF _total_minutes >= 60 THEN INSERT INTO pilot_badges (user_id, badge_key) VALUES (_user_id, 'airborne') ON CONFLICT DO NOTHING; END IF;
  IF _total_minutes >= 600 THEN INSERT INTO pilot_badges (user_id, badge_key) VALUES (_user_id, 'day_tripper') ON CONFLICT DO NOTHING; END IF;
  IF _total_minutes >= 3000 THEN INSERT INTO pilot_badges (user_id, badge_key) VALUES (_user_id, 'marathon_pilot') ON CONFLICT DO NOTHING; END IF;
  IF _total_minutes >= 6000 THEN INSERT INTO pilot_badges (user_id, badge_key) VALUES (_user_id, 'time_lord') ON CONFLICT DO NOTHING; END IF;
  IF _total_minutes >= 30000 THEN INSERT INTO pilot_badges (user_id, badge_key) VALUES (_user_id, 'eternal_wings') ON CONFLICT DO NOTHING; END IF;

  IF _total_altitude >= 1000 THEN INSERT INTO pilot_badges (user_id, badge_key) VALUES (_user_id, 'climber') ON CONFLICT DO NOTHING; END IF;
  IF _total_altitude >= 10000 THEN INSERT INTO pilot_badges (user_id, badge_key) VALUES (_user_id, 'cloud_surfer') ON CONFLICT DO NOTHING; END IF;
  IF _total_altitude >= 50000 THEN INSERT INTO pilot_badges (user_id, badge_key) VALUES (_user_id, 'eagle_eye') ON CONFLICT DO NOTHING; END IF;
  IF _total_altitude >= 100000 THEN INSERT INTO pilot_badges (user_id, badge_key) VALUES (_user_id, 'stratosphere') ON CONFLICT DO NOTHING; END IF;

  IF _total_distance >= 50 THEN INSERT INTO pilot_badges (user_id, badge_key) VALUES (_user_id, 'explorer') ON CONFLICT DO NOTHING; END IF;
  IF _total_distance >= 200 THEN INSERT INTO pilot_badges (user_id, badge_key) VALUES (_user_id, 'cross_country') ON CONFLICT DO NOTHING; END IF;
  IF _total_distance >= 500 THEN INSERT INTO pilot_badges (user_id, badge_key) VALUES (_user_id, 'long_distance') ON CONFLICT DO NOTHING; END IF;
  IF _total_distance >= 1000 THEN INSERT INTO pilot_badges (user_id, badge_key) VALUES (_user_id, 'globe_trotter') ON CONFLICT DO NOTHING; END IF;

  IF _unique_takeoffs >= 5 THEN INSERT INTO pilot_badges (user_id, badge_key) VALUES (_user_id, 'trailblazer') ON CONFLICT DO NOTHING; END IF;
  IF _unique_takeoffs >= 15 THEN INSERT INTO pilot_badges (user_id, badge_key) VALUES (_user_id, 'nomad') ON CONFLICT DO NOTHING; END IF;
  IF _unique_takeoffs >= 30 THEN INSERT INTO pilot_badges (user_id, badge_key) VALUES (_user_id, 'world_pilot') ON CONFLICT DO NOTHING; END IF;

  IF _max_duration >= 120 THEN INSERT INTO pilot_badges (user_id, badge_key) VALUES (_user_id, 'thermik_king') ON CONFLICT DO NOTHING; END IF;
  IF _max_distance >= 50 THEN INSERT INTO pilot_badges (user_id, badge_key) VALUES (_user_id, 'xc_beast') ON CONFLICT DO NOTHING; END IF;
  IF _max_altitude >= 2000 THEN INSERT INTO pilot_badges (user_id, badge_key) VALUES (_user_id, 'high_flyer') ON CONFLICT DO NOTHING; END IF;

  -- Seasonal: Summer pilot (20 flights Jun-Aug)
  SELECT COUNT(*) INTO _seasonal_count FROM flights WHERE user_id = _user_id AND date >= '2025-06-01' AND date <= '2025-08-31';
  IF _seasonal_count >= 20 THEN INSERT INTO pilot_badges (user_id, badge_key) VALUES (_user_id, 'summer_pilot_2025') ON CONFLICT DO NOTHING; END IF;
  SELECT COUNT(*) INTO _seasonal_count FROM flights WHERE user_id = _user_id AND date >= '2026-06-01' AND date <= '2026-08-31';
  IF _seasonal_count >= 20 THEN INSERT INTO pilot_badges (user_id, badge_key) VALUES (_user_id, 'summer_pilot_2026') ON CONFLICT DO NOTHING; END IF;

  -- Seasonal: Winter eagle (10 flights Dec-Feb)
  SELECT COUNT(*) INTO _seasonal_count FROM flights WHERE user_id = _user_id AND date >= '2024-12-01' AND date <= '2025-02-28';
  IF _seasonal_count >= 10 THEN INSERT INTO pilot_badges (user_id, badge_key) VALUES (_user_id, 'winter_eagle_2025') ON CONFLICT DO NOTHING; END IF;
  SELECT COUNT(*) INTO _seasonal_count FROM flights WHERE user_id = _user_id AND date >= '2025-12-01' AND date <= '2026-02-28';
  IF _seasonal_count >= 10 THEN INSERT INTO pilot_badges (user_id, badge_key) VALUES (_user_id, 'winter_eagle_2026') ON CONFLICT DO NOTHING; END IF;

  -- Year-round pilot
  FOR _year IN 2024..2026 LOOP
    SELECT COUNT(DISTINCT EXTRACT(MONTH FROM date)) INTO _yearly_count
    FROM flights WHERE user_id = _user_id AND EXTRACT(YEAR FROM date) = _year;
    IF _yearly_count >= 12 THEN
      INSERT INTO pilot_badges (user_id, badge_key) VALUES (_user_id, 'year_round_' || _year) ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END;
$$;

-- Update trigger to use the helper
CREATE OR REPLACE FUNCTION public.check_and_award_badges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM check_and_award_badges_for_user(OLD.user_id);
    RETURN OLD;
  ELSE
    PERFORM check_and_award_badges_for_user(NEW.user_id);
    RETURN NEW;
  END IF;
END;
$$;

-- Backfill all existing users
DO $$
DECLARE
  _uid uuid;
BEGIN
  FOR _uid IN SELECT DISTINCT user_id FROM flights
  LOOP
    PERFORM check_and_award_badges_for_user(_uid);
  END LOOP;
END;
$$;
