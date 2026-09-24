-- Leaving Lovable Cloud: no hard-coded project URL or anon key in the database any more.
-- Both values now come from Vault, so the same migrations work for any Supabase project:
--   select vault.create_secret('https://<ref>.supabase.co', 'project_url');
--   select vault.create_secret(encode(gen_random_bytes(32), 'hex'), 'push_internal_secret');
-- send-push is deployed with verify_jwt = false (supabase/config.toml) and authorizes callers
-- itself (service-role key, own user_id, or x-push-secret), so no anon key is needed here.
CREATE OR REPLACE FUNCTION public.send_push_notification(
  _user_id uuid,
  _title text,
  _body text,
  _url text DEFAULT '/'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _project_url text;
  _secret text;
BEGIN
  SELECT decrypted_secret INTO _project_url FROM vault.decrypted_secrets WHERE name = 'project_url' LIMIT 1;
  SELECT decrypted_secret INTO _secret FROM vault.decrypted_secrets WHERE name = 'push_internal_secret' LIMIT 1;
  IF _project_url IS NULL OR _secret IS NULL THEN
    RAISE WARNING 'send_push_notification: vault secrets project_url/push_internal_secret missing, push skipped';
    RETURN;
  END IF;
  PERFORM net.http_post(
    url := rtrim(_project_url, '/') || '/functions/v1/send-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', _secret),
    body := jsonb_build_object('user_id', _user_id::text, 'title', _title, 'body', _body, 'url', _url)
  );
EXCEPTION WHEN OTHERS THEN
  -- A failed push must never abort the signup/notification transaction that triggered it.
  NULL;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.send_push_notification(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
