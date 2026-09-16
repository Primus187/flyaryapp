CREATE OR REPLACE FUNCTION public.handle_signup_waitlist()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _max integer;
  _confirmed integer;
  _first_wait record;
  _ev record;
BEGIN
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.signed_up IS DISTINCT FROM OLD.signed_up) THEN
    IF NEW.signed_up THEN
      SELECT e.max_participants, e.signup_deadline, e.id, e.title INTO _max, _ev.signup_deadline, _ev.id, _ev.title FROM public.flight_events e WHERE e.id = NEW.event_id;
      -- Enforce signup deadline for new sign-ups (not for re-activation by existing rows updated by staff)
      IF _ev.signup_deadline IS NOT NULL AND now() > _ev.signup_deadline AND auth.uid() = NEW.user_id AND (TG_OP = 'INSERT' OR OLD.signed_up = false) THEN
        RAISE EXCEPTION 'Signup deadline has passed';
      END IF;
      SELECT COUNT(*) INTO _confirmed FROM public.event_signups
        WHERE event_id = NEW.event_id AND signed_up = true AND status = 'confirmed' AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
      IF _max IS NOT NULL AND _confirmed >= _max THEN
        NEW.status := 'waitlist';
        NEW.waitlist_position := COALESCE((SELECT MAX(waitlist_position) FROM public.event_signups WHERE event_id = NEW.event_id AND status = 'waitlist'), 0) + 1;
      ELSE
        NEW.status := 'confirmed';
        NEW.waitlist_position := NULL;
      END IF;
    ELSE
      NEW.status := 'declined';
      NEW.waitlist_position := NULL;
      SELECT * INTO _first_wait FROM public.event_signups
        WHERE event_id = NEW.event_id AND signed_up = true AND status = 'waitlist'
        ORDER BY waitlist_position NULLS LAST, updated_at LIMIT 1;
      IF FOUND THEN
        UPDATE public.event_signups SET status = 'confirmed', waitlist_position = NULL, updated_at = now()
          WHERE id = _first_wait.id;
        PERFORM public.send_push_notification(_first_wait.user_id, 'Du bist nachgerückt', 'Für ' || COALESCE(_ev.title, 'den Termin') || ' ist ein Platz frei geworden.', '/events/' || NEW.event_id);
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.handle_signup_waitlist() FROM PUBLIC, anon, authenticated;