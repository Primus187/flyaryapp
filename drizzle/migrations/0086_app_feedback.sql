-- Betriebsbereich step 4 (plan "Umsetzungsplan Betriebsbereich", §7): feedback from testers inside the app,
-- with up to three screenshots (decision 2026-09-30: screenshots are needed).
--
-- Flow: submit_feedback() stores the text and returns the id, the app uploads the screenshots to the private
-- bucket feedback-screenshots under <user id>/<feedback id>/<n>.webp, then finish_feedback() records the
-- files and pushes the Flyary admins. Only then does the feedback count as submitted; a submission that is
-- never finished is removed after a day. Screenshots are deleted 90 days after the feedback was marked done,
-- the text stays. Files can only be deleted through the Storage API: feedback_daily_cleanup() returns the
-- paths to the Edge Function feedback-cleanup (scheduled in 0087), as for the marketplace (0039/0040).

CREATE TABLE IF NOT EXISTS public.app_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('idea', 'problem', 'praise', 'question')),
  message text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 2000),
  path text CHECK (char_length(path) <= 300),
  app_version text CHECK (char_length(app_version) <= 60),
  user_agent text CHECK (char_length(user_agent) <= 300),
  screenshot_paths text[] NOT NULL DEFAULT '{}' CHECK (cardinality(screenshot_paths) <= 3),
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'done')),
  admin_note text CHECK (char_length(admin_note) <= 1000),
  handled_at timestamptz
);
CREATE INDEX IF NOT EXISTS app_feedback_open_idx ON public.app_feedback (created_at DESC) WHERE status <> 'done';
CREATE INDEX IF NOT EXISTS app_feedback_user_idx ON public.app_feedback (user_id, created_at DESC);
ALTER TABLE public.app_feedback ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_feedback FROM anon, authenticated;
GRANT SELECT ON public.app_feedback TO authenticated;
DROP POLICY IF EXISTS "Own feedback and admins" ON public.app_feedback;
CREATE POLICY "Own feedback and admins" ON public.app_feedback FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_ops_admin());

