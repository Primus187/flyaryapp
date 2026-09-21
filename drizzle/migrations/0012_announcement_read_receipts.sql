-- Abschnitt 8.4: Lesebestätigung sicherheitsrelevanter Ankündigungen
--
-- Erweitert die bestehende Ankündigungsfunktion in group_messages (is_announcement, siehe
-- Abschnitt 6.3/0009) statt eine neue Mitteilungs-Struktur zu bauen: eine Ankündigung kann
-- zusätzlich als "bestätigungspflichtig" markiert werden (requires_confirmation), unabhängig
-- davon, ob sie im normalen Gruppenkanal oder im Team-Kanal (is_team_only) gepostet wird.

ALTER TABLE public.group_messages
  ADD COLUMN IF NOT EXISTS requires_confirmation boolean NOT NULL DEFAULT false;

CREATE TABLE public.announcement_read_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.group_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id)
);

GRANT SELECT, INSERT ON public.announcement_read_receipts TO authenticated;
GRANT ALL ON public.announcement_read_receipts TO service_role;
ALTER TABLE public.announcement_read_receipts ENABLE ROW LEVEL SECURITY;

-- Empfänger-Übersicht (Akzeptanzkriterium) darf jedes Gruppenmitglied sehen, nicht nur Team-
-- Personal - anders als beim Notfall-Zugriffsprotokoll (12.3) ist "wer hat gelesen" keine
-- schützenswerte Information, sondern der Zweck des Features selbst.
CREATE POLICY "Members view read receipts" ON public.announcement_read_receipts
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.group_messages gm
    WHERE gm.id = message_id AND public.is_group_member(auth.uid(), gm.group_id)
  ));

CREATE POLICY "Members confirm own receipt" ON public.announcement_read_receipts
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.group_messages gm
      WHERE gm.id = message_id
        AND gm.is_announcement
        AND gm.requires_confirmation
        AND public.is_group_member(auth.uid(), gm.group_id)
        AND (NOT gm.is_team_only OR public.is_group_team_member(auth.uid(), gm.group_id))
    )
  );

CREATE INDEX idx_announcement_read_receipts_message ON public.announcement_read_receipts(message_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.announcement_read_receipts;
