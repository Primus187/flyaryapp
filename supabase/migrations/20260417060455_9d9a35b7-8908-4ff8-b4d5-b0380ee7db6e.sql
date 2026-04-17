
CREATE TABLE public.flight_coach_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  flight_id uuid NOT NULL REFERENCES public.flights(id) ON DELETE CASCADE,
  coach_id uuid NOT NULL,
  note text NOT NULL DEFAULT '',
  visible_to_student boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (flight_id, coach_id)
);

CREATE INDEX idx_flight_coach_notes_flight ON public.flight_coach_notes(flight_id);

ALTER TABLE public.flight_coach_notes ENABLE ROW LEVEL SECURITY;

-- Coaches (group admins of the flight's group) can do everything
CREATE POLICY "Coaches can view notes"
  ON public.flight_coach_notes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.flights f
      WHERE f.id = flight_coach_notes.flight_id
        AND f.group_id IS NOT NULL
        AND public.is_group_admin(auth.uid(), f.group_id)
    )
  );

CREATE POLICY "Coaches can insert notes"
  ON public.flight_coach_notes FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = coach_id
    AND EXISTS (
      SELECT 1 FROM public.flights f
      WHERE f.id = flight_coach_notes.flight_id
        AND f.group_id IS NOT NULL
        AND public.is_group_admin(auth.uid(), f.group_id)
    )
  );

CREATE POLICY "Coaches can update own notes"
  ON public.flight_coach_notes FOR UPDATE
  TO authenticated
  USING (auth.uid() = coach_id);

CREATE POLICY "Coaches can delete own notes"
  ON public.flight_coach_notes FOR DELETE
  TO authenticated
  USING (auth.uid() = coach_id);

-- Students see notes that are explicitly shared with them
CREATE POLICY "Students can view shared notes"
  ON public.flight_coach_notes FOR SELECT
  TO authenticated
  USING (
    visible_to_student = true
    AND EXISTS (
      SELECT 1 FROM public.flights f
      WHERE f.id = flight_coach_notes.flight_id
        AND f.user_id = auth.uid()
    )
  );

CREATE TRIGGER set_flight_coach_notes_updated_at
  BEFORE UPDATE ON public.flight_coach_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
