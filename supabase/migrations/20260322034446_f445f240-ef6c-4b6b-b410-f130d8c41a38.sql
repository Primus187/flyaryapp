CREATE TABLE public.event_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES flight_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.event_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view event messages" ON public.event_messages
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM flight_events fe
    WHERE fe.id = event_messages.event_id
    AND is_group_member(auth.uid(), fe.group_id)
  ));

CREATE POLICY "Members can insert event messages" ON public.event_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM flight_events fe
      WHERE fe.id = event_messages.event_id
      AND is_group_member(auth.uid(), fe.group_id)
    )
  );

CREATE POLICY "Users can delete own messages" ON public.event_messages
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.event_messages;