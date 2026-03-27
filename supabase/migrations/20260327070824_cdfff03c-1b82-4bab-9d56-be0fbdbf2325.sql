
-- Create student_day_notes table
CREATE TABLE public.student_day_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.flight_events(id) ON DELETE CASCADE,
  student_user_id uuid NOT NULL,
  flight_number integer, -- 1-6 for individual flights, NULL for summary
  note text NOT NULL DEFAULT '',
  visible_to_student boolean NOT NULL DEFAULT false,
  instructor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT flight_number_range CHECK (flight_number IS NULL OR (flight_number >= 1 AND flight_number <= 6))
);

-- Unique constraint: one note per student per flight_number per event
CREATE UNIQUE INDEX student_day_notes_unique ON public.student_day_notes (event_id, student_user_id, COALESCE(flight_number, 0));

-- Enable RLS
ALTER TABLE public.student_day_notes ENABLE ROW LEVEL SECURITY;

-- Group admins can do everything
CREATE POLICY "Group admins can manage day notes"
  ON public.student_day_notes
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM flight_events fe
      WHERE fe.id = student_day_notes.event_id
      AND is_group_admin(auth.uid(), fe.group_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM flight_events fe
      WHERE fe.id = student_day_notes.event_id
      AND is_group_admin(auth.uid(), fe.group_id)
    )
  );

-- Students can view their own visible notes
CREATE POLICY "Students can view own visible notes"
  ON public.student_day_notes
  FOR SELECT
  TO authenticated
  USING (
    student_user_id = auth.uid()
    AND visible_to_student = true
  );

-- Updated_at trigger
CREATE TRIGGER update_student_day_notes_updated_at
  BEFORE UPDATE ON public.student_day_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
