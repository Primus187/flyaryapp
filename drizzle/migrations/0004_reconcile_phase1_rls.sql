-- Reconciliation: doppelte Phase-1-Migrationen
--
-- supabase/migrations/20260921113000_flight_school_phase1.sql und dieses Verzeichnis
-- (0002_school_phase1_shv_compliance.sql) haben unabhängig voneinander dieselben fünf
-- Tabellen angelegt (incident_reports, instructor_certifications, equipment_maintenance,
-- equipment_checks, annual_report_submissions), mit abweichenden RLS-Policies. Beide liegen
-- auf main; welche zuerst gegen die produktive Datenbank lief, lässt sich aus dem Repo-Stand
-- allein nicht feststellen. Diese Migration führt unabhängig vom bisherigen Zustand zu einem
-- einzigen, klar definierten Endergebnis:
--
-- - Alle bisher möglichen Policy-Namen aus beiden Migrationen werden entfernt (idempotent,
--   IF EXISTS), danach wird ein einziger, definitiver Satz angelegt.
-- - Das behebt insbesondere zwei konkrete Abweichungen:
--   1. incident_reports: nur Admins dürfen löschen (nicht jeder Staff) - die
--      supabase-Migration hatte hier eine pauschale FOR-ALL-Staff-Policy, die das
--      unterlaufen hätte, falls sie zusätzlich zur drizzle-Policy aktiv war.
--   2. instructor_certifications und equipment_checks: die betroffene Person kann ihre
--      eigenen Zeilen lesen (Selbstauskunft, z. B. StudentEquipmentHint.tsx liest
--      equipment_checks als der angemeldete Schüler selbst). Falls nur die
--      supabase-Migration lief, gab es diese Policy gar nicht - der Hinweis hätte dann für
--      Schüler immer "fehlend" angezeigt, unabhängig vom tatsächlichen Stand.
-- - Tabellen/Spalten selbst werden nicht verändert (beide Migrationen legen sie strukturell
--   gleich an); nur die Zugriffsregeln werden vereinheitlicht.

DROP POLICY IF EXISTS "Staff manage annual report submissions" ON public.annual_report_submissions;
DROP POLICY IF EXISTS "Staff can read annual reports" ON public.annual_report_submissions;
DROP POLICY IF EXISTS "Staff can insert annual reports" ON public.annual_report_submissions;
DROP POLICY IF EXISTS "Staff can update annual reports" ON public.annual_report_submissions;

DROP POLICY IF EXISTS "Staff manage equipment checks" ON public.equipment_checks;
DROP POLICY IF EXISTS "Staff or student can read equipment checks" ON public.equipment_checks;
DROP POLICY IF EXISTS "Staff can insert equipment checks" ON public.equipment_checks;
DROP POLICY IF EXISTS "Staff can update equipment checks" ON public.equipment_checks;
DROP POLICY IF EXISTS "Staff can delete equipment checks" ON public.equipment_checks;

DROP POLICY IF EXISTS "Staff manage equipment maintenance" ON public.equipment_maintenance;
DROP POLICY IF EXISTS "Staff can read maintenance" ON public.equipment_maintenance;
DROP POLICY IF EXISTS "Staff can insert maintenance" ON public.equipment_maintenance;
DROP POLICY IF EXISTS "Staff can update maintenance" ON public.equipment_maintenance;
DROP POLICY IF EXISTS "Staff can delete maintenance" ON public.equipment_maintenance;

DROP POLICY IF EXISTS "Staff manage incident reports" ON public.incident_reports;
DROP POLICY IF EXISTS "Staff can read incidents" ON public.incident_reports;
DROP POLICY IF EXISTS "Staff can create incidents" ON public.incident_reports;
DROP POLICY IF EXISTS "Staff can update incidents" ON public.incident_reports;
DROP POLICY IF EXISTS "Admins can delete incidents" ON public.incident_reports;

