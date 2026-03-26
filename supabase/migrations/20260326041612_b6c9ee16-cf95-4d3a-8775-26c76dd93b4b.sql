
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS health_data_consent_at timestamp with time zone DEFAULT NULL;

ALTER TABLE public.pilot_gliders 
  ADD COLUMN IF NOT EXISTS last_check_date date DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS next_check_date date DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS reserve_repack_date date DEFAULT NULL;
