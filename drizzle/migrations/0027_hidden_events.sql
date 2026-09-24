-- Pilots can hide events from their home screen with a left swipe (per person, all devices).
-- Only the home screen list is affected; the events page and sign-ups stay unchanged.
CREATE TABLE IF NOT EXISTS public.hidden_events (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.flight_events(id) ON DELETE CASCADE,
  hidden_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, event_id)
);
ALTER TABLE public.hidden_events ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON public.hidden_events TO authenticated;
DROP POLICY IF EXISTS "Own hidden events" ON public.hidden_events;
CREATE POLICY "Own hidden events" ON public.hidden_events FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
