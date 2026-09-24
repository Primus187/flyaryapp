-- Marketplace (plan 4.9): run the Edge Function marketplace-cleanup every night at 03:15 UTC.
-- Separate from 0039 because pg_cron exists only on the real database (not in the PGlite tests).
-- The call uses the same Vault secrets as send_push_notification (project_url, push_internal_secret);
-- the function checks x-push-secret against its PUSH_INTERNAL_SECRET.
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.marketplace_trigger_cleanup()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _project_url text;
  _secret text;
BEGIN
  SELECT decrypted_secret INTO _project_url FROM vault.decrypted_secrets WHERE name = 'project_url' LIMIT 1;
  SELECT decrypted_secret INTO _secret FROM vault.decrypted_secrets WHERE name = 'push_internal_secret' LIMIT 1;
  IF _project_url IS NULL OR _secret IS NULL THEN
    RAISE WARNING 'marketplace_trigger_cleanup: vault secrets project_url/push_internal_secret missing';
    RETURN;
  END IF;
  PERFORM net.http_post(
    url := rtrim(_project_url, '/') || '/functions/v1/marketplace-cleanup',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', _secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
END;
$$;
REVOKE ALL ON FUNCTION public.marketplace_trigger_cleanup() FROM PUBLIC, anon, authenticated;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'marketplace-cleanup';
SELECT cron.schedule('marketplace-cleanup', '15 3 * * *', 'SELECT public.marketplace_trigger_cleanup()');
