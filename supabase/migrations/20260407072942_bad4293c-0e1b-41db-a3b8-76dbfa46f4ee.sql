
-- ============================================
-- 1. PUSH SUBSCRIPTIONS TABLE
-- ============================================
CREATE TABLE public.push_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  endpoint text NOT NULL,
  keys_p256dh text NOT NULL,
  keys_auth text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscriptions"
  ON public.push_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscriptions"
  ON public.push_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own subscriptions"
  ON public.push_subscriptions FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- 2. PILOT GOALS TABLE
-- ============================================
CREATE TABLE public.pilot_goals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  title text NOT NULL,
  goal_type text NOT NULL DEFAULT 'flights',
  target_value numeric NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT '',
  season_year integer NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.pilot_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own goals"
  ON public.pilot_goals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own goals"
  ON public.pilot_goals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own goals"
  ON public.pilot_goals FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own goals"
  ON public.pilot_goals FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_pilot_goals_updated_at
  BEFORE UPDATE ON public.pilot_goals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 3. FOLLOWS TABLE
-- ============================================
CREATE TABLE public.follows (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id uuid NOT NULL,
  following_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (follower_id, following_id),
  CONSTRAINT no_self_follow CHECK (follower_id != following_id)
);

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view follows"
  ON public.follows FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can follow others"
  ON public.follows FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can unfollow"
  ON public.follows FOR DELETE
  TO authenticated
  USING (auth.uid() = follower_id);

-- ============================================
-- 4. RLS: Followers can see published flights
-- ============================================
CREATE POLICY "Followers can view published flights"
  ON public.flights FOR SELECT
  TO authenticated
  USING (
    published_to_feed = true
    AND EXISTS (
      SELECT 1 FROM public.follows
      WHERE follower_id = auth.uid() AND following_id = flights.user_id
    )
  );

-- Followers can view photos of published flights
CREATE POLICY "Followers can view published flight photos"
  ON public.flight_photos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.flights f
      JOIN public.follows fo ON fo.following_id = f.user_id
      WHERE f.id = flight_photos.flight_id
        AND f.published_to_feed = true
        AND fo.follower_id = auth.uid()
    )
  );

-- Followers can view likes on published flights
CREATE POLICY "Followers can view published flight likes"
  ON public.feed_likes FOR SELECT
  TO authenticated
  USING (
    flight_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.flights f
      JOIN public.follows fo ON fo.following_id = f.user_id
      WHERE f.id = feed_likes.flight_id
        AND f.published_to_feed = true
        AND fo.follower_id = auth.uid()
    )
  );

-- Followers can like published flights
CREATE POLICY "Followers can like published flights"
  ON public.feed_likes FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND flight_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.flights f
      JOIN public.follows fo ON fo.following_id = f.user_id
      WHERE f.id = feed_likes.flight_id
        AND f.published_to_feed = true
        AND fo.follower_id = auth.uid()
    )
  );

-- Followers can view comments on published flights
CREATE POLICY "Followers can view published flight comments"
  ON public.feed_comments FOR SELECT
  TO authenticated
  USING (
    flight_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.flights f
      JOIN public.follows fo ON fo.following_id = f.user_id
      WHERE f.id = feed_comments.flight_id
        AND f.published_to_feed = true
        AND fo.follower_id = auth.uid()
    )
  );

-- Followers can comment on published flights
CREATE POLICY "Followers can comment on published flights"
  ON public.feed_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND flight_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.flights f
      JOIN public.follows fo ON fo.following_id = f.user_id
      WHERE f.id = feed_comments.flight_id
        AND f.published_to_feed = true
        AND fo.follower_id = auth.uid()
    )
  );

-- Followers can view profiles of people they follow
CREATE POLICY "Followers can view followed profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.follows
      WHERE follower_id = auth.uid() AND following_id = profiles.user_id
    )
  );

-- ============================================
-- 5. TRIGGER: notify on follow
-- ============================================
CREATE OR REPLACE FUNCTION public.notify_on_follow()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO notifications (user_id, actor_id, type, reference_id, reference_type)
  VALUES (NEW.following_id, NEW.follower_id, 'follow', NEW.id, 'follow');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_follow_notify
  AFTER INSERT ON public.follows
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_follow();
