
-- 1. Create feed_achievements table
CREATE TABLE public.feed_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge_id uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  goal_id uuid REFERENCES public.challenge_goals(id) ON DELETE CASCADE,
  achievement_type text NOT NULL DEFAULT 'goal_reached',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.feed_achievements ENABLE ROW LEVEL SECURITY;

-- RLS: Group members can view achievements
CREATE POLICY "Group members can view achievements" ON public.feed_achievements
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM challenges c
  JOIN group_members gm ON gm.group_id = c.group_id
  WHERE c.id = feed_achievements.challenge_id AND gm.user_id = auth.uid()
));

-- RLS: Users can insert own achievements
CREATE POLICY "Users can insert own achievements" ON public.feed_achievements
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 2. Extend feed_likes: make flight_id nullable, add event_id and achievement_id
ALTER TABLE public.feed_likes ALTER COLUMN flight_id DROP NOT NULL;
ALTER TABLE public.feed_likes ADD COLUMN event_id uuid REFERENCES public.flight_events(id) ON DELETE CASCADE;
ALTER TABLE public.feed_likes ADD COLUMN achievement_id uuid REFERENCES public.feed_achievements(id) ON DELETE CASCADE;

-- Constraint: exactly one of flight_id, event_id, achievement_id must be set
ALTER TABLE public.feed_likes ADD CONSTRAINT feed_likes_one_target
CHECK (num_nonnulls(flight_id, event_id, achievement_id) = 1);

-- 3. Extend feed_comments: make flight_id nullable, add event_id and achievement_id
ALTER TABLE public.feed_comments ALTER COLUMN flight_id DROP NOT NULL;
ALTER TABLE public.feed_comments ADD COLUMN event_id uuid REFERENCES public.flight_events(id) ON DELETE CASCADE;
ALTER TABLE public.feed_comments ADD COLUMN achievement_id uuid REFERENCES public.feed_achievements(id) ON DELETE CASCADE;

ALTER TABLE public.feed_comments ADD CONSTRAINT feed_comments_one_target
CHECK (num_nonnulls(flight_id, event_id, achievement_id) = 1);

-- 4. Additional RLS for event likes/comments
CREATE POLICY "Members can view event likes" ON public.feed_likes
FOR SELECT TO authenticated
USING (event_id IS NOT NULL AND EXISTS (
  SELECT 1 FROM flight_events fe
  JOIN group_members gm ON gm.group_id = fe.group_id
  WHERE fe.id = feed_likes.event_id AND gm.user_id = auth.uid()
));

CREATE POLICY "Members can like events" ON public.feed_likes
FOR INSERT TO authenticated
WITH CHECK (event_id IS NOT NULL AND auth.uid() = user_id AND EXISTS (
  SELECT 1 FROM flight_events fe
  JOIN group_members gm ON gm.group_id = fe.group_id
  WHERE fe.id = feed_likes.event_id AND gm.user_id = auth.uid()
));

CREATE POLICY "Members can view achievement likes" ON public.feed_likes
FOR SELECT TO authenticated
USING (achievement_id IS NOT NULL AND EXISTS (
  SELECT 1 FROM feed_achievements fa
  JOIN challenges c ON c.id = fa.challenge_id
  JOIN group_members gm ON gm.group_id = c.group_id
  WHERE fa.id = feed_likes.achievement_id AND gm.user_id = auth.uid()
));

CREATE POLICY "Members can like achievements" ON public.feed_likes
FOR INSERT TO authenticated
WITH CHECK (achievement_id IS NOT NULL AND auth.uid() = user_id AND EXISTS (
  SELECT 1 FROM feed_achievements fa
  JOIN challenges c ON c.id = fa.challenge_id
  JOIN group_members gm ON gm.group_id = c.group_id
  WHERE fa.id = feed_likes.achievement_id AND gm.user_id = auth.uid()
));

-- Event comments RLS
CREATE POLICY "Members can view event comments" ON public.feed_comments
FOR SELECT TO authenticated
USING (event_id IS NOT NULL AND EXISTS (
  SELECT 1 FROM flight_events fe
  JOIN group_members gm ON gm.group_id = fe.group_id
  WHERE fe.id = feed_comments.event_id AND gm.user_id = auth.uid()
));

CREATE POLICY "Members can comment on events" ON public.feed_comments
FOR INSERT TO authenticated
WITH CHECK (event_id IS NOT NULL AND auth.uid() = user_id AND EXISTS (
  SELECT 1 FROM flight_events fe
  JOIN group_members gm ON gm.group_id = fe.group_id
  WHERE fe.id = feed_comments.event_id AND gm.user_id = auth.uid()
));

-- Achievement comments RLS
CREATE POLICY "Members can view achievement comments" ON public.feed_comments
FOR SELECT TO authenticated
USING (achievement_id IS NOT NULL AND EXISTS (
  SELECT 1 FROM feed_achievements fa
  JOIN challenges c ON c.id = fa.challenge_id
  JOIN group_members gm ON gm.group_id = c.group_id
  WHERE fa.id = feed_comments.achievement_id AND gm.user_id = auth.uid()
));

CREATE POLICY "Members can comment on achievements" ON public.feed_comments
FOR INSERT TO authenticated
WITH CHECK (achievement_id IS NOT NULL AND auth.uid() = user_id AND EXISTS (
  SELECT 1 FROM feed_achievements fa
  JOIN challenges c ON c.id = fa.challenge_id
  JOIN group_members gm ON gm.group_id = c.group_id
  WHERE fa.id = feed_comments.achievement_id AND gm.user_id = auth.uid()
));
