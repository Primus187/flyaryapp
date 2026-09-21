-- Abschnitt 4.4: Historie des Ausbildungsstands
--
-- Der SHV-Jahresbericht muss "abgeschlossene Brevetierungen im Berichtsjahr"
-- ausweisen können. profiles.training_level ist aber ein Live-Wert ohne
-- Zeitbezug; ohne Historie lässt sich für vergangene Jahre nichts
-- rekonstruieren. Diese Tabelle protokolliert jede Änderung mit Zeitstempel,
-- ab sofort. Änderungen vor Einführung dieser Migration bleiben unbekannt.

CREATE TABLE public.training_level_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  training_level text NOT NULL,
  changed_by uuid NOT NULL DEFAULT auth.uid(),
  changed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.training_level_history TO authenticated;
GRANT ALL ON public.training_level_history TO service_role;
ALTER TABLE public.training_level_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read training level history" ON public.training_level_history
  FOR SELECT TO authenticated USING (public.is_group_staff(auth.uid(), group_id));
CREATE POLICY "Staff can insert training level history" ON public.training_level_history
  FOR INSERT TO authenticated WITH CHECK (public.is_group_staff(auth.uid(), group_id));

CREATE INDEX idx_training_level_history_group ON public.training_level_history(group_id, training_level, changed_at);
CREATE INDEX idx_training_level_history_user ON public.training_level_history(user_id, changed_at);

-- Bestehende Funktion erweitern: protokolliert jede tatsächliche Änderung,
-- Berechtigungsprüfungen bleiben unverändert.
CREATE OR REPLACE FUNCTION public.set_member_training_level(_group_id uuid, _user_id uuid, _training_level text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _previous text;
BEGIN
  IF NOT public.is_group_staff(auth.uid(), _group_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF NOT public.is_group_member(_user_id, _group_id) THEN
    RAISE EXCEPTION 'Target user is not a group member';
  END IF;

  SELECT training_level INTO _previous FROM public.profiles WHERE user_id = _user_id;
  UPDATE public.profiles SET training_level = _training_level, updated_at = now() WHERE user_id = _user_id;

  IF _previous IS DISTINCT FROM _training_level THEN
    INSERT INTO public.training_level_history (group_id, user_id, training_level, changed_by)
    VALUES (_group_id, _user_id, _training_level, auth.uid());
  END IF;
END;
$$;
