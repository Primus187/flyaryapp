-- Betriebsbereich step 3 (plan "Umsetzungsplan Betriebsbereich", §6): Flyary admins set up flight schools
-- without becoming members, and hand them over with a single-use invitation for the school lead.
--
-- Before, whoever created a school became its group admin and could see student data and, with a valid
-- certificate, confirm flights (0077). Now the school is created without members; the lead redeems a link
-- (/welcome/lead/<token>, 14 days, single use, only the SHA-256 hash is stored as in 0079) and becomes the
-- school's group admin. Admins who are still members of a school from the old way can leave it once
-- another group admin is in place.

ALTER TABLE public.ops_admin_log DROP CONSTRAINT IF EXISTS ops_admin_log_action_check;
ALTER TABLE public.ops_admin_log ADD CONSTRAINT ops_admin_log_action_check CHECK (action IN (
  'access_granted', 'access_revoked', 'access_restored', 'invite_created', 'invite_revoked',
  'school_created', 'lead_invite_created', 'lead_invite_revoked', 'lead_invite_redeemed', 'school_left'));

CREATE TABLE IF NOT EXISTS public.school_lead_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  email text NOT NULL CHECK (char_length(email) <= 200),
  language text NOT NULL CHECK (language IN ('de', 'fr', 'en')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '14 days',
  redeemed_at timestamptz,
  redeemed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
-- at most one open invitation per school
CREATE UNIQUE INDEX IF NOT EXISTS school_lead_invites_open_idx ON public.school_lead_invites (group_id) WHERE redeemed_at IS NULL;
ALTER TABLE public.school_lead_invites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.school_lead_invites FROM anon, authenticated;

-- Internal: a new open invitation for the school (replaces an open one), returns the token.
CREATE OR REPLACE FUNCTION public.ops_new_lead_invite(_group_id uuid, _email text, _language text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _token text := encode(sha256(convert_to(gen_random_uuid()::text || gen_random_uuid()::text || clock_timestamp()::text, 'UTF8')), 'hex');
  _clean text := lower(btrim(COALESCE(_email, '')));
BEGIN
  IF char_length(_clean) > 200 OR _clean !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Invalid e-mail address' USING ERRCODE = '22023';
  END IF;
  IF COALESCE(_language, '') NOT IN ('de', 'fr', 'en') THEN
    RAISE EXCEPTION 'Invalid language' USING ERRCODE = '22023';
  END IF;
  DELETE FROM public.school_lead_invites WHERE group_id = _group_id AND redeemed_at IS NULL;
  INSERT INTO public.school_lead_invites (group_id, token_hash, email, language, created_by)
  VALUES (_group_id, public.access_invite_hash(_token), _clean, _language, auth.uid());
  PERFORM public.ops_log('lead_invite_created', NULL, _group_id, jsonb_build_object('email', _clean));
  RETURN _token;
END;
$$;
REVOKE ALL ON FUNCTION public.ops_new_lead_invite(uuid, text, text) FROM PUBLIC, anon, authenticated;

-- Set up a school without members and invite its lead. Returns {"group_id", "token"}.
CREATE OR REPLACE FUNCTION public.ops_create_school(_name text, _description text, _lead_email text, _language text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _clean_name text := btrim(COALESCE(_name, ''));
  _group uuid;
  _token text;
BEGIN
  IF NOT public.is_ops_admin() THEN
    RAISE EXCEPTION 'Flyary admin required' USING ERRCODE = '42501';
  END IF;
  IF char_length(_clean_name) NOT BETWEEN 2 AND 100 OR char_length(COALESCE(_description, '')) > 500 THEN
    RAISE EXCEPTION 'Invalid school name or description' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.groups (name, description, created_by, group_type)
  VALUES (_clean_name, NULLIF(btrim(COALESCE(_description, '')), ''), auth.uid(), 'school')
  RETURNING id INTO _group;
  PERFORM public.ops_log('school_created', NULL, _group, jsonb_build_object('name', _clean_name));
  _token := public.ops_new_lead_invite(_group, _lead_email, _language);
  RETURN jsonb_build_object('group_id', _group, 'token', _token);
END;
$$;
REVOKE ALL ON FUNCTION public.ops_create_school(text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ops_create_school(text, text, text, text) TO authenticated;

-- A new lead invitation for an existing school (expired link, another person, a school from before).
CREATE OR REPLACE FUNCTION public.ops_create_lead_invite(_group_id uuid, _email text, _language text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_ops_admin() THEN
    RAISE EXCEPTION 'Flyary admin required' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.groups WHERE id = _group_id AND group_type = 'school') THEN
    RAISE EXCEPTION 'Unknown school' USING ERRCODE = 'P0002';
  END IF;
  RETURN public.ops_new_lead_invite(_group_id, _email, _language);
END;
$$;
REVOKE ALL ON FUNCTION public.ops_create_lead_invite(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ops_create_lead_invite(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.ops_revoke_lead_invite(_group_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _email text;
BEGIN
  IF NOT public.is_ops_admin() THEN
    RAISE EXCEPTION 'Flyary admin required' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.school_lead_invites WHERE group_id = _group_id AND redeemed_at IS NULL RETURNING email INTO _email;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No open invitation' USING ERRCODE = 'P0002';
  END IF;
  PERFORM public.ops_log('lead_invite_revoked', NULL, _group_id, jsonb_build_object('email', _email));
END;
$$;
REVOKE ALL ON FUNCTION public.ops_revoke_lead_invite(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ops_revoke_lead_invite(uuid) TO authenticated;

-- The school lead redeems the link: group admin of the school, with app access.
-- Returns 'ok', 'invalid', 'expired', 'used' (by another account) or 'revoked' (paused account).
CREATE OR REPLACE FUNCTION public.redeem_school_lead_invite(_token text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _invite public.school_lead_invites%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.app_access WHERE user_id = _uid AND revoked_at IS NOT NULL) THEN
    RETURN 'revoked';
  END IF;
  SELECT * INTO _invite FROM public.school_lead_invites WHERE token_hash = public.access_invite_hash(_token) FOR UPDATE;
  IF NOT FOUND THEN RETURN 'invalid'; END IF;
  IF _invite.redeemed_at IS NOT NULL THEN
    RETURN CASE WHEN _invite.redeemed_by = _uid THEN 'ok' ELSE 'used' END;
  END IF;
  IF _invite.expires_at < now() THEN RETURN 'expired'; END IF;

  UPDATE public.school_lead_invites SET redeemed_at = now(), redeemed_by = _uid WHERE id = _invite.id;
  INSERT INTO public.group_members (group_id, user_id, role) VALUES (_invite.group_id, _uid, 'admin')
    ON CONFLICT (group_id, user_id) DO UPDATE SET role = 'admin';
  INSERT INTO public.app_access (user_id, granted_via, granted_by) VALUES (_uid, 'group', _invite.created_by)
    ON CONFLICT (user_id) DO NOTHING;
  PERFORM public.ops_log('lead_invite_redeemed', _uid, _invite.group_id, jsonb_build_object('email', _invite.email));
  RETURN 'ok';
END;
$$;
REVOKE ALL ON FUNCTION public.redeem_school_lead_invite(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_school_lead_invite(text) TO authenticated;

-- All schools for the "Schulen" page.
CREATE OR REPLACE FUNCTION public.ops_school_list()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_ops_admin() THEN
    RAISE EXCEPTION 'Flyary admin required' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE((SELECT jsonb_agg(x ORDER BY x->>'name') FROM (
    SELECT jsonb_build_object(
      'id', g.id, 'name', g.name, 'description', g.description, 'created_at', g.created_at,
      'members', (SELECT count(*) FROM public.group_members m WHERE m.group_id = g.id),
      'team', (SELECT count(*) FROM public.group_members m WHERE m.group_id = g.id AND public.is_group_team_member(m.user_id, g.id)),
      'admins', COALESCE((SELECT jsonb_agg(COALESCE(NULLIF(btrim(p.pilot_name), ''), u.email) ORDER BY m.joined_at)
                            FROM public.group_members m
                            LEFT JOIN public.profiles p ON p.user_id = m.user_id
                            LEFT JOIN auth.users u ON u.id = m.user_id
                            WHERE m.group_id = g.id AND m.role = 'admin'), '[]'::jsonb),
      'i_am_member', EXISTS (SELECT 1 FROM public.group_members m WHERE m.group_id = g.id AND m.user_id = auth.uid()),
      'other_admins', (SELECT count(*) FROM public.group_members m WHERE m.group_id = g.id AND m.role = 'admin' AND m.user_id <> auth.uid()),
      'open_invite', (SELECT jsonb_build_object('email', i.email, 'language', i.language, 'created_at', i.created_at, 'expires_at', i.expires_at)
                        FROM public.school_lead_invites i WHERE i.group_id = g.id AND i.redeemed_at IS NULL),
      'last_flight_at', (SELECT max(f.created_at) FROM public.flights f WHERE f.group_id = g.id)) AS x
    FROM public.groups g WHERE g.group_type = 'school') q), '[]'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.ops_school_list() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ops_school_list() TO authenticated;

-- An admin who is still a member of a school (set up the old way) leaves it; the school must keep at least
-- one other group admin.
CREATE OR REPLACE FUNCTION public.ops_leave_school(_group_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_ops_admin() THEN
    RAISE EXCEPTION 'Flyary admin required' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.group_members WHERE group_id = _group_id AND role = 'admin' AND user_id <> auth.uid()) THEN
    RAISE EXCEPTION 'The school needs another group admin first' USING ERRCODE = '55000';
  END IF;
  DELETE FROM public.group_member_functions WHERE group_id = _group_id AND user_id = auth.uid();
  DELETE FROM public.group_members WHERE group_id = _group_id AND user_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not a member of this school' USING ERRCODE = 'P0002';
  END IF;
  PERFORM public.ops_log('school_left', auth.uid(), _group_id, '{}'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.ops_leave_school(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ops_leave_school(uuid) TO authenticated;
