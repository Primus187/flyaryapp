-- Pre-launch audit fixes (before the first Vertical student cohort).

-- 1) Sensitive profile columns were readable by every group member and follower.
-- Migration 20260417064846 used REVOKE SELECT (col, ...) ON profiles, but a column-level REVOKE
-- has no effect while the role still holds the table-level SELECT grant Supabase gives
-- authenticated/anon by default. Replace the table-level grant with explicit safe-column grants.
-- Owners read their private columns via get_own_profile_private(); staff via
-- get_emergency_contact_info() / school_student_training_profile() (both SECURITY DEFINER).
REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (id, user_id, pilot_name, bio, avatar_url, cover_photo_url, glider_info,
  flight_school, training_level, created_at, updated_at) ON public.profiles TO authenticated;

-- 2) Deleting an event failed as soon as a flight was auto-linked to it (FK without ON DELETE),
-- after the client had already deleted signups, chat and day notes. Keep flights, drop the link.
ALTER TABLE public.flights DROP CONSTRAINT IF EXISTS flights_event_id_fkey;
ALTER TABLE public.flights ADD CONSTRAINT flights_event_id_fkey
  FOREIGN KEY (event_id) REFERENCES public.flight_events(id) ON DELETE SET NULL;

-- 3) Waitlist: only a leaving *confirmed* participant frees a seat. Previously a waitlisted
-- person signing off promoted the next waitlisted person beyond max_participants.
CREATE OR REPLACE FUNCTION public.handle_signup_waitlist()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _max integer;
  _deadline timestamptz;
  _title text;
  _confirmed integer;
  _first_wait record;
BEGIN
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.signed_up IS DISTINCT FROM OLD.signed_up) THEN
    SELECT e.max_participants, e.signup_deadline, e.title INTO _max, _deadline, _title
      FROM public.flight_events e WHERE e.id = NEW.event_id;

    IF NEW.signed_up THEN
      IF _deadline IS NOT NULL AND now() > _deadline AND auth.uid() = NEW.user_id
         AND (TG_OP = 'INSERT' OR OLD.signed_up = false) THEN
        RAISE EXCEPTION 'Signup deadline has passed';
      END IF;
      SELECT COUNT(*) INTO _confirmed FROM public.event_signups
        WHERE event_id = NEW.event_id AND signed_up = true AND status = 'confirmed'
          AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
      IF _max IS NOT NULL AND _confirmed >= _max THEN
        NEW.status := 'waitlist';
        NEW.waitlist_position := COALESCE((SELECT MAX(waitlist_position) FROM public.event_signups
          WHERE event_id = NEW.event_id AND status = 'waitlist'), 0) + 1;
      ELSE
        NEW.status := 'confirmed';
        NEW.waitlist_position := NULL;
      END IF;
    ELSE
      NEW.status := 'declined';
      NEW.waitlist_position := NULL;
      IF TG_OP = 'UPDATE' AND OLD.status = 'confirmed' THEN
        SELECT * INTO _first_wait FROM public.event_signups
          WHERE event_id = NEW.event_id AND signed_up = true AND status = 'waitlist'
          ORDER BY waitlist_position NULLS LAST, updated_at LIMIT 1;
        IF FOUND THEN
          UPDATE public.event_signups SET status = 'confirmed', waitlist_position = NULL, updated_at = now()
            WHERE id = _first_wait.id;
          PERFORM public.send_push_notification(_first_wait.user_id, 'Du bist nachgerückt',
            'Für ' || COALESCE(_title, 'den Termin') || ' ist ein Platz frei geworden.', '/events/' || NEW.event_id);
        END IF;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.handle_signup_waitlist() FROM PUBLIC, anon, authenticated;

-- 4) send-push was callable with the public anon key for any user_id (spoofed notifications).
-- The edge function now requires the service-role key, the caller's own user_id, or this
-- shared secret. Before applying: create the Vault secret and the edge-function secret
-- PUSH_INTERNAL_SECRET with the same value (see README).
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
  SELECT decrypted_secret INTO _secret FROM vault.decrypted_secrets WHERE name = 'push_internal_secret' LIMIT 1;
  IF _secret IS NULL THEN
    RAISE WARNING 'send_push_notification: vault secret push_internal_secret missing, push skipped';
    RETURN;
  END IF;
  PERFORM net.http_post(
    url := _project_url || '/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _anon_key,
      'x-push-secret', _secret
    ),
    body := jsonb_build_object('user_id', _user_id::text, 'title', _title, 'body', _body, 'url', _url)
  );
EXCEPTION WHEN OTHERS THEN
  -- A failed push must never abort the signup/notification transaction that triggered it.
  NULL;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.send_push_notification(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
