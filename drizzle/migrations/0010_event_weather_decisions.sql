-- Abschnitt 7.1: Strukturierter Geh/Nogo-Entscheid
--
-- Eigene Tabelle statt Erweiterung von flight_events.status: dessen Enum event_status
-- ('announced'/'confirmed'/'cancelled') wird app-weit für alle Gruppentypen verwendet (nicht
-- nur Flugschulen), an vielen Stellen ausserhalb dieses Features. Einen vierten Wert
-- ("wetterabhängig") dort einzuführen, hätte jede bestehende status==='confirmed'/'cancelled'-
-- Prüfung im ganzen Code auf Vollständigkeit prüfen müssen. Stattdessen: eine schmale,
-- eigenständige Tabelle; bei den beiden Statuswerten, die bereits eine Entsprechung in
-- event_status haben (bestätigt/abgesagt), wird flight_events.status synchron mitgesetzt,
-- damit bestehende Logik (z. B. Abschnitt 7.2, Ersatztermin-Vorschlag bei "abgesagt") unverändert
-- weiterfunktioniert. "Wetterabhängig" hat keine Entsprechung und bleibt ohne Sync (Termin bleibt
-- im bisherigen Status, i. d. R. "announced").

CREATE TABLE public.event_weather_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL UNIQUE REFERENCES public.flight_events(id) ON DELETE CASCADE,
  decision_deadline timestamptz,
  status text NOT NULL DEFAULT 'weather_pending',
  decided_by uuid,
  decided_at timestamptz,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_weather_decisions_status_chk CHECK (status IN ('confirmed', 'weather_pending', 'cancelled'))
);

GRANT SELECT, INSERT, UPDATE ON public.event_weather_decisions TO authenticated;
GRANT ALL ON public.event_weather_decisions TO service_role;
ALTER TABLE public.event_weather_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read weather decisions" ON public.event_weather_decisions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.flight_events fe
    WHERE fe.id = event_weather_decisions.event_id AND public.is_group_member(auth.uid(), fe.group_id)
  ));

CREATE POLICY "Staff can insert weather decisions" ON public.event_weather_decisions
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.flight_events fe
    WHERE fe.id = event_weather_decisions.event_id AND public.is_group_staff(auth.uid(), fe.group_id)
  ));

CREATE POLICY "Staff can update weather decisions" ON public.event_weather_decisions
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.flight_events fe
    WHERE fe.id = event_weather_decisions.event_id AND public.is_group_staff(auth.uid(), fe.group_id)
  ));

CREATE TRIGGER event_weather_decisions_updated_at BEFORE UPDATE ON public.event_weather_decisions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_event_weather_decisions_event ON public.event_weather_decisions(event_id);
