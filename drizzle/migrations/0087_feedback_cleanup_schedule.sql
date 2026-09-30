-- Betriebsbereich step 4: run the Edge Function feedback-cleanup every night at 03:30 UTC (plan §7).
-- Separate from 0086 because pg_cron exists only on the real database (not in the PGlite tests).
-- Same Vault secrets and x-push-secret check as marketplace-cleanup (0040).
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.feedback_trigger_cleanup()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _project_url text;
  _secret text;
BEGIN
  SELECT decrypted_secret INTO _project_url FROM vault.decrypted_secrets WHERE name = 'project_url' LIMIT 1;
  SELECT decrypted_secret INTO _secret FROM vault.decrypted_secrets WHERE name = 'push_internal_secret' LIMIT 1;
  IF _project_url IS NULL OR _secret IS NULL THEN
    RAISE WARNING 'feedback_trigger_cleanup: vault secrets project_url/push_internal_secret missing';
    RETURN;
  END IF;
  PERFORM net.http_post(
    url := rtrim(_project_url, '/') || '/functions/v1/feedback-cleanup',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', _secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
END;
$$;
REVOKE ALL ON FUNCTION public.feedback_trigger_cleanup() FROM PUBLIC, anon, authenticated;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'feedback-cleanup';
SELECT cron.schedule('feedback-cleanup', '30 3 * * *', 'SELECT public.feedback_trigger_cleanup()');
