-- Add share_token column to flights
ALTER TABLE public.flights ADD COLUMN share_token uuid DEFAULT gen_random_uuid();

-- Index for fast lookups
CREATE INDEX idx_flights_share_token ON public.flights(share_token);