-- Error reports from the app (operations): errors the app catches – a page that fails to render, uncaught
-- errors and rejected promises, lazy page files missing after a deploy – are reported silently so the
-- admin sees them without users having to tell. Same error = one row with a counter (fingerprint from
-- kind, message and app version); a resolved error that comes back opens a new row.
--   Writing only through report_client_error(): lengths are cut, max 30 reports per person and hour
--   (signed out: 200 per hour in total), rows not seen for 90 days are removed.
--   Reading and resolving: Flyary admins only.

CREATE TABLE IF NOT EXISTS public.client_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('render', 'error', 'rejection', 'chunk')),
  message text NOT NULL CHECK (char_length(message) <= 500),
  stack text CHECK (char_length(stack) <= 4000),
  path text CHECK (char_length(path) <= 300),
  app_version text CHECK (char_length(app_version) <= 60),
  user_agent text CHECK (char_length(user_agent) <= 300),
  user_ids uuid[] NOT NULL DEFAULT '{}',
  occurrences integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS client_errors_open ON public.client_errors (fingerprint) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS client_errors_last_seen ON public.client_errors (last_seen_at DESC);
ALTER TABLE public.client_errors ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.client_errors FROM anon, authenticated;
GRANT SELECT, UPDATE (resolved_at) ON public.client_errors TO authenticated;
CREATE POLICY "Admins read error reports" ON public.client_errors FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins resolve error reports" ON public.client_errors FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Per-hour counter for the rate limit (one row per reporter and hour; NULL reporter = signed out).
CREATE TABLE IF NOT EXISTS public.client_error_quota (
  reporter uuid,
  hour timestamptz NOT NULL,
  reports integer NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS client_error_quota_key ON public.client_error_quota (coalesce(reporter, '00000000-0000-0000-0000-000000000000'::uuid), hour);
ALTER TABLE public.client_error_quota ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.client_error_quota FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.report_client_error(
  _kind text, _message text, _stack text DEFAULT NULL, _path text DEFAULT NULL,
  _app_version text DEFAULT NULL, _user_agent text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _hour timestamptz := date_trunc('hour', now());
  _count integer;
  _msg text := left(coalesce(nullif(trim(_message), ''), '(no message)'), 500);
  _version text := left(_app_version, 60);
BEGIN
  IF _kind NOT IN ('render', 'error', 'rejection', 'chunk') THEN RETURN; END IF;

  INSERT INTO public.client_error_quota AS q (reporter, hour, reports) VALUES (_uid, _hour, 1)
  ON CONFLICT (coalesce(reporter, '00000000-0000-0000-0000-000000000000'::uuid), hour)
  DO UPDATE SET reports = q.reports + 1
  RETURNING reports INTO _count;
  IF _count > (CASE WHEN _uid IS NULL THEN 200 ELSE 30 END) THEN RETURN; END IF;

  INSERT INTO public.client_errors AS e (fingerprint, kind, message, stack, path, app_version, user_agent, user_ids)
  VALUES (md5(_kind || '|' || _msg || '|' || coalesce(_version, '')), _kind, _msg, left(_stack, 4000), left(_path, 300),
          _version, left(_user_agent, 300), CASE WHEN _uid IS NULL THEN '{}'::uuid[] ELSE ARRAY[_uid] END)
  ON CONFLICT (fingerprint) WHERE resolved_at IS NULL DO UPDATE SET
    occurrences = e.occurrences + 1,
    last_seen_at = now(),
    path = coalesce(EXCLUDED.path, e.path),
    user_agent = coalesce(EXCLUDED.user_agent, e.user_agent),
    user_ids = CASE WHEN _uid IS NULL OR _uid = ANY (e.user_ids) OR cardinality(e.user_ids) >= 50 THEN e.user_ids
                    ELSE e.user_ids || _uid END;

  -- housekeeping
  DELETE FROM public.client_errors WHERE last_seen_at < now() - interval '90 days';
  DELETE FROM public.client_error_quota WHERE hour < _hour - interval '1 day';
END $$;
REVOKE ALL ON FUNCTION public.report_client_error(text, text, text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.report_client_error(text, text, text, text, text, text) TO anon, authenticated;
