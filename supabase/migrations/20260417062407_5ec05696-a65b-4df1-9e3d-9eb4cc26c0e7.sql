ALTER TABLE public.flights ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}'::text[];
CREATE INDEX IF NOT EXISTS idx_flights_tags ON public.flights USING GIN(tags);