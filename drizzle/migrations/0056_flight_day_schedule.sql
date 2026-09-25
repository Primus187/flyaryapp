-- Flugtag-Cockpit 5.2: run flight_day_daily_run (0055) every hour. It is idempotent: each day is
-- released/pushed and reminded at most once. Separate from 0055 because pg_cron exists only on the
-- real database (not in the PGlite tests), as with 0040.
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'flight-day-daily-run';
SELECT cron.schedule('flight-day-daily-run', '5 * * * *', 'SELECT public.flight_day_daily_run()');
