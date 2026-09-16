-- Schulmaterial
CREATE TABLE public.school_equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  name text NOT NULL,
  equipment_type text NOT NULL DEFAULT 'other',
  inventory_number text,
  size text,
  condition text,
  status text NOT NULL DEFAULT 'in_stock',
  purchase_date date,
  retired_at date,
  retire_reason text,
  last_check_date date,
  next_check_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT school_equipment_status_chk CHECK (status IN ('in_stock','assigned','maintenance','retired'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_equipment TO authenticated;
GRANT ALL ON public.school_equipment TO service_role;
ALTER TABLE public.school_equipment ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage school equipment" ON public.school_equipment
  FOR ALL TO authenticated
  USING (public.is_group_staff(auth.uid(), group_id))
  WITH CHECK (public.is_group_staff(auth.uid(), group_id));
CREATE TRIGGER set_school_equipment_updated_at BEFORE UPDATE ON public.school_equipment
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_school_equipment_group ON public.school_equipment(group_id);

-- Materialausgaben
CREATE TABLE public.equipment_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id uuid NOT NULL REFERENCES public.school_equipment(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  event_id uuid REFERENCES public.flight_events(id) ON DELETE SET NULL,
  assigned_on date NOT NULL DEFAULT CURRENT_DATE,
  due_on date,
  returned_on date,
  note text,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.equipment_assignments TO authenticated;
GRANT ALL ON public.equipment_assignments TO service_role;
ALTER TABLE public.equipment_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage equipment assignments" ON public.equipment_assignments
  FOR ALL TO authenticated
  USING (public.is_group_staff(auth.uid(), group_id))
  WITH CHECK (public.is_group_staff(auth.uid(), group_id));
CREATE POLICY "Members view own equipment assignments" ON public.equipment_assignments
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE TRIGGER set_equipment_assignments_updated_at BEFORE UPDATE ON public.equipment_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_equipment_assignments_equipment ON public.equipment_assignments(equipment_id);
CREATE INDEX idx_equipment_assignments_user ON public.equipment_assignments(user_id);

-- Variable Ansätze
CREATE TABLE public.school_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  rate_key text NOT NULL,
  label text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'CHF',
  valid_from date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, rate_key, valid_from)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_rates TO authenticated;
GRANT ALL ON public.school_rates TO service_role;
ALTER TABLE public.school_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage school rates" ON public.school_rates
  FOR ALL TO authenticated
  USING (public.is_group_staff(auth.uid(), group_id))
  WITH CHECK (public.is_group_staff(auth.uid(), group_id));
CREATE TRIGGER set_school_rates_updated_at BEFORE UPDATE ON public.school_rates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_school_rates_group ON public.school_rates(group_id);