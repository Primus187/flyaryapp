
ALTER TABLE public.challenge_goals
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS radius_meters integer NOT NULL DEFAULT 400,
  ADD COLUMN IF NOT EXISTS goal_type text NOT NULL DEFAULT 'waypoint';
