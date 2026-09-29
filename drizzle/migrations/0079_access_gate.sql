-- Pilot phase access (decision 2026-09-30): signing in with Google stays open to everyone, but a new
-- account needs an invitation before it can use the app. Without one the app shows a waiting room
-- (join the test list or redeem an invitation).
--
-- Access is granted by
--   * joining a school or group with its invite link (any new group membership grants access),
--   * a personal invitation link that a Flyary admin creates from the test list (single use, 14 days,
--     only the SHA-256 hash of the token is stored, as for passenger links in 0076),
--   * a Flyary admin directly, for people who already signed in and joined the test list in the app.
-- All accounts that exist when this migration runs keep their access ('existing').
-- app_settings.signup_mode = 'open' ends the pilot phase: then everyone has access.
--
-- The waiting room is a product gate, not a security boundary: a new account only sees its own data.
-- The security-relevant parts are enforced here: only Flyary admins create flight schools (or turn a
-- group into one), and only accounts with access create groups.

CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value text NOT NULL
);
INSERT INTO public.app_settings (key, value) VALUES ('signup_mode', 'invite') ON CONFLICT (key) DO NOTHING;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_settings FROM anon, authenticated;
GRANT SELECT ON public.app_settings TO authenticated;
GRANT UPDATE (value) ON public.app_settings TO authenticated;
DROP POLICY IF EXISTS "Everyone signed in reads app settings" ON public.app_settings;
CREATE POLICY "Everyone signed in reads app settings" ON public.app_settings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins change app settings" ON public.app_settings;
CREATE POLICY "Admins change app settings" ON public.app_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.app_access (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_via text NOT NULL CHECK (granted_via IN ('existing', 'group', 'invite_link', 'admin')),
  granted_by uuid,
  granted_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.app_access (user_id, granted_via) SELECT id, 'existing' FROM auth.users ON CONFLICT (user_id) DO NOTHING;
ALTER TABLE public.app_access ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_access FROM anon, authenticated;
GRANT SELECT ON public.app_access TO authenticated;
DROP POLICY IF EXISTS "Own access and admins" ON public.app_access;
CREATE POLICY "Own access and admins" ON public.app_access FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.has_app_access(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.app_access WHERE user_id = _user_id)
    OR COALESCE((SELECT value FROM public.app_settings WHERE key = 'signup_mode'), 'invite') = 'open');
$$;
REVOKE ALL ON FUNCTION public.has_app_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_app_access(uuid) TO authenticated;

-- Joining a school or group (invite link, or added by its admins) grants access.
CREATE OR REPLACE FUNCTION public.grant_access_on_membership()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.app_access (user_id, granted_via) VALUES (NEW.user_id, 'group') ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.grant_access_on_membership() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS group_members_grant_access ON public.group_members;
CREATE TRIGGER group_members_grant_access AFTER INSERT ON public.group_members
  FOR EACH ROW EXECUTE FUNCTION public.grant_access_on_membership();

-- Only accounts with access create groups (else a waiting account could grant itself access).
DROP POLICY IF EXISTS "Authenticated users can create groups" ON public.groups;
CREATE POLICY "Authenticated users can create groups" ON public.groups FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by AND public.has_app_access(auth.uid()));

-- Only Flyary admins create flight schools or change a group's type (a school admin can confirm
-- flights, so a self-made "school" would undermine confirmed school flights). Migrations and the
-- service role (no auth.uid()) are not affected.
CREATE OR REPLACE FUNCTION public.guard_school_groups()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin')
     AND ((TG_OP = 'INSERT' AND NEW.group_type = 'school')
       OR (TG_OP = 'UPDATE' AND NEW.group_type IS DISTINCT FROM OLD.group_type)) THEN
    RAISE EXCEPTION 'Only Flyary admins create flight schools' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_school_groups() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS groups_guard_school ON public.groups;
CREATE TRIGGER groups_guard_school BEFORE INSERT OR UPDATE ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.guard_school_groups();

