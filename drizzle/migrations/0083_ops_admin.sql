-- Betriebsbereich step 1 (plan "Umsetzungsplan Betriebsbereich", §4): one admin check for all operator
-- functions and the counters for the /admin overview.
--
-- is_ops_admin() is the Flyary admin check for the signed-in account. Every policy and function that asked
-- has_role(auth.uid(), 'admin') now asks is_ops_admin() instead (taken from the live definitions on
-- 2026-09-30, only that call changed). Step 5 (two-factor sign-in) then only has to change this one
-- function. has_role() itself stays: it is also asked about other accounts (e.g. who gets a push).

CREATE OR REPLACE FUNCTION public.is_ops_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin');
$$;
REVOKE ALL ON FUNCTION public.is_ops_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_ops_admin() TO authenticated;

-- Marketplace staff is asked with an account id; for the signed-in account the admin part goes through
-- is_ops_admin(), for any other account it stays the plain role check (same result today).
CREATE OR REPLACE FUNCTION public.is_market_staff(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN _uid = auth.uid() THEN public.is_ops_admin() ELSE public.has_role(_uid, 'admin') END
    OR public.has_role(_uid, 'moderator');
$$;

-- Policies ------------------------------------------------------------------------------------------------

DROP POLICY IF EXISTS "Admins read access invites" ON public.access_invites;
CREATE POLICY "Admins read access invites" ON public.access_invites FOR SELECT TO authenticated
  USING (public.is_ops_admin());

DROP POLICY IF EXISTS "Own access and admins" ON public.app_access;
CREATE POLICY "Own access and admins" ON public.app_access FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_ops_admin());

DROP POLICY IF EXISTS "Admins change app settings" ON public.app_settings;
CREATE POLICY "Admins change app settings" ON public.app_settings FOR UPDATE TO authenticated
  USING (public.is_ops_admin()) WITH CHECK (public.is_ops_admin());

DROP POLICY IF EXISTS "Admins read error reports" ON public.client_errors;
CREATE POLICY "Admins read error reports" ON public.client_errors FOR SELECT TO authenticated
  USING (public.is_ops_admin());
DROP POLICY IF EXISTS "Admins resolve error reports" ON public.client_errors;
CREATE POLICY "Admins resolve error reports" ON public.client_errors FOR UPDATE TO authenticated
  USING (public.is_ops_admin()) WITH CHECK (public.is_ops_admin());

DROP POLICY IF EXISTS "Admins manage bans" ON public.marketplace_bans;
CREATE POLICY "Admins manage bans" ON public.marketplace_bans FOR ALL TO authenticated
  USING (public.is_ops_admin()) WITH CHECK (public.is_ops_admin());

DROP POLICY IF EXISTS "Admins delete listings" ON public.marketplace_listings;
CREATE POLICY "Admins delete listings" ON public.marketplace_listings FOR DELETE TO authenticated
  USING (public.is_ops_admin());

DROP POLICY IF EXISTS "Admins read backup runs" ON public.ops_backup_runs;
CREATE POLICY "Admins read backup runs" ON public.ops_backup_runs FOR SELECT TO authenticated
  USING (public.is_ops_admin());

DROP POLICY IF EXISTS "Admins read the pilot waitlist" ON public.pilot_waitlist;
CREATE POLICY "Admins read the pilot waitlist" ON public.pilot_waitlist FOR SELECT TO authenticated
  USING (public.is_ops_admin());
DROP POLICY IF EXISTS "Admins handle the pilot waitlist" ON public.pilot_waitlist;
CREATE POLICY "Admins handle the pilot waitlist" ON public.pilot_waitlist FOR UPDATE TO authenticated
  USING (public.is_ops_admin()) WITH CHECK (public.is_ops_admin());
DROP POLICY IF EXISTS "Admins delete from the pilot waitlist" ON public.pilot_waitlist;
CREATE POLICY "Admins delete from the pilot waitlist" ON public.pilot_waitlist FOR DELETE TO authenticated
  USING (public.is_ops_admin());

-- Functions (live bodies, only the admin check changed) ---------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_access_invite(_waitlist_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _token text := encode(sha256(convert_to(gen_random_uuid()::text || gen_random_uuid()::text || clock_timestamp()::text, 'UTF8')), 'hex');
BEGIN
  IF NOT public.is_ops_admin() THEN
    RAISE EXCEPTION 'Flyary admin required' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.pilot_waitlist WHERE id = _waitlist_id) THEN
    RAISE EXCEPTION 'Unknown test list entry';
  END IF;
  DELETE FROM public.access_invites WHERE waitlist_id = _waitlist_id AND redeemed_at IS NULL;
  INSERT INTO public.access_invites (token_hash, waitlist_id, created_by) VALUES (public.access_invite_hash(_token), _waitlist_id, auth.uid());
  UPDATE public.pilot_waitlist SET invited_at = now(), handled_at = COALESCE(handled_at, now()) WHERE id = _waitlist_id;
  RETURN _token;
