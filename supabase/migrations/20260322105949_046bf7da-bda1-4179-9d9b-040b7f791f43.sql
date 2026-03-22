-- pilot_xp table
CREATE TABLE public.pilot_xp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_xp integer NOT NULL DEFAULT 0,
  level integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.pilot_xp ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own xp" ON public.pilot_xp
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Group members can view xp" ON public.pilot_xp
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM group_members gm1
    JOIN group_members gm2 ON gm1.group_id = gm2.group_id
    WHERE gm1.user_id = auth.uid() AND gm2.user_id = pilot_xp.user_id
  ));

CREATE OR REPLACE FUNCTION public.recalculate_pilot_xp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid;
  _total_xp integer;
  _level integer;
BEGIN
  IF TG_OP = 'DELETE' THEN _user_id := OLD.user_id;
  ELSE _user_id := NEW.user_id; END IF;

  SELECT COALESCE(SUM(
    COALESCE(duration_minutes, 0) * 2 +
    ROUND(COALESCE(altitude_gain, 0) * 0.5) +
    ROUND(COALESCE(distance_km, 0) * 10)
  ), 0)::integer INTO _total_xp FROM flights WHERE user_id = _user_id;

  _level := CASE
    WHEN _total_xp < 100 THEN 1 WHEN _total_xp < 300 THEN 2
    WHEN _total_xp < 600 THEN 3 WHEN _total_xp < 1000 THEN 4
    WHEN _total_xp < 1500 THEN 5 WHEN _total_xp < 2500 THEN 6
    WHEN _total_xp < 4000 THEN 7 WHEN _total_xp < 6000 THEN 8
    WHEN _total_xp < 9000 THEN 9 WHEN _total_xp < 13000 THEN 10
    WHEN _total_xp < 18000 THEN 11 WHEN _total_xp < 25000 THEN 12
    ELSE 13 END;

  INSERT INTO pilot_xp (user_id, total_xp, level, updated_at)
  VALUES (_user_id, _total_xp, _level, now())
  ON CONFLICT (user_id) DO UPDATE SET
    total_xp = EXCLUDED.total_xp, level = EXCLUDED.level, updated_at = now();

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

CREATE TRIGGER trg_recalculate_xp
AFTER INSERT OR UPDATE OR DELETE ON public.flights
FOR EACH ROW EXECUTE FUNCTION public.recalculate_pilot_xp();

INSERT INTO pilot_xp (user_id, total_xp, level)
SELECT f.user_id,
  COALESCE(SUM(COALESCE(f.duration_minutes,0)*2 + ROUND(COALESCE(f.altitude_gain,0)*0.5) + ROUND(COALESCE(f.distance_km,0)*10)),0)::integer,
  CASE
    WHEN COALESCE(SUM(COALESCE(f.duration_minutes,0)*2+ROUND(COALESCE(f.altitude_gain,0)*0.5)+ROUND(COALESCE(f.distance_km,0)*10)),0) < 100 THEN 1
    WHEN COALESCE(SUM(COALESCE(f.duration_minutes,0)*2+ROUND(COALESCE(f.altitude_gain,0)*0.5)+ROUND(COALESCE(f.distance_km,0)*10)),0) < 300 THEN 2
    WHEN COALESCE(SUM(COALESCE(f.duration_minutes,0)*2+ROUND(COALESCE(f.altitude_gain,0)*0.5)+ROUND(COALESCE(f.distance_km,0)*10)),0) < 600 THEN 3
    WHEN COALESCE(SUM(COALESCE(f.duration_minutes,0)*2+ROUND(COALESCE(f.altitude_gain,0)*0.5)+ROUND(COALESCE(f.distance_km,0)*10)),0) < 1000 THEN 4
    WHEN COALESCE(SUM(COALESCE(f.duration_minutes,0)*2+ROUND(COALESCE(f.altitude_gain,0)*0.5)+ROUND(COALESCE(f.distance_km,0)*10)),0) < 1500 THEN 5
    WHEN COALESCE(SUM(COALESCE(f.duration_minutes,0)*2+ROUND(COALESCE(f.altitude_gain,0)*0.5)+ROUND(COALESCE(f.distance_km,0)*10)),0) < 2500 THEN 6
    WHEN COALESCE(SUM(COALESCE(f.duration_minutes,0)*2+ROUND(COALESCE(f.altitude_gain,0)*0.5)+ROUND(COALESCE(f.distance_km,0)*10)),0) < 4000 THEN 7
    WHEN COALESCE(SUM(COALESCE(f.duration_minutes,0)*2+ROUND(COALESCE(f.altitude_gain,0)*0.5)+ROUND(COALESCE(f.distance_km,0)*10)),0) < 6000 THEN 8
    WHEN COALESCE(SUM(COALESCE(f.duration_minutes,0)*2+ROUND(COALESCE(f.altitude_gain,0)*0.5)+ROUND(COALESCE(f.distance_km,0)*10)),0) < 9000 THEN 9
    WHEN COALESCE(SUM(COALESCE(f.duration_minutes,0)*2+ROUND(COALESCE(f.altitude_gain,0)*0.5)+ROUND(COALESCE(f.distance_km,0)*10)),0) < 13000 THEN 10
    WHEN COALESCE(SUM(COALESCE(f.duration_minutes,0)*2+ROUND(COALESCE(f.altitude_gain,0)*0.5)+ROUND(COALESCE(f.distance_km,0)*10)),0) < 18000 THEN 11
    WHEN COALESCE(SUM(COALESCE(f.duration_minutes,0)*2+ROUND(COALESCE(f.altitude_gain,0)*0.5)+ROUND(COALESCE(f.distance_km,0)*10)),0) < 25000 THEN 12
    ELSE 13 END
FROM flights f GROUP BY f.user_id
ON CONFLICT (user_id) DO UPDATE SET total_xp = EXCLUDED.total_xp, level = EXCLUDED.level, updated_at = now();