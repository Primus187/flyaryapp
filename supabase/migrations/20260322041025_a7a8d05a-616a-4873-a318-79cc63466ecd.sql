CREATE TABLE public.flight_training_items (
  flight_id uuid NOT NULL REFERENCES public.flights(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.training_items(id) ON DELETE CASCADE,
  PRIMARY KEY (flight_id, item_id)
);

ALTER TABLE public.flight_training_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own flight training items" ON public.flight_training_items
  FOR SELECT TO authenticated
  USING (is_owner_of_flight(flight_id));

CREATE POLICY "Users can insert own flight training items" ON public.flight_training_items
  FOR INSERT TO authenticated
  WITH CHECK (is_owner_of_flight(flight_id));

CREATE POLICY "Users can delete own flight training items" ON public.flight_training_items
  FOR DELETE TO authenticated
  USING (is_owner_of_flight(flight_id));