-- Test list: entries made in the app belong to the account; invitations sent from the test list.
ALTER TABLE public.pilot_waitlist ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.pilot_waitlist ADD COLUMN IF NOT EXISTS invited_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS pilot_waitlist_user_idx ON public.pilot_waitlist (user_id) WHERE user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.access_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  waitlist_id uuid REFERENCES public.pilot_waitlist(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '14 days',
  redeemed_at timestamptz,
  redeemed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE public.access_invites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.access_invites FROM anon, authenticated;
GRANT SELECT ON public.access_invites TO authenticated;
DROP POLICY IF EXISTS "Admins read access invites" ON public.access_invites;
CREATE POLICY "Admins read access invites" ON public.access_invites FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.access_invite_hash(_token text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT encode(sha256(convert_to(COALESCE(_token, ''), 'UTF8')), 'hex');
$$;
REVOKE ALL ON FUNCTION public.access_invite_hash(text) FROM PUBLIC, anon, authenticated;

-- Admin: personal invitation for a test list entry. Returns the token once; an older unused link of the
-- same entry stops working.
CREATE OR REPLACE FUNCTION public.create_access_invite(_waitlist_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _token text := encode(sha256(convert_to(gen_random_uuid()::text || gen_random_uuid()::text || clock_timestamp()::text, 'UTF8')), 'hex');
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
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
REVOKE ALL ON FUNCTION public.create_access_invite(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_access_invite(uuid) TO authenticated;

-- Signed-in account redeems a personal link: 'ok', 'invalid', 'expired' or 'used'.
CREATE OR REPLACE FUNCTION public.redeem_access_invite(_token text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _invite public.access_invites%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
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
REVOKE ALL ON FUNCTION public.redeem_access_invite(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_access_invite(text) TO authenticated;

-- Admin: give an account that is already signed in access (test list entry made in the app).
CREATE OR REPLACE FUNCTION public.grant_app_access(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Flyary admin required' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.app_access (user_id, granted_via, granted_by) VALUES (_user_id, 'admin', auth.uid())
    ON CONFLICT (user_id) DO NOTHING;
  UPDATE public.pilot_waitlist SET handled_at = COALESCE(handled_at, now()) WHERE user_id = _user_id;
END;
$$;
REVOKE ALL ON FUNCTION public.grant_app_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.grant_app_access(uuid) TO authenticated;

-- Waiting room: join the test list with the account's name and e-mail. Returns 'ok' or 'invalid'.
-- Admins get the same push as for website sign-ups when the account is new on the list.
CREATE OR REPLACE FUNCTION public.join_waitlist_from_app(_language text, _role text, _disciplines text[], _school text, _comment text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _email text;
  _name text;
  _clean_school text := NULLIF(trim(COALESCE(_school, '')), '');
  _clean_comment text := NULLIF(trim(COALESCE(_comment, '')), '');
  _notify boolean;
  _admin record;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  SELECT lower(u.email), COALESCE(NULLIF(trim(p.pilot_name), ''), NULLIF(trim(u.raw_user_meta_data->>'full_name'), ''),
         NULLIF(trim(u.raw_user_meta_data->>'name'), ''), split_part(u.email, '@', 1))
    INTO _email, _name
    FROM auth.users u LEFT JOIN public.profiles p ON p.user_id = u.id WHERE u.id = _uid;
  _name := left(_name, 100);
  IF char_length(_name) < 2 THEN _name := rpad(_name, 2, '.'); END IF;
  IF _email IS NULL OR char_length(_email) > 200 OR _email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
     OR COALESCE(_language, '') NOT IN ('de', 'fr', 'en')
     OR COALESCE(_role, '') NOT IN ('student', 'pilot', 'tandem_pilot', 'instructor')
     OR NOT (COALESCE(_disciplines, '{}') <@ ARRAY['paraglider', 'hangglider'])
     OR char_length(COALESCE(_clean_school, '')) > 120 OR char_length(COALESCE(_clean_comment, '')) > 1000 THEN
    RETURN 'invalid';
  END IF;

  SELECT NOT EXISTS (SELECT 1 FROM public.pilot_waitlist WHERE lower(email) = _email AND user_id = _uid) INTO _notify;
  DELETE FROM public.pilot_waitlist WHERE user_id = _uid AND lower(email) <> _email;
  INSERT INTO public.pilot_waitlist (name, email, language, role, disciplines, school, comment, consent_at, user_id)
  VALUES (_name, _email, _language, _role, COALESCE(_disciplines, '{}'), _clean_school, _clean_comment, now(), _uid)
  ON CONFLICT (lower(email)) DO UPDATE SET
    name = EXCLUDED.name, language = EXCLUDED.language, role = EXCLUDED.role, disciplines = EXCLUDED.disciplines,
    school = EXCLUDED.school, comment = EXCLUDED.comment, consent_at = EXCLUDED.consent_at,
    user_id = EXCLUDED.user_id, handled_at = NULL, updated_at = now();

  IF _notify THEN
    FOR _admin IN SELECT DISTINCT user_id FROM public.user_roles WHERE role = 'admin' LOOP
      PERFORM public.send_push_notification(_admin.user_id, 'Neuer Testpilot',
        _name || ' ist angemeldet und wartet auf die Freischaltung.', '/admin/waitlist');
    END LOOP;
  END IF;
  RETURN 'ok';
END;
$$;
REVOKE ALL ON FUNCTION public.join_waitlist_from_app(text, text, text[], text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_waitlist_from_app(text, text, text[], text, text) TO authenticated;

-- What the app needs for the gate: {"has_access", "waitlisted", "invited"}.
CREATE OR REPLACE FUNCTION public.my_access()
RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT json_build_object(
    'has_access', public.has_app_access(auth.uid()),
    'waitlisted', w.id IS NOT NULL,
    'invited', w.invited_at IS NOT NULL)
  FROM (SELECT 1) one
  LEFT JOIN LATERAL (
    SELECT id, invited_at FROM public.pilot_waitlist
    WHERE user_id = auth.uid() OR lower(email) = (SELECT lower(email) FROM auth.users WHERE id = auth.uid())
    ORDER BY (user_id = auth.uid()) DESC NULLS LAST LIMIT 1) w ON true;
$$;
REVOKE ALL ON FUNCTION public.my_access() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_access() TO authenticated;

NOTIFY pgrst, 'reload schema';
