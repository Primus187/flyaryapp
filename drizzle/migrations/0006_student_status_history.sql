-- Abschnitt 5.2: Pausierungs-Status
--
-- Nachvollziehbarer Status je Schüler (aktiv/pausiert/abgebrochen), mit Grund und Datum.
-- SchoolDashboard.tsx fragt diese Tabelle bereits ab (student_status_history), sie fehlte
-- bislang als Migration; ohne Tabelle fiel jede Statusänderung auf einen reinen
-- Browser-localStorage-Fallback zurück (nicht geräte-/sitzungsübergreifend, kein
-- serverseitiger Nachweis).

CREATE TABLE public.student_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  status text NOT NULL,
  reason text,
  changed_by uuid NOT NULL DEFAULT auth.uid(),
  changed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT student_status_history_status_chk CHECK (status IN ('active', 'paused', 'cancelled'))
);

GRANT SELECT, INSERT ON public.student_status_history TO authenticated;
GRANT ALL ON public.student_status_history TO service_role;
ALTER TABLE public.student_status_history ENABLE ROW LEVEL SECURITY;

-- Nur Staff sieht/setzt Statuswechsel; es handelt sich um ein internes Verlaufsprotokoll
-- (analog zu Coach-Notizen), keine Selbstauskunft für Schüler vorgesehen.
CREATE POLICY "Staff can read student status history" ON public.student_status_history
  FOR SELECT TO authenticated USING (public.is_group_staff(auth.uid(), group_id));
CREATE POLICY "Staff can insert student status history" ON public.student_status_history
  FOR INSERT TO authenticated WITH CHECK (public.is_group_staff(auth.uid(), group_id));

CREATE INDEX idx_student_status_history_group_student ON public.student_status_history(group_id, student_id, changed_at DESC);
