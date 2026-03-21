
-- Add bio and emergency fields to profiles
ALTER TABLE public.profiles
  ADD COLUMN bio text,
  ADD COLUMN emergency_contact_name text,
  ADD COLUMN emergency_contact_phone text,
  ADD COLUMN blood_type text,
  ADD COLUMN allergies text,
  ADD COLUMN medical_notes text;

-- Create pilot_gliders table for multiple gliders
CREATE TABLE public.pilot_gliders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  manufacturer text NOT NULL,
  model text NOT NULL,
  size text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.pilot_gliders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own gliders" ON public.pilot_gliders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own gliders" ON public.pilot_gliders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own gliders" ON public.pilot_gliders FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own gliders" ON public.pilot_gliders FOR DELETE USING (auth.uid() = user_id);

-- Allow group members to see profiles (for emergency info at events)
CREATE POLICY "Group members can view profiles"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.group_members gm1
    JOIN public.group_members gm2 ON gm1.group_id = gm2.group_id
    WHERE gm1.user_id = auth.uid() AND gm2.user_id = profiles.user_id
  )
);
