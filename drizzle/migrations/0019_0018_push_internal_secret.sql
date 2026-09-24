-- Interne Geheimnisse, die nur serverseitige Prozesse (Trigger, Funktionen) lesen duerfen.
CREATE TABLE IF NOT EXISTS public.internal_secrets (
  name text PRIMARY KEY,
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON public.internal_secrets FROM PUBLIC;
GRANT ALL ON public.internal_secrets TO service_role;

ALTER TABLE public.internal_secrets ENABLE ROW LEVEL SECURITY;
-- Bewusst keine Policies: nur die Dienst-Rolle und SECURITY-DEFINER-Funktionen koennen lesen.

INSERT INTO public.internal_secrets (name, value)
VALUES ('push_internal_secret', encode(gen_random_bytes(32), 'hex'))
ON CONFLICT (name) DO NOTHING;

-- Trigger-Funktion: sendet das interne Geheimnis als x-push-secret an die Push-Funktion.
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
  _project_url text := 'https://ofveewfalizqrjpglzpo.supabase.co';
  _anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mdmVld2ZhbGl6cXJqcGdsenBvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwNzc3MTEsImV4cCI6MjA4OTY1MzcxMX0.soRwLy0sgFfq-aaTp9hlZGhWwcIQiTGtzevKOIcQLW4';
  _secret text;
BEGIN
  SELECT value INTO _secret FROM public.internal_secrets WHERE name = 'push_internal_secret';

  PERFORM net.http_post(
    url := _project_url || '/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _anon_key,
      'x-push-secret', COALESCE(_secret, '')
    ),
    body := jsonb_build_object(
      'user_id', _user_id::text,
      'title', _title,
      'body', _body,
      'url', _url
    )
  );
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;