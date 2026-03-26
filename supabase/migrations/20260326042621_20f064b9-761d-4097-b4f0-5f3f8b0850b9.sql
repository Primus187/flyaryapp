
-- Add instructor feedback columns to flight_training_items
ALTER TABLE public.flight_training_items ADD COLUMN instructor_rating integer DEFAULT NULL;
ALTER TABLE public.flight_training_items ADD COLUMN instructor_note text DEFAULT NULL;
ALTER TABLE public.flight_training_items ADD COLUMN instructor_id uuid DEFAULT NULL;

-- Allow group admins to update flight_training_items for coach feedback
CREATE POLICY "Group admins can update training items"
ON public.flight_training_items
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM flights f
    JOIN group_members gm ON gm.group_id = f.group_id AND gm.role = 'admin'
    WHERE f.id = flight_training_items.flight_id AND gm.user_id = auth.uid()
  )
);

-- Allow group admins to view training items of group members
CREATE POLICY "Group admins can view group training items"
ON public.flight_training_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM flights f
    JOIN group_members gm ON gm.group_id = f.group_id
    WHERE f.id = flight_training_items.flight_id AND gm.user_id = auth.uid()
  )
);

-- Create flight_templates table
CREATE TABLE public.flight_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  takeoff_location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  landing_location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  glider text,
  group_id uuid REFERENCES public.groups(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.flight_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own templates"
ON public.flight_templates
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
