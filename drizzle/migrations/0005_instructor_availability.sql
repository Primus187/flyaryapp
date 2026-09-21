-- Abschnitt 6.1: Verfügbarkeitsplanung Team
--
-- Team trägt Verfügbarkeit im Voraus ein (verfügbar/nicht verfügbar/unsicher, pro Tag,
-- optional mit Notiz), statt nur reaktiv pro Termin eingeteilt zu werden.

CREATE TABLE public.instructor_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  date date NOT NULL,
  status text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id, date),
  CONSTRAINT instructor_availability_status_chk CHECK (status IN ('available', 'unsure', 'unavailable'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.instructor_availability TO authenticated;
GRANT ALL ON public.instructor_availability TO service_role;
ALTER TABLE public.instructor_availability ENABLE ROW LEVEL SECURITY;

-- Jede Person pflegt ihre eigene Verfügbarkeit; Staff sieht und pflegt die des ganzen Teams
-- (z. B. wenn ein Teammitglied die Abwesenheit telefonisch durchgibt).
CREATE POLICY "Staff or self can read availability" ON public.instructor_availability
  FOR SELECT TO authenticated USING (public.is_group_staff(auth.uid(), group_id) OR user_id = auth.uid());
CREATE POLICY "Staff or self can insert availability" ON public.instructor_availability
  FOR INSERT TO authenticated WITH CHECK (public.is_group_staff(auth.uid(), group_id) OR user_id = auth.uid());
CREATE POLICY "Staff or self can update availability" ON public.instructor_availability
  FOR UPDATE TO authenticated USING (public.is_group_staff(auth.uid(), group_id) OR user_id = auth.uid());
CREATE POLICY "Staff or self can delete availability" ON public.instructor_availability
  FOR DELETE TO authenticated USING (public.is_group_staff(auth.uid(), group_id) OR user_id = auth.uid());

CREATE TRIGGER instructor_availability_updated_at BEFORE UPDATE ON public.instructor_availability
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_instructor_availability_group_date ON public.instructor_availability(group_id, date);
CREATE INDEX idx_instructor_availability_user ON public.instructor_availability(user_id, date);
