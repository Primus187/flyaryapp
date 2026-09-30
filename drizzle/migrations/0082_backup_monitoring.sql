-- Monitored backups (Flightbook replacement step 6, decision 2026-09-30: daily backup on the operator's
-- PC with scripts/db-backup.mjs, started by a Windows scheduled task).
--
-- Every run reports itself with report_backup_run() (called by the script through the Management API).
-- Flyary admins get a push when a run reports errors, and once a day when no successful run arrived for
-- 48 hours (pg_cron, 07:15 UTC). Only admins read the list; no app role writes to it.

CREATE TABLE IF NOT EXISTS public.ops_backup_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finished_at timestamptz NOT NULL DEFAULT now(),
  ok boolean NOT NULL,
  snapshot text,
  host text,
  git_commit text,
  tables integer,
  rows_total bigint,
  files_total integer,
  files_downloaded integer,
  files_failed integer,
  message text
);
CREATE INDEX IF NOT EXISTS ops_backup_runs_finished_idx ON public.ops_backup_runs (finished_at DESC);
ALTER TABLE public.ops_backup_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ops_backup_runs FROM anon, authenticated;
GRANT SELECT ON public.ops_backup_runs TO authenticated;
DROP POLICY IF EXISTS "Admins read backup runs" ON public.ops_backup_runs;
CREATE POLICY "Admins read backup runs" ON public.ops_backup_runs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.ops_backup_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sent_at timestamptz NOT NULL DEFAULT now(),
  kind text NOT NULL CHECK (kind IN ('failed', 'missing'))
);
ALTER TABLE public.ops_backup_alerts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ops_backup_alerts FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.notify_admins_backup(_kind text, _body text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _admin record;
BEGIN
  INSERT INTO public.ops_backup_alerts (kind) VALUES (_kind);
  FOR _admin IN SELECT DISTINCT user_id FROM public.user_roles WHERE role = 'admin' LOOP
    PERFORM public.send_push_notification(_admin.user_id,
      CASE _kind WHEN 'failed' THEN 'Sicherung mit Fehlern' ELSE 'Sicherung fehlt' END, _body, '/more');
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_admins_backup(text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.report_backup_run(_ok boolean, _snapshot text, _host text, _git_commit text,
  _tables integer, _rows_total bigint, _files_total integer, _files_downloaded integer, _files_failed integer, _message text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.ops_backup_runs (ok, snapshot, host, git_commit, tables, rows_total, files_total, files_downloaded, files_failed, message)
  VALUES (_ok, _snapshot, left(_host, 100), _git_commit, _tables, _rows_total, _files_total, _files_downloaded, _files_failed, left(_message, 2000));
  IF NOT _ok THEN
    PERFORM public.notify_admins_backup('failed',
      COALESCE(left(_message, 150), 'Die Sicherung meldete Fehler.') || ' Details im Protokoll auf dem Sicherungs-PC.');
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.report_backup_run(boolean, text, text, text, integer, bigint, integer, integer, integer, text) FROM PUBLIC, anon, authenticated;

-- Daily: no successful run for 48 hours → one push per day.
CREATE OR REPLACE FUNCTION public.check_backup_freshness()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _last timestamptz;
BEGIN
  SELECT max(finished_at) INTO _last FROM public.ops_backup_runs WHERE ok;
  IF (_last IS NULL OR _last < now() - interval '48 hours')
     AND NOT EXISTS (SELECT 1 FROM public.ops_backup_alerts WHERE kind = 'missing' AND sent_at > now() - interval '20 hours') THEN
    PERFORM public.notify_admins_backup('missing', CASE WHEN _last IS NULL
      THEN 'Noch keine erfolgreiche Sicherung gemeldet. Läuft die geplante Aufgabe auf dem Sicherungs-PC?'
      ELSE 'Letzte erfolgreiche Sicherung: ' || to_char(_last AT TIME ZONE 'Europe/Zurich', 'DD.MM.YYYY HH24:MI') || '. Ist der Sicherungs-PC eingeschaltet?' END);
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.check_backup_freshness() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'backup-freshness';
    PERFORM cron.schedule('backup-freshness', '15 7 * * *', 'SELECT public.check_backup_freshness()');
  END IF;
END;
$$;
