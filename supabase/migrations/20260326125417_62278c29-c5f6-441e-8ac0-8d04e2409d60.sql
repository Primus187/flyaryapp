
-- Phase 1: Add training_level to profiles and training_categories
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS training_level text DEFAULT 'grundkurs';
ALTER TABLE public.training_categories ADD COLUMN IF NOT EXISTS training_level text;

-- Phase 2: Extend flight_events with briefing fields
ALTER TABLE public.flight_events ADD COLUMN IF NOT EXISTS flight_area text;
ALTER TABLE public.flight_events ADD COLUMN IF NOT EXISTS day_topic text;
ALTER TABLE public.flight_events ADD COLUMN IF NOT EXISTS departure_info text;
ALTER TABLE public.flight_events ADD COLUMN IF NOT EXISTS flight_prep_notes text;

-- Phase 4: Add event_id to flights
ALTER TABLE public.flights ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES public.flight_events(id);

-- Phase 2: Create event_briefing_tasks table
CREATE TABLE public.event_briefing_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.flight_events(id) ON DELETE CASCADE,
  task_type text NOT NULL DEFAULT 'custom',
  label text NOT NULL,
  assigned_user_id uuid,
  sort_order integer NOT NULL DEFAULT 0
);

ALTER TABLE public.event_briefing_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view briefing tasks" ON public.event_briefing_tasks
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM flight_events fe
    JOIN group_members gm ON gm.group_id = fe.group_id
    WHERE fe.id = event_briefing_tasks.event_id AND gm.user_id = auth.uid()
  ));

CREATE POLICY "Admins can manage briefing tasks" ON public.event_briefing_tasks
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM flight_events fe
    WHERE fe.id = event_briefing_tasks.event_id AND is_group_admin(auth.uid(), fe.group_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM flight_events fe
    WHERE fe.id = event_briefing_tasks.event_id AND is_group_admin(auth.uid(), fe.group_id)
  ));

-- Phase 2: Create event_maneuvers table
CREATE TABLE public.event_maneuvers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.flight_events(id) ON DELETE CASCADE,
  training_item_id uuid NOT NULL REFERENCES public.training_items(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0
);

ALTER TABLE public.event_maneuvers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view event maneuvers" ON public.event_maneuvers
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM flight_events fe
    JOIN group_members gm ON gm.group_id = fe.group_id
    WHERE fe.id = event_maneuvers.event_id AND gm.user_id = auth.uid()
  ));

CREATE POLICY "Admins can manage event maneuvers" ON public.event_maneuvers
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM flight_events fe
    WHERE fe.id = event_maneuvers.event_id AND is_group_admin(auth.uid(), fe.group_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM flight_events fe
    WHERE fe.id = event_maneuvers.event_id AND is_group_admin(auth.uid(), fe.group_id)
  ));
