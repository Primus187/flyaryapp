-- Website (www.flyary.ch): pilots sign up for the pilot phase ("Als Pilot mitfliegen").
--
-- The website form posts to the Edge Function website-waitlist (no login, works without
-- JavaScript), which calls join_pilot_waitlist() with the service role. Only Flyary admins read the
-- list (app page /admin/waitlist); every new sign-up sends them a push notification.
-- Minimal data: name, e-mail, language, role, disciplines, optional school and comment, and the
-- time of consent. One entry per e-mail address (a repeated sign-up updates it). Rate limits: 5 per
-- requester hash and hour, 200 in total per hour. The requester hash is a shortened hash of the IP
-- address and the day, only used for the limit.

CREATE TABLE IF NOT EXISTS public.pilot_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 100),
  email text NOT NULL CHECK (char_length(email) <= 200 AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  language text NOT NULL CHECK (language IN ('de', 'fr', 'en')),
  role text NOT NULL CHECK (role IN ('student', 'pilot', 'tandem_pilot', 'instructor')),
  disciplines text[] NOT NULL DEFAULT '{}' CHECK (disciplines <@ ARRAY['paraglider', 'hangglider']),
  school text CHECK (char_length(school) <= 120),
  comment text CHECK (char_length(comment) <= 1000),
  consent_at timestamptz NOT NULL,
  requester_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  handled_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS pilot_waitlist_email_idx ON public.pilot_waitlist (lower(email));
CREATE INDEX IF NOT EXISTS pilot_waitlist_created_idx ON public.pilot_waitlist (created_at DESC);

ALTER TABLE public.pilot_waitlist ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pilot_waitlist FROM anon, authenticated;
GRANT SELECT, DELETE ON public.pilot_waitlist TO authenticated;
GRANT UPDATE (handled_at) ON public.pilot_waitlist TO authenticated;
GRANT ALL ON public.pilot_waitlist TO service_role;
DROP POLICY IF EXISTS "Admins read the pilot waitlist" ON public.pilot_waitlist;
CREATE POLICY "Admins read the pilot waitlist" ON public.pilot_waitlist FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins handle the pilot waitlist" ON public.pilot_waitlist;
CREATE POLICY "Admins handle the pilot waitlist" ON public.pilot_waitlist FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins delete from the pilot waitlist" ON public.pilot_waitlist;
CREATE POLICY "Admins delete from the pilot waitlist" ON public.pilot_waitlist FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Returns 'ok', 'invalid' or 'rate_limited'. Called by the Edge Function with the service role only.
CREATE OR REPLACE FUNCTION public.join_pilot_waitlist(_name text, _email text, _language text, _role text,
  _disciplines text[], _school text, _comment text, _requester_hash text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _clean_name text := trim(COALESCE(_name, ''));
  _clean_email text := lower(trim(COALESCE(_email, '')));
  _clean_school text := NULLIF(trim(COALESCE(_school, '')), '');
  _clean_comment text := NULLIF(trim(COALESCE(_comment, '')), '');
  _new boolean;
  _admin record;
BEGIN
  IF char_length(_clean_name) NOT BETWEEN 2 AND 100 OR char_length(_clean_email) > 200
     OR _clean_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
     OR COALESCE(_language, '') NOT IN ('de', 'fr', 'en')
     OR COALESCE(_role, '') NOT IN ('student', 'pilot', 'tandem_pilot', 'instructor')
     OR NOT (COALESCE(_disciplines, '{}') <@ ARRAY['paraglider', 'hangglider'])
     OR char_length(COALESCE(_clean_school, '')) > 120 OR char_length(COALESCE(_clean_comment, '')) > 1000 THEN
    RETURN 'invalid';
  END IF;
  IF (_requester_hash IS NOT NULL AND (SELECT count(*) FROM public.pilot_waitlist
        WHERE requester_hash = _requester_hash AND updated_at > now() - interval '1 hour') >= 5)
     OR (SELECT count(*) FROM public.pilot_waitlist WHERE updated_at > now() - interval '1 hour') >= 200 THEN
    RETURN 'rate_limited';
  END IF;

  SELECT NOT EXISTS (SELECT 1 FROM public.pilot_waitlist WHERE lower(email) = _clean_email) INTO _new;
  INSERT INTO public.pilot_waitlist (name, email, language, role, disciplines, school, comment, consent_at, requester_hash)
  VALUES (_clean_name, _clean_email, _language, _role, COALESCE(_disciplines, '{}'), _clean_school, _clean_comment, now(), _requester_hash)
  ON CONFLICT (lower(email)) DO UPDATE SET
    name = EXCLUDED.name, language = EXCLUDED.language, role = EXCLUDED.role, disciplines = EXCLUDED.disciplines,
    school = EXCLUDED.school, comment = EXCLUDED.comment, consent_at = EXCLUDED.consent_at,
    requester_hash = EXCLUDED.requester_hash, updated_at = now();

  IF _new THEN
    FOR _admin IN SELECT DISTINCT user_id FROM public.user_roles WHERE role = 'admin' LOOP
      PERFORM public.send_push_notification(_admin.user_id, 'Neuer Testpilot',
        _clean_name || ' möchte in der Pilotphase mitfliegen.', '/admin/waitlist');
    END LOOP;
  END IF;
  RETURN 'ok';
END;
$$;
REVOKE ALL ON FUNCTION public.join_pilot_waitlist(text, text, text, text, text[], text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.join_pilot_waitlist(text, text, text, text, text[], text, text, text) TO service_role;

NOTIFY pgrst, 'reload schema';
