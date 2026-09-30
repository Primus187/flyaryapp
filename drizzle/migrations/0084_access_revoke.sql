-- Betriebsbereich step 2 (plan "Umsetzungsplan Betriebsbereich", §5): pause and restore app access, withdraw
-- personal invitations, and a log of every operator action.
--
-- Pausing keeps the app_access row and marks it revoked; the row is not deleted, because the membership
-- trigger (grant_access_on_membership, ON CONFLICT DO NOTHING) would otherwise hand access back on the next
-- group join. School memberships and confirmed flights stay untouched (decision 2026-09-30, plan §5.3).
-- Like the waiting room itself, this is a product gate: the app shows the waiting room, the account can no
-- longer create groups; its own data stays its own.
-- A paused account stays paused in signup_mode 'open' as well (plan: exception kept; tightened here, since
-- "open" should not silently undo a pause).

ALTER TABLE public.app_access ADD COLUMN IF NOT EXISTS revoked_at timestamptz;
ALTER TABLE public.app_access ADD COLUMN IF NOT EXISTS revoked_by uuid;
ALTER TABLE public.app_access ADD COLUMN IF NOT EXISTS revoke_reason text CHECK (char_length(revoke_reason) <= 300);

CREATE OR REPLACE FUNCTION public.has_app_access(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id IS NOT NULL AND COALESCE(
    (SELECT revoked_at IS NULL FROM public.app_access WHERE user_id = _user_id),
    COALESCE((SELECT value FROM public.app_settings WHERE key = 'signup_mode'), 'invite') = 'open');
$$;

-- Log --------------------------------------------------------------------------------------------------------

-- No foreign keys on the account columns on purpose: an entry must survive (and never block) deleting an account.
CREATE TABLE IF NOT EXISTS public.ops_admin_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  actor uuid,
  action text NOT NULL CHECK (action IN ('access_granted', 'access_revoked', 'access_restored', 'invite_created', 'invite_revoked')),
  target_user uuid,
  target_group uuid,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS ops_admin_log_created_idx ON public.ops_admin_log (created_at DESC);
ALTER TABLE public.ops_admin_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ops_admin_log FROM anon, authenticated;
GRANT SELECT ON public.ops_admin_log TO authenticated;
DROP POLICY IF EXISTS "Admins read the operator log" ON public.ops_admin_log;
CREATE POLICY "Admins read the operator log" ON public.ops_admin_log FOR SELECT TO authenticated
  USING (public.is_ops_admin());

CREATE OR REPLACE FUNCTION public.ops_log(_action text, _target_user uuid, _target_group uuid, _detail jsonb)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.ops_admin_log (actor, action, target_user, target_group, detail)
  VALUES (auth.uid(), _action, _target_user, _target_group, COALESCE(_detail, '{}'::jsonb));
$$;
REVOKE ALL ON FUNCTION public.ops_log(text, uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;

-- Existing admin functions, now logged (bodies from 0083) ------------------------------------------------------

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
  PERFORM public.ops_log('invite_created', NULL, NULL,
    (SELECT jsonb_build_object('waitlist_id', id, 'name', name, 'email', email) FROM public.pilot_waitlist WHERE id = _waitlist_id));
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
  IF FOUND THEN PERFORM public.ops_log('access_granted', _user_id, NULL, '{}'::jsonb); END IF;
  UPDATE public.pilot_waitlist SET handled_at = COALESCE(handled_at, now()) WHERE user_id = _user_id;
END;
$$;

-- A paused account cannot use up a personal link (it would stay paused anyway); the link stays valid.
CREATE OR REPLACE FUNCTION public.redeem_access_invite(_token text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _invite public.access_invites%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.app_access WHERE user_id = _uid AND revoked_at IS NOT NULL) THEN
    RETURN 'revoked';
  END IF;
  SELECT * INTO _invite FROM public.access_invites WHERE token_hash = public.access_invite_hash(_token) FOR UPDATE;
  IF NOT FOUND THEN RETURN 'invalid'; END IF;
  IF _invite.redeemed_at IS NOT NULL THEN
    RETURN CASE WHEN _invite.redeemed_by = _uid THEN 'ok' ELSE 'used' END;
  END IF;
  IF _invite.expires_at < now() THEN RETURN 'expired'; END IF;

  UPDATE public.access_invites SET redeemed_at = now(), redeemed_by = _uid WHERE id = _invite.id;
  INSERT INTO public.app_access (user_id, granted_via, granted_by) VALUES (_uid, 'invite_link', _invite.created_by)
    ON CONFLICT (user_id) DO NOTHING;
  UPDATE public.pilot_waitlist SET user_id = _uid
    WHERE id = _invite.waitlist_id AND user_id IS NULL
      AND NOT EXISTS (SELECT 1 FROM public.pilot_waitlist WHERE user_id = _uid);
  RETURN 'ok';
END;
$$;

CREATE OR REPLACE FUNCTION public.my_access()
RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT json_build_object(
    'has_access', public.has_app_access(auth.uid()),
    'waitlisted', w.id IS NOT NULL,
    'invited', w.invited_at IS NOT NULL,
    'revoked', EXISTS (SELECT 1 FROM public.app_access WHERE user_id = auth.uid() AND revoked_at IS NOT NULL))
  FROM (SELECT 1) one
  LEFT JOIN LATERAL (
    SELECT id, invited_at FROM public.pilot_waitlist
    WHERE user_id = auth.uid() OR lower(email) = (SELECT lower(email) FROM auth.users WHERE id = auth.uid())
    ORDER BY (user_id = auth.uid()) DESC NULLS LAST LIMIT 1) w ON true;
$$;

-- New admin functions ----------------------------------------------------------------------------------------

-- Pause: a reason is required; own account and other Flyary admins cannot be paused. Returns nothing,
-- raises P0002 when the account has no access to pause.
CREATE OR REPLACE FUNCTION public.revoke_app_access(_user_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _clean text := NULLIF(btrim(COALESCE(_reason, '')), '');
BEGIN
  IF NOT public.is_ops_admin() THEN
    RAISE EXCEPTION 'Flyary admin required' USING ERRCODE = '42501';
  END IF;
  IF _clean IS NULL OR char_length(_clean) > 300 THEN
    RAISE EXCEPTION 'A reason (up to 300 characters) is required' USING ERRCODE = '22023';
  END IF;
  IF _user_id = auth.uid() OR public.has_role(_user_id, 'admin') THEN
    RAISE EXCEPTION 'Flyary admins cannot be paused' USING ERRCODE = '42501';
  END IF;
  UPDATE public.app_access SET revoked_at = now(), revoked_by = auth.uid(), revoke_reason = _clean
    WHERE user_id = _user_id AND revoked_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active access to pause' USING ERRCODE = 'P0002';
  END IF;
  PERFORM public.ops_log('access_revoked', _user_id, NULL, jsonb_build_object('reason', _clean));
END;
$$;
REVOKE ALL ON FUNCTION public.revoke_app_access(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_app_access(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.restore_app_access(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _reason text;
BEGIN
  IF NOT public.is_ops_admin() THEN
    RAISE EXCEPTION 'Flyary admin required' USING ERRCODE = '42501';
  END IF;
  SELECT revoke_reason INTO _reason FROM public.app_access WHERE user_id = _user_id AND revoked_at IS NOT NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Access is not paused' USING ERRCODE = 'P0002';
  END IF;
  UPDATE public.app_access SET revoked_at = NULL, revoked_by = NULL, revoke_reason = NULL WHERE user_id = _user_id;
  PERFORM public.ops_log('access_restored', _user_id, NULL, jsonb_build_object('previous_reason', _reason));
END;
$$;
REVOKE ALL ON FUNCTION public.restore_app_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_app_access(uuid) TO authenticated;

-- Withdraw a personal invitation that was not redeemed yet (e.g. sent to a wrong address).
CREATE OR REPLACE FUNCTION public.revoke_access_invite(_waitlist_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_ops_admin() THEN
    RAISE EXCEPTION 'Flyary admin required' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.access_invites WHERE waitlist_id = _waitlist_id AND redeemed_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No open invitation' USING ERRCODE = 'P0002';
  END IF;
  UPDATE public.pilot_waitlist SET invited_at = NULL WHERE id = _waitlist_id;
  PERFORM public.ops_log('invite_revoked', NULL, NULL,
    (SELECT jsonb_build_object('waitlist_id', id, 'name', name, 'email', email) FROM public.pilot_waitlist WHERE id = _waitlist_id));
END;
$$;
REVOKE ALL ON FUNCTION public.revoke_access_invite(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_access_invite(uuid) TO authenticated;

-- All accounts with their access for the "Konten" tab (e-mail addresses only through this function).
CREATE OR REPLACE FUNCTION public.ops_access_list()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_ops_admin() THEN
    RAISE EXCEPTION 'Flyary admin required' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE((SELECT jsonb_agg(x ORDER BY x->>'created_at' DESC) FROM (
    SELECT jsonb_build_object(
      'user_id', u.id,
      'name', COALESCE(NULLIF(btrim(p.pilot_name), ''), NULLIF(btrim(u.raw_user_meta_data->>'full_name'), ''), split_part(u.email, '@', 1)),
      'email', u.email,
      'created_at', u.created_at,
      'last_sign_in_at', u.last_sign_in_at,
      'granted_via', a.granted_via,
      'granted_at', a.granted_at,
      'revoked_at', a.revoked_at,
      'revoke_reason', a.revoke_reason,
      'is_admin', public.has_role(u.id, 'admin'),
      'schools', COALESCE((SELECT jsonb_agg(g.name ORDER BY g.name) FROM public.group_members gm
                             JOIN public.groups g ON g.id = gm.group_id AND g.group_type = 'school'
                             WHERE gm.user_id = u.id), '[]'::jsonb)) AS x
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.user_id = u.id
    LEFT JOIN public.app_access a ON a.user_id = u.id) q), '[]'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.ops_access_list() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ops_access_list() TO authenticated;

-- The operator log with readable names (latest first).
CREATE OR REPLACE FUNCTION public.ops_log_entries(_limit integer DEFAULT 100)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_ops_admin() THEN
    RAISE EXCEPTION 'Flyary admin required' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE((SELECT jsonb_agg(x ORDER BY x->>'created_at' DESC) FROM (
    SELECT jsonb_build_object(
      'id', l.id, 'created_at', l.created_at, 'action', l.action, 'detail', l.detail,
      'actor_name', COALESCE(NULLIF(btrim(pa.pilot_name), ''), ua.email),
      'target_name', COALESCE(NULLIF(btrim(pt.pilot_name), ''), ut.email, l.detail->>'name'),
      'group_name', g.name) AS x
    FROM public.ops_admin_log l
    LEFT JOIN auth.users ua ON ua.id = l.actor
    LEFT JOIN public.profiles pa ON pa.user_id = l.actor
    LEFT JOIN auth.users ut ON ut.id = l.target_user
    LEFT JOIN public.profiles pt ON pt.user_id = l.target_user
    LEFT JOIN public.groups g ON g.id = l.target_group
    ORDER BY l.created_at DESC
    LIMIT LEAST(GREATEST(COALESCE(_limit, 100), 1), 500)) q), '[]'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.ops_log_entries(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ops_log_entries(integer) TO authenticated;
