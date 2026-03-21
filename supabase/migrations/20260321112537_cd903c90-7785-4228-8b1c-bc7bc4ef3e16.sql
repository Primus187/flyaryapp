
-- Add group type enum
CREATE TYPE public.group_type AS ENUM ('school', 'pilot_group');

-- Add group_type column to groups
ALTER TABLE public.groups ADD COLUMN group_type public.group_type NOT NULL DEFAULT 'pilot_group';

-- Drop old INSERT policy on flight_events
DROP POLICY "Admins can create events" ON public.flight_events;

-- New INSERT policy: admins always, members only for pilot_group
CREATE POLICY "Members can create events based on group type" 
ON public.flight_events 
FOR INSERT 
TO authenticated
WITH CHECK (
  is_group_admin(auth.uid(), group_id) 
  OR (
    is_group_member(auth.uid(), group_id) 
    AND EXISTS (
      SELECT 1 FROM public.groups g WHERE g.id = group_id AND g.group_type = 'pilot_group'
    )
  )
);