-- Storage ------------------------------------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('feedback-screenshots', 'feedback-screenshots', false, 1048576, ARRAY['image/webp', 'image/jpeg'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 1048576, allowed_mime_types = ARRAY['image/webp', 'image/jpeg'];

-- May the signed-in account upload this file? Own folder, own feedback that is not finished yet and at most
-- an hour old, file name 0–2 with .webp/.jpg, fewer than three files so far. SECURITY DEFINER so the file
-- count does not run through the storage policies again.
CREATE OR REPLACE FUNCTION public.feedback_upload_allowed(_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL
    AND _name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-2]\.(webp|jpg)$'
    AND split_part(_name, '/', 1) = auth.uid()::text
    AND EXISTS (SELECT 1 FROM public.app_feedback f
                WHERE f.id::text = split_part(_name, '/', 2) AND f.user_id = auth.uid()
                  AND f.finished_at IS NULL AND f.created_at > now() - interval '1 hour')
    AND (SELECT count(*) FROM storage.objects o
         WHERE o.bucket_id = 'feedback-screenshots'
           AND o.name LIKE split_part(_name, '/', 1) || '/' || split_part(_name, '/', 2) || '/%') < 3;
$$;
REVOKE ALL ON FUNCTION public.feedback_upload_allowed(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.feedback_upload_allowed(text) TO authenticated;

DROP POLICY IF EXISTS "Testers upload feedback screenshots" ON storage.objects;
CREATE POLICY "Testers upload feedback screenshots" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'feedback-screenshots' AND public.feedback_upload_allowed(name));

DROP POLICY IF EXISTS "Own feedback screenshots and admins" ON storage.objects;
CREATE POLICY "Own feedback screenshots and admins" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'feedback-screenshots'
    AND (split_part(name, '/', 1) = auth.uid()::text OR public.is_ops_admin()));
-- No UPDATE or DELETE policy: files are neither replaced nor removed by users (cleanup runs as service role).

-- Submitting ---------------------------------------------------------------------------------------------------

-- Returns the new feedback id. At most 10 per account and hour.
CREATE OR REPLACE FUNCTION public.submit_feedback(_kind text, _message text, _path text, _app_version text, _user_agent text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _id uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF (SELECT count(*) FROM public.app_feedback WHERE user_id = _uid AND created_at > now() - interval '1 hour') >= 10 THEN
    RAISE EXCEPTION 'feedback:rate_limited' USING ERRCODE = '54000';
  END IF;
  INSERT INTO public.app_feedback (user_id, kind, message, path, app_version, user_agent)
  VALUES (_uid, _kind, btrim(COALESCE(_message, '')), left(_path, 300), left(_app_version, 60), left(_user_agent, 300))
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;
REVOKE ALL ON FUNCTION public.submit_feedback(text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_feedback(text, text, text, text, text) TO authenticated;

-- Records the uploaded screenshots (only files that really exist in the account's folder) and notifies the
-- admins. Called once, also when an upload failed (the feedback then has fewer or no screenshots).
CREATE OR REPLACE FUNCTION public.finish_feedback(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _kind text;
  _message text;
  _paths text[];
  _name text;
  _admin record;
BEGIN
  SELECT kind, message INTO _kind, _message FROM public.app_feedback
    WHERE id = _id AND user_id = _uid AND finished_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown or finished feedback' USING ERRCODE = 'P0002';
  END IF;
  SELECT COALESCE(array_agg(o.name ORDER BY o.name), '{}') INTO _paths FROM (
    SELECT name FROM storage.objects
    WHERE bucket_id = 'feedback-screenshots' AND name LIKE _uid::text || '/' || _id::text || '/%'
    ORDER BY name LIMIT 3) o;
  UPDATE public.app_feedback SET finished_at = now(), screenshot_paths = _paths WHERE id = _id;

  SELECT COALESCE(NULLIF(btrim(p.pilot_name), ''), split_part(u.email, '@', 1)) INTO _name
    FROM auth.users u LEFT JOIN public.profiles p ON p.user_id = u.id WHERE u.id = _uid;
  FOR _admin IN SELECT DISTINCT user_id FROM public.user_roles WHERE role = 'admin' LOOP
    PERFORM public.send_push_notification(_admin.user_id,
      CASE _kind WHEN 'problem' THEN 'Feedback: Problem' WHEN 'idea' THEN 'Feedback: Idee'
                 WHEN 'praise' THEN 'Feedback: Lob' ELSE 'Feedback: Frage' END,
      COALESCE(_name, '?') || ': ' || left(_message, 120), '/admin/feedback');
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.finish_feedback(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finish_feedback(uuid) TO authenticated;

-- Admin --------------------------------------------------------------------------------------------------------

-- Submitted feedback with the author's name and e-mail (for replying), newest first.
CREATE OR REPLACE FUNCTION public.ops_feedback_list()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_ops_admin() THEN
    RAISE EXCEPTION 'Flyary admin required' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE((SELECT jsonb_agg(x ORDER BY x->>'created_at' DESC) FROM (
    SELECT jsonb_build_object(
      'id', f.id, 'kind', f.kind, 'message', f.message, 'path', f.path, 'app_version', f.app_version,
      'user_agent', f.user_agent, 'screenshot_paths', to_jsonb(f.screenshot_paths), 'created_at', f.created_at,
      'status', f.status, 'admin_note', f.admin_note, 'handled_at', f.handled_at,
      'user_id', f.user_id, 'name', COALESCE(NULLIF(btrim(p.pilot_name), ''), split_part(u.email, '@', 1)), 'email', u.email) AS x
    FROM public.app_feedback f
    LEFT JOIN auth.users u ON u.id = f.user_id
    LEFT JOIN public.profiles p ON p.user_id = f.user_id
    WHERE f.finished_at IS NOT NULL
    ORDER BY f.created_at DESC LIMIT 500) q), '[]'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.ops_feedback_list() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ops_feedback_list() TO authenticated;

CREATE OR REPLACE FUNCTION public.ops_set_feedback(_id uuid, _status text, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_ops_admin() THEN
    RAISE EXCEPTION 'Flyary admin required' USING ERRCODE = '42501';
  END IF;
  UPDATE public.app_feedback
    SET status = _status, admin_note = NULLIF(btrim(COALESCE(_note, '')), ''),
        handled_at = CASE WHEN _status = 'done' THEN COALESCE(handled_at, now()) ELSE NULL END
    WHERE id = _id AND finished_at IS NOT NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown feedback' USING ERRCODE = 'P0002';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.ops_set_feedback(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ops_set_feedback(uuid, text, text) TO authenticated;

-- Cleanup (service role, Edge Function feedback-cleanup) ----------------------------------------------------------

-- Returns {"paths": [...], "expired_screenshots": n, "abandoned": n}:
--   1. screenshots of feedback marked done more than 90 days ago (the text stays)
--   2. submissions never finished within a day are deleted with their files
--   3. files older than a day that no feedback points to (account deleted, upload after a failed finish)
CREATE OR REPLACE FUNCTION public.feedback_daily_cleanup()
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _expired integer;
  _abandoned integer;
  _paths text[];
BEGIN
  WITH done AS (
    UPDATE public.app_feedback SET screenshot_paths = '{}'
    WHERE status = 'done' AND handled_at < now() - interval '90 days' AND cardinality(screenshot_paths) > 0
    RETURNING id)
  SELECT count(*) INTO _expired FROM done;
  WITH gone AS (
    DELETE FROM public.app_feedback WHERE finished_at IS NULL AND created_at < now() - interval '1 day' RETURNING id)
  SELECT count(*) INTO _abandoned FROM gone;
  SELECT COALESCE(array_agg(o.name), '{}') INTO _paths FROM storage.objects o
  WHERE o.bucket_id = 'feedback-screenshots' AND o.created_at < now() - interval '1 day'
    AND NOT EXISTS (SELECT 1 FROM public.app_feedback f WHERE o.name = ANY (f.screenshot_paths));
  RETURN jsonb_build_object('paths', to_jsonb(_paths), 'expired_screenshots', _expired, 'abandoned', _abandoned);
END;
$$;
REVOKE ALL ON FUNCTION public.feedback_daily_cleanup() FROM PUBLIC, anon, authenticated;

-- Overview (body from 0083, plus open feedback) --------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ops_overview()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _last public.ops_backup_runs;
BEGIN
  IF NOT public.is_ops_admin() THEN
    RAISE EXCEPTION 'Flyary admin required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO _last FROM public.ops_backup_runs ORDER BY finished_at DESC LIMIT 1;
  RETURN jsonb_build_object(
    'waitlist_open', (SELECT count(*) FROM public.pilot_waitlist WHERE handled_at IS NULL),
    'errors_open', (SELECT count(*) FROM public.client_errors WHERE resolved_at IS NULL),
    'errors_new_24h', (SELECT count(*) FROM public.client_errors
                         WHERE resolved_at IS NULL AND created_at > now() - interval '24 hours'),
    'market_reports_open', (SELECT count(DISTINCT l.id) FROM public.marketplace_listings l
                              JOIN public.marketplace_reports r ON r.listing_id = l.id AND r.status = 'open'
                              WHERE public.market_can_moderate(auth.uid(), l)),
    'feedback_open', (SELECT count(*) FROM public.app_feedback WHERE finished_at IS NOT NULL AND status <> 'done'),
    'backup_last_at', _last.finished_at,
    'backup_last_ok', _last.ok,
    'backup_last_success_at', (SELECT max(finished_at) FROM public.ops_backup_runs WHERE ok),
    'storage_bytes', (SELECT coalesce(sum((metadata->>'size')::bigint), 0) FROM storage.objects));
END;
$$;