DROP POLICY IF EXISTS "Staff manage instructor certifications" ON public.instructor_certifications;
DROP POLICY IF EXISTS "Staff or owner can read certifications" ON public.instructor_certifications;
DROP POLICY IF EXISTS "Staff can insert certifications" ON public.instructor_certifications;
DROP POLICY IF EXISTS "Staff can update certifications" ON public.instructor_certifications;
DROP POLICY IF EXISTS "Staff can delete certifications" ON public.instructor_certifications;

-- Definitiver Policy-Satz -----------------------------------------------------------------

CREATE POLICY "Staff can read annual reports" ON public.annual_report_submissions
  FOR SELECT TO authenticated USING (public.is_group_staff(auth.uid(), group_id));
CREATE POLICY "Staff can insert annual reports" ON public.annual_report_submissions
  FOR INSERT TO authenticated WITH CHECK (public.is_group_staff(auth.uid(), group_id));
CREATE POLICY "Staff can update annual reports" ON public.annual_report_submissions
  FOR UPDATE TO authenticated USING (public.is_group_staff(auth.uid(), group_id));
CREATE POLICY "Staff can delete annual reports" ON public.annual_report_submissions
  FOR DELETE TO authenticated USING (public.is_group_staff(auth.uid(), group_id));

CREATE POLICY "Staff or student can read equipment checks" ON public.equipment_checks
  FOR SELECT TO authenticated USING (public.is_group_staff(auth.uid(), group_id) OR student_user_id = auth.uid());
CREATE POLICY "Staff can insert equipment checks" ON public.equipment_checks
  FOR INSERT TO authenticated WITH CHECK (public.is_group_staff(auth.uid(), group_id));
CREATE POLICY "Staff can update equipment checks" ON public.equipment_checks
  FOR UPDATE TO authenticated USING (public.is_group_staff(auth.uid(), group_id));
CREATE POLICY "Staff can delete equipment checks" ON public.equipment_checks
  FOR DELETE TO authenticated USING (public.is_group_staff(auth.uid(), group_id));

CREATE POLICY "Staff can read maintenance" ON public.equipment_maintenance
  FOR SELECT TO authenticated USING (public.is_group_staff(auth.uid(), group_id));
CREATE POLICY "Staff can insert maintenance" ON public.equipment_maintenance
  FOR INSERT TO authenticated WITH CHECK (public.is_group_staff(auth.uid(), group_id));
CREATE POLICY "Staff can update maintenance" ON public.equipment_maintenance
  FOR UPDATE TO authenticated USING (public.is_group_staff(auth.uid(), group_id));
CREATE POLICY "Staff can delete maintenance" ON public.equipment_maintenance
  FOR DELETE TO authenticated USING (public.is_group_staff(auth.uid(), group_id));

CREATE POLICY "Staff can read incidents" ON public.incident_reports
  FOR SELECT TO authenticated USING (public.is_group_staff(auth.uid(), group_id));
CREATE POLICY "Staff can create incidents" ON public.incident_reports
  FOR INSERT TO authenticated WITH CHECK (public.is_group_staff(auth.uid(), group_id) AND reported_by = auth.uid());
CREATE POLICY "Staff can update incidents" ON public.incident_reports
  FOR UPDATE TO authenticated USING (public.is_group_staff(auth.uid(), group_id));
CREATE POLICY "Admins can delete incidents" ON public.incident_reports
  FOR DELETE TO authenticated USING (public.is_group_admin(auth.uid(), group_id));

CREATE POLICY "Staff or owner can read certifications" ON public.instructor_certifications
  FOR SELECT TO authenticated USING (public.is_group_staff(auth.uid(), group_id) OR user_id = auth.uid());
CREATE POLICY "Staff can insert certifications" ON public.instructor_certifications
  FOR INSERT TO authenticated WITH CHECK (public.is_group_staff(auth.uid(), group_id));
CREATE POLICY "Staff can update certifications" ON public.instructor_certifications
  FOR UPDATE TO authenticated USING (public.is_group_staff(auth.uid(), group_id));
CREATE POLICY "Staff can delete certifications" ON public.instructor_certifications
  FOR DELETE TO authenticated USING (public.is_group_staff(auth.uid(), group_id));
