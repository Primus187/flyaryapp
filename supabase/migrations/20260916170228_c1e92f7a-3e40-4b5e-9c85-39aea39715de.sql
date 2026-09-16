CREATE TABLE public.billing_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  event_id uuid REFERENCES public.flight_events(id) ON DELETE SET NULL,
  item_type text NOT NULL DEFAULT 'other',
  description text,
  quantity numeric NOT NULL DEFAULT 1,
  unit_amount numeric NOT NULL DEFAULT 0,
  amount numeric NOT NULL DEFAULT 0,
  billing_date date NOT NULL DEFAULT CURRENT_DATE,
  paid_at date,
  note text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT billing_items_item_type_check CHECK (item_type IN ('travel','rental','purchase','course_fee','other'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_items TO authenticated;
GRANT ALL ON public.billing_items TO service_role;

ALTER TABLE public.billing_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage billing items"
ON public.billing_items FOR ALL TO authenticated
USING (public.is_group_staff(auth.uid(), group_id))
WITH CHECK (public.is_group_staff(auth.uid(), group_id) AND created_by = auth.uid());

CREATE POLICY "Own billing items are visible"
ON public.billing_items FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE INDEX billing_items_group_user_idx ON public.billing_items (group_id, user_id);

CREATE TRIGGER update_billing_items_updated_at
BEFORE UPDATE ON public.billing_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();