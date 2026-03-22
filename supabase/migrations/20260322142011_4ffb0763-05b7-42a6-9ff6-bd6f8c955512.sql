
-- Create event_photos table
CREATE TABLE public.event_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.flight_events(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.event_photos ENABLE ROW LEVEL SECURITY;

-- RLS: Group members can view event photos
CREATE POLICY "Group members can view event photos"
  ON public.event_photos FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM flight_events fe
    JOIN group_members gm ON gm.group_id = fe.group_id
    WHERE fe.id = event_photos.event_id AND gm.user_id = auth.uid()
  ));

-- RLS: Event creator can insert photos
CREATE POLICY "Event creator can insert event photos"
  ON public.event_photos FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM flight_events fe
    WHERE fe.id = event_photos.event_id AND fe.created_by = auth.uid()
  ));

-- RLS: Event creator can delete photos
CREATE POLICY "Event creator can delete event photos"
  ON public.event_photos FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM flight_events fe
    WHERE fe.id = event_photos.event_id AND fe.created_by = auth.uid()
  ));

-- Add feed columns to flight_events
ALTER TABLE public.flight_events
  ADD COLUMN published_to_feed boolean NOT NULL DEFAULT false,
  ADD COLUMN published_at timestamptz,
  ADD COLUMN feed_description text;
