-- Phase 1: SHV-Compliance-Basis für Flugschulen

ALTER TABLE public.school_equipment
  ADD COLUMN IF NOT EXISTS shv_type_approved boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.annual_report_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  year integer NOT NULL,
  submitted_at timestamptz,
  submitted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, year)
);

CREATE TABLE IF NOT EXISTS public.equipment_checks (
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

CREATE TABLE IF NOT EXISTS public.equipment_maintenance (
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

CREATE TABLE IF NOT EXISTS public.incident_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  event_id uuid REFERENCES public.flight_events(id) ON DELETE SET NULL,
  flight_id uuid REFERENCES public.flights(id) ON DELETE SET NULL,
  student_user_id uuid,
  reported_by uuid NOT NULL DEFAULT auth.uid(),
  occurred_at timestamptz NOT NULL,
  shv_deadline timestamptz,
  involved_persons text,
  description text NOT NULL,
  measures text,
  status text NOT NULL DEFAULT 'open',
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT incident_reports_status_chk CHECK (status IN ('open', 'submitted'))
);

CREATE TABLE IF NOT EXISTS public.instructor_certifications (
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

CREATE OR REPLACE FUNCTION public.set_incident_report_deadline()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.shv_deadline IS NULL THEN
    NEW.shv_deadline := NEW.occurred_at + interval '10 days';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_phase1_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_incident_report_deadline ON public.incident_reports;
CREATE TRIGGER set_incident_report_deadline
  BEFORE INSERT OR UPDATE OF occurred_at, shv_deadline ON public.incident_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_incident_report_deadline();

DROP TRIGGER IF EXISTS set_equipment_maintenance_updated_at ON public.equipment_maintenance;
CREATE TRIGGER set_equipment_maintenance_updated_at
  BEFORE UPDATE ON public.equipment_maintenance
  FOR EACH ROW EXECUTE FUNCTION public.set_phase1_updated_at();

DROP TRIGGER IF EXISTS set_incident_reports_updated_at ON public.incident_reports;
CREATE TRIGGER set_incident_reports_updated_at
  BEFORE UPDATE ON public.incident_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_phase1_updated_at();

DROP TRIGGER IF EXISTS set_instructor_certifications_updated_at ON public.instructor_certifications;
CREATE TRIGGER set_instructor_certifications_updated_at
  BEFORE UPDATE ON public.instructor_certifications
  FOR EACH ROW EXECUTE FUNCTION public.set_phase1_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.annual_report_submissions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.equipment_checks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.equipment_maintenance TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.incident_reports TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.instructor_certifications TO authenticated;
GRANT ALL ON public.annual_report_submissions TO service_role;
GRANT ALL ON public.equipment_checks TO service_role;
GRANT ALL ON public.equipment_maintenance TO service_role;
GRANT ALL ON public.incident_reports TO service_role;
GRANT ALL ON public.instructor_certifications TO service_role;

ALTER TABLE public.annual_report_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_maintenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instructor_certifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage annual report submissions"
  ON public.annual_report_submissions FOR ALL TO authenticated
  USING (public.is_group_staff(auth.uid(), group_id))
  WITH CHECK (public.is_group_staff(auth.uid(), group_id));

CREATE POLICY "Staff manage equipment checks"
  ON public.equipment_checks FOR ALL TO authenticated
  USING (public.is_group_staff(auth.uid(), group_id))
  WITH CHECK (public.is_group_staff(auth.uid(), group_id));

CREATE POLICY "Staff manage equipment maintenance"
  ON public.equipment_maintenance FOR ALL TO authenticated
  USING (public.is_group_staff(auth.uid(), group_id))
  WITH CHECK (public.is_group_staff(auth.uid(), group_id));

CREATE POLICY "Staff manage incident reports"
  ON public.incident_reports FOR ALL TO authenticated
  USING (public.is_group_staff(auth.uid(), group_id))
  WITH CHECK (public.is_group_staff(auth.uid(), group_id));

CREATE POLICY "Staff manage instructor certifications"
  ON public.instructor_certifications FOR ALL TO authenticated
  USING (public.is_group_staff(auth.uid(), group_id))
  WITH CHECK (public.is_group_staff(auth.uid(), group_id));

CREATE INDEX IF NOT EXISTS idx_annual_report_submissions_group
  ON public.annual_report_submissions(group_id, year);
CREATE INDEX IF NOT EXISTS idx_equipment_checks_group_student
  ON public.equipment_checks(group_id, student_user_id);
CREATE INDEX IF NOT EXISTS idx_equipment_maintenance_due
  ON public.equipment_maintenance(group_id, due_at)
  WHERE completed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_incident_reports_group_occurred
  ON public.incident_reports(group_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_instructor_certifications_group_user
  ON public.instructor_certifications(group_id, user_id);
