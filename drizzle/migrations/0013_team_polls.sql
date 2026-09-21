-- Abschnitt 8.5: Team-Verfügbarkeitsumfrage
--
-- Sichtbar im Team-Kanal (Abschnitt 6.3), daher dieselbe Empfängerlogik wie dort:
-- is_group_team_member() (Admin + instructor/school_lead/launch_helper), nicht is_group_member.
-- Erstellen/Verwalten bleibt Team-Personal im engeren Sinn vorbehalten (is_group_staff, wie bei
-- is_announcement in group_messages) - Startleiter können abstimmen, aber keine Umfragen anlegen.
--
-- Antwortoptionen als text[] statt fixem Ja/Nein-Enum, weil die Akzeptanzkriterien "Frage,
-- Antwortoptionen" (Plural, frei definierbar) verlangen - Ja/Nein ist nur das Beispiel im Ziel,
-- nicht die einzige zulässige Form ("Wer kann morgen als Startleiter?" könnte z. B. auch pro
-- Person eine Option sein).

CREATE TABLE public.team_polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  question text NOT NULL,
  options text[] NOT NULL DEFAULT ARRAY['Ja', 'Nein'],
  closes_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.team_poll_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.team_polls(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  response text NOT NULL,
  responded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (poll_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_polls TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.team_poll_responses TO authenticated;
GRANT ALL ON public.team_polls TO service_role;
GRANT ALL ON public.team_poll_responses TO service_role;
ALTER TABLE public.team_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_poll_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members view polls" ON public.team_polls
  FOR SELECT TO authenticated
  USING (public.is_group_team_member(auth.uid(), group_id));

CREATE POLICY "Staff create polls" ON public.team_polls
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND public.is_group_staff(auth.uid(), group_id));

CREATE POLICY "Staff update polls" ON public.team_polls
  FOR UPDATE TO authenticated
  USING (public.is_group_staff(auth.uid(), group_id))
  WITH CHECK (public.is_group_staff(auth.uid(), group_id));

CREATE POLICY "Staff delete polls" ON public.team_polls
  FOR DELETE TO authenticated
  USING (public.is_group_staff(auth.uid(), group_id));

CREATE POLICY "Team members view responses" ON public.team_poll_responses
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.team_polls tp
    WHERE tp.id = poll_id AND public.is_group_team_member(auth.uid(), tp.group_id)
  ));

CREATE POLICY "Team members respond to open polls" ON public.team_poll_responses
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.team_polls tp
      WHERE tp.id = poll_id
        AND public.is_group_team_member(auth.uid(), tp.group_id)
        AND (tp.closes_at IS NULL OR tp.closes_at > now())
        AND response = ANY(tp.options)
    )
  );

CREATE POLICY "Team members change own response while open" ON public.team_poll_responses
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.team_polls tp
      WHERE tp.id = poll_id
        AND public.is_group_team_member(auth.uid(), tp.group_id)
        AND (tp.closes_at IS NULL OR tp.closes_at > now())
        AND response = ANY(tp.options)
    )
  );

CREATE INDEX idx_team_polls_group ON public.team_polls(group_id);
CREATE INDEX idx_team_poll_responses_poll ON public.team_poll_responses(poll_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.team_polls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.team_poll_responses;
