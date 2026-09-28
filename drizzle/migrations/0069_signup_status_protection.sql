-- Security review 2026-09-28: a student could write status = 'confirmed' (and waitlist_position) on
-- their own signup and so take a place past the waiting list; the waitlist trigger only recomputes
-- when signed_up changes. On their own signup, people without a role on the flying day now keep
-- status and position; handle_signup_waitlist (runs after this trigger, trigger names sort that way)
-- still sets them when someone signs up or off, and still moves the next person up from the list
-- (that update touches another person's row, which this guard leaves alone). attended is generated
-- from presence (0051), which was already guarded.

CREATE OR REPLACE FUNCTION public.protect_signup_school_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _role text;
BEGIN
  -- Service role, migrations and seed scripts have no auth.uid().
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  _role := public.flight_day_role(auth.uid(), NEW.event_id);
  IF TG_OP = 'INSERT' THEN
    IF _role IS NULL THEN
      NEW.presence := 'expected';
      NEW.checked_in_at := NULL;
      IF NEW.user_id = auth.uid() THEN
        NEW.status := CASE WHEN NEW.signed_up THEN 'confirmed' ELSE 'declined' END;
        NEW.waitlist_position := NULL;
      END IF;
    END IF;
    IF _role IS DISTINCT FROM 'instructor' THEN NEW.confirmed_by_school := false; END IF;
  ELSE
    IF _role IS NULL THEN
      NEW.presence := OLD.presence;
      NEW.checked_in_at := OLD.checked_in_at;
      IF NEW.user_id = auth.uid() THEN
        NEW.status := OLD.status;
        NEW.waitlist_position := OLD.waitlist_position;
      END IF;
    END IF;
    IF _role IS DISTINCT FROM 'instructor' THEN NEW.confirmed_by_school := OLD.confirmed_by_school; END IF;
  END IF;
  RETURN NEW;
END $$;
