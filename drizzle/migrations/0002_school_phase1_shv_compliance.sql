-- Abschnitt 3 / Phase 1: SHV-Compliance-Grundlagen

-- 1. Vorfallmeldungen
CREATE TABLE public.incident_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  event_id uuid REFERENCES public.flight_events(id) ON DELETE SET NULL,
  flight_id uuid REFERENCES public.flights(id) ON DELETE SET NULL,
  student_user_id uuid,
  reported_by uuid NOT NULL DEFAULT auth.uid(),
  occurred_at timestamptz NOT NULL,
  involved_persons text,
  description text NOT NULL,
  measures text,
  status text NOT NULL DEFAULT 'open',
  submitted_at timestamptz,
  shv_deadline date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.set_incident_deadline()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.shv_deadline := (NEW.occurred_at + interval '10 days')::date;
  RETURN NEW;
END;
$$;

CREATE TRIGGER incident_reports_deadline BEFORE INSERT OR UPDATE OF occurred_at ON public.incident_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_incident_deadline();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.incident_reports TO authenticated;
GRANT ALL ON public.incident_reports TO service_role;
ALTER TABLE public.incident_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read incidents" ON public.incident_reports
  FOR SELECT TO authenticated USING (public.is_group_staff(auth.uid(), group_id));
CREATE POLICY "Staff can create incidents" ON public.incident_reports
  FOR INSERT TO authenticated WITH CHECK (public.is_group_staff(auth.uid(), group_id) AND reported_by = auth.uid());
CREATE POLICY "Staff can update incidents" ON public.incident_reports
  FOR UPDATE TO authenticated USING (public.is_group_staff(auth.uid(), group_id));
CREATE POLICY "Admins can delete incidents" ON public.incident_reports
  FOR DELETE TO authenticated USING (public.is_group_admin(auth.uid(), group_id));

CREATE TRIGGER incident_reports_updated_at BEFORE UPDATE ON public.incident_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Zertifikate des Schulteams
CREATE TABLE public.instructor_certifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  cert_type text NOT NULL,
  issued_at date,
  valid_until date,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id, cert_type)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.instructor_certifications TO authenticated;
GRANT ALL ON public.instructor_certifications TO service_role;
ALTER TABLE public.instructor_certifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff or owner can read certifications" ON public.instructor_certifications
  FOR SELECT TO authenticated USING (public.is_group_staff(auth.uid(), group_id) OR user_id = auth.uid());
CREATE POLICY "Staff can insert certifications" ON public.instructor_certifications
  FOR INSERT TO authenticated WITH CHECK (public.is_group_staff(auth.uid(), group_id));
CREATE POLICY "Staff can update certifications" ON public.instructor_certifications
  FOR UPDATE TO authenticated USING (public.is_group_staff(auth.uid(), group_id));
CREATE POLICY "Staff can delete certifications" ON public.instructor_certifications
  FOR DELETE TO authenticated USING (public.is_group_staff(auth.uid(), group_id));

CREATE TRIGGER instructor_certifications_updated_at BEFORE UPDATE ON public.instructor_certifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Wartungs-/Prüffristen für Schulmaterial
CREATE TABLE public.equipment_maintenance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  equipment_id uuid NOT NULL REFERENCES public.school_equipment(id) ON DELETE CASCADE,
  maintenance_type text NOT NULL,
  due_at date NOT NULL,
  completed_at date,
  completed_by uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.equipment_maintenance TO authenticated;
GRANT ALL ON public.equipment_maintenance TO service_role;
ALTER TABLE public.equipment_maintenance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read maintenance" ON public.equipment_maintenance
  FOR SELECT TO authenticated USING (public.is_group_staff(auth.uid(), group_id));
CREATE POLICY "Staff can insert maintenance" ON public.equipment_maintenance
  FOR INSERT TO authenticated WITH CHECK (public.is_group_staff(auth.uid(), group_id));
CREATE POLICY "Staff can update maintenance" ON public.equipment_maintenance
  FOR UPDATE TO authenticated USING (public.is_group_staff(auth.uid(), group_id));
CREATE POLICY "Staff can delete maintenance" ON public.equipment_maintenance
  FOR DELETE TO authenticated USING (public.is_group_staff(auth.uid(), group_id));

CREATE TRIGGER equipment_maintenance_updated_at BEFORE UPDATE ON public.equipment_maintenance
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. SHV-Typenprüfung am Material
ALTER TABLE public.school_equipment ADD COLUMN IF NOT EXISTS shv_type_approved boolean NOT NULL DEFAULT false;

-- 5. Ausrüstungscheck pro Schüler
CREATE TABLE public.equipment_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  student_user_id uuid NOT NULL,
  item text NOT NULL,
  present boolean NOT NULL DEFAULT false,
  checked_at timestamptz NOT NULL DEFAULT now(),
  checked_by uuid NOT NULL DEFAULT auth.uid(),
  note text,
  UNIQUE (group_id, student_user_id, item)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.equipment_checks TO authenticated;
GRANT ALL ON public.equipment_checks TO service_role;
ALTER TABLE public.equipment_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff or student can read equipment checks" ON public.equipment_checks
  FOR SELECT TO authenticated USING (public.is_group_staff(auth.uid(), group_id) OR student_user_id = auth.uid());
CREATE POLICY "Staff can insert equipment checks" ON public.equipment_checks
  FOR INSERT TO authenticated WITH CHECK (public.is_group_staff(auth.uid(), group_id));
CREATE POLICY "Staff can update equipment checks" ON public.equipment_checks
  FOR UPDATE TO authenticated USING (public.is_group_staff(auth.uid(), group_id));
CREATE POLICY "Staff can delete equipment checks" ON public.equipment_checks
  FOR DELETE TO authenticated USING (public.is_group_staff(auth.uid(), group_id));

-- 6. Jahresbericht-Nachverfolgung
CREATE TABLE public.annual_report_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  year integer NOT NULL,
  submitted_at timestamptz,
  submitted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, year)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.annual_report_submissions TO authenticated;
GRANT ALL ON public.annual_report_submissions TO service_role;
ALTER TABLE public.annual_report_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read annual reports" ON public.annual_report_submissions
  FOR SELECT TO authenticated USING (public.is_group_staff(auth.uid(), group_id));
CREATE POLICY "Staff can insert annual reports" ON public.annual_report_submissions
  FOR INSERT TO authenticated WITH CHECK (public.is_group_staff(auth.uid(), group_id));
CREATE POLICY "Staff can update annual reports" ON public.annual_report_submissions
  FOR UPDATE TO authenticated USING (public.is_group_staff(auth.uid(), group_id));

CREATE INDEX idx_incident_reports_group ON public.incident_reports(group_id, occurred_at DESC);
CREATE INDEX idx_instructor_certifications_group ON public.instructor_certifications(group_id, user_id);
CREATE INDEX idx_equipment_maintenance_due ON public.equipment_maintenance(group_id, due_at);
CREATE INDEX idx_equipment_checks_student ON public.equipment_checks(group_id, student_user_id);