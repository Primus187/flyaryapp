
-- Add XContest fields to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS xcontest_username text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS xcontest_password_encrypted text;

-- Create xcontest_imports table
CREATE TABLE IF NOT EXISTS public.xcontest_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  xcontest_flight_url text NOT NULL UNIQUE,
  flight_id uuid REFERENCES public.flights(id) ON DELETE SET NULL,
  imported_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.xcontest_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own imports" ON public.xcontest_imports FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own imports" ON public.xcontest_imports FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own imports" ON public.xcontest_imports FOR DELETE TO authenticated USING (auth.uid() = user_id);
