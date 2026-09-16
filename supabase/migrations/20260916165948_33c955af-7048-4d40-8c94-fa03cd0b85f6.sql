CREATE TABLE public.launch_leader_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  event_id uuid REFERENCES public.flight_events(id) ON DELETE SET NULL,
  entry_type text NOT NULL DEFAULT 'earned',
  booking_date date NOT NULL DEFAULT CURRENT_DATE,
  days numeric NOT NULL DEFAULT 1,
  amount numeric NOT NULL DEFAULT 0,
  note text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT launch_leader_credits_entry_type_check CHECK (entry_type IN ('earned','payout','adjustment'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.launch_leader_credits TO authenticated;
GRANT ALL ON public.launch_leader_credits TO service_role;

ALTER TABLE public.launch_leader_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage launch leader credits"
ON public.launch_leader_credits FOR ALL TO authenticated
USING (public.is_group_staff(auth.uid(), group_id))
WITH CHECK (public.is_group_staff(auth.uid(), group_id) AND created_by = auth.uid());

CREATE POLICY "Own launch leader credits are visible"
ON public.launch_leader_credits FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE INDEX launch_leader_credits_group_user_idx ON public.launch_leader_credits (group_id, user_id);

CREATE TRIGGER update_launch_leader_credits_updated_at
BEFORE UPDATE ON public.launch_leader_credits
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();