END;
$$;

CREATE OR REPLACE FUNCTION public.grant_app_access(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_ops_admin() THEN
    RAISE EXCEPTION 'Flyary admin required' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.app_access (user_id, granted_via, granted_by) VALUES (_user_id, 'admin', auth.uid())
    ON CONFLICT (user_id) DO NOTHING;
  UPDATE public.pilot_waitlist SET handled_at = COALESCE(handled_at, now()) WHERE user_id = _user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_school_groups()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_ops_admin()
     AND ((TG_OP = 'INSERT' AND NEW.group_type = 'school')
       OR (TG_OP = 'UPDATE' AND NEW.group_type IS DISTINCT FROM OLD.group_type)) THEN
    RAISE EXCEPTION 'Only Flyary admins create flight schools' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.marketplace_log_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_ops_admin() AND NOT public.market_can_manage(auth.uid(), OLD.seller_user_id, OLD.seller_group_id) THEN
    INSERT INTO public.marketplace_moderation_log (listing_title, target_user_id, actor_id, action)
    VALUES (OLD.title, coalesce(OLD.seller_user_id, OLD.created_by), auth.uid(), 'delete');
  END IF;
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.marketplace_set_ban(_user uuid, _banned boolean, _until timestamptz DEFAULT NULL, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_ops_admin() THEN RAISE EXCEPTION 'marketplace:not_allowed' USING ERRCODE = '42501'; END IF;
  IF _banned THEN
    INSERT INTO public.marketplace_bans (user_id, until, reason, created_by) VALUES (_user, _until, left(_reason, 500), auth.uid())
    ON CONFLICT (user_id) DO UPDATE SET until = excluded.until, reason = excluded.reason, created_by = excluded.created_by, created_at = now();
  ELSE
    DELETE FROM public.marketplace_bans WHERE user_id = _user;
  END IF;
  INSERT INTO public.marketplace_moderation_log (target_user_id, actor_id, action, reason)
  VALUES (_user, auth.uid(), CASE WHEN _banned THEN 'ban' ELSE 'unban' END, left(_reason, 500));
END;
$$;

CREATE OR REPLACE FUNCTION public.marketplace_storage_usage()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_ops_admin() THEN RAISE EXCEPTION 'marketplace:not_allowed' USING ERRCODE = '42501'; END IF;
  RETURN (SELECT jsonb_build_object(
    'total_bytes', coalesce(sum((o.metadata->>'size')::bigint), 0),
    'buckets', coalesce((SELECT jsonb_object_agg(b.bucket_id, b.bytes) FROM (
      SELECT bucket_id, sum((metadata->>'size')::bigint) AS bytes FROM storage.objects GROUP BY bucket_id) b), '{}'::jsonb))
    FROM storage.objects o);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_official_site_name(_site_id uuid, _name text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_ops_admin() THEN
    RAISE EXCEPTION 'Admin required' USING ERRCODE = '42501';
  END IF;
  UPDATE public.official_sites SET name_override = nullif(btrim(_name), ''), updated_at = now() WHERE id = _site_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown site' USING ERRCODE = 'P0002'; END IF;
END $$;

-- Backup pushes open the new backup page instead of "Mehr".
CREATE OR REPLACE FUNCTION public.notify_admins_backup(_kind text, _body text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _admin record;
BEGIN
  INSERT INTO public.ops_backup_alerts (kind) VALUES (_kind);
  FOR _admin IN SELECT DISTINCT user_id FROM public.user_roles WHERE role = 'admin' LOOP
    PERFORM public.send_push_notification(_admin.user_id,
      CASE _kind WHEN 'failed' THEN 'Sicherung mit Fehlern' ELSE 'Sicherung fehlt' END, _body, '/admin/backups');
  END LOOP;
END;
$$;

-- Overview ------------------------------------------------------------------------------------------------

-- Counters for the /admin overview in one call. Marketplace: listings with open reports the admin moderates
-- (school moderators handle their own through /market/moderation).
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
    'backup_last_at', _last.finished_at,
    'backup_last_ok', _last.ok,
    'backup_last_success_at', (SELECT max(finished_at) FROM public.ops_backup_runs WHERE ok),
    'storage_bytes', (SELECT coalesce(sum((metadata->>'size')::bigint), 0) FROM storage.objects));
END;
$$;
REVOKE ALL ON FUNCTION public.ops_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ops_overview() TO authenticated;
