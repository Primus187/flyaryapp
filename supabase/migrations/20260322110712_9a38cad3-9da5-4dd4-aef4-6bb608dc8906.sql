-- Challenges table
CREATE TABLE public.challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  challenge_type text NOT NULL DEFAULT 'location_hunt',
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Group members can view challenges" ON public.challenges
  FOR SELECT TO authenticated
  USING (is_group_member(auth.uid(), group_id));

CREATE POLICY "Group admins can create challenges" ON public.challenges
  FOR INSERT TO authenticated
  WITH CHECK (is_group_admin(auth.uid(), group_id) AND auth.uid() = created_by);

CREATE POLICY "Group admins can update challenges" ON public.challenges
  FOR UPDATE TO authenticated
  USING (is_group_admin(auth.uid(), group_id));

CREATE POLICY "Group admins can delete challenges" ON public.challenges
  FOR DELETE TO authenticated
  USING (is_group_admin(auth.uid(), group_id));

-- Challenge goals (locations to visit)
CREATE TABLE public.challenge_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  label text,
  points integer NOT NULL DEFAULT 10,
  sort_order integer NOT NULL DEFAULT 0
);

ALTER TABLE public.challenge_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Group members can view challenge goals" ON public.challenge_goals
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM challenges c WHERE c.id = challenge_goals.challenge_id AND is_group_member(auth.uid(), c.group_id)
  ));

CREATE POLICY "Group admins can manage challenge goals" ON public.challenge_goals
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM challenges c WHERE c.id = challenge_goals.challenge_id AND is_group_admin(auth.uid(), c.group_id)
  ));

CREATE POLICY "Group admins can update challenge goals" ON public.challenge_goals
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM challenges c WHERE c.id = challenge_goals.challenge_id AND is_group_admin(auth.uid(), c.group_id)
  ));

CREATE POLICY "Group admins can delete challenge goals" ON public.challenge_goals
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM challenges c WHERE c.id = challenge_goals.challenge_id AND is_group_admin(auth.uid(), c.group_id)
  ));

-- Challenge progress
CREATE TABLE public.challenge_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_id uuid REFERENCES public.challenge_goals(id) ON DELETE CASCADE,
  flight_id uuid REFERENCES public.flights(id) ON DELETE SET NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(challenge_id, user_id, goal_id)
);

ALTER TABLE public.challenge_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Group members can view challenge progress" ON public.challenge_progress
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM challenges c WHERE c.id = challenge_progress.challenge_id AND is_group_member(auth.uid(), c.group_id)
  ));

CREATE POLICY "Users can insert own progress" ON public.challenge_progress
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM challenges c WHERE c.id = challenge_progress.challenge_id AND is_group_member(auth.uid(), c.group_id)
  ));

CREATE POLICY "Users can delete own progress" ON public.challenge_progress
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);