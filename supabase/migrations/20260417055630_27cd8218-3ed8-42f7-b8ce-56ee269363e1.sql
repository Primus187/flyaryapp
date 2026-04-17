CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

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
BEGIN
  PERFORM net.http_post(
    url := _project_url || '/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _anon_key
    ),
    body := jsonb_build_object(
      'user_id', _user_id::text,
      'title', _title,
      'body', _body,
      'url', _url
    )
  );
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.push_on_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor_name text;
  _title text;
  _body text;
  _url text := '/';
BEGIN
  SELECT COALESCE(NULLIF(pilot_name, ''), 'Jemand') INTO _actor_name
  FROM profiles WHERE user_id = NEW.actor_id;
  IF _actor_name IS NULL THEN _actor_name := 'Jemand'; END IF;

  IF NEW.type = 'like' THEN
    _title := _actor_name || ' hat reagiert';
    _body := 'Schau dir die Reaktion an';
    IF NEW.reference_type = 'flight' THEN _url := '/flights/' || NEW.reference_id;
    ELSIF NEW.reference_type = 'event' THEN _url := '/events/' || NEW.reference_id;
    END IF;
  ELSIF NEW.type = 'comment' THEN
    _title := _actor_name || ' hat kommentiert';
    _body := 'Neuer Kommentar in deinem Feed';
    IF NEW.reference_type = 'flight' THEN _url := '/flights/' || NEW.reference_id;
    ELSIF NEW.reference_type = 'event' THEN _url := '/events/' || NEW.reference_id;
    END IF;
  ELSIF NEW.type = 'follow' THEN
    _title := _actor_name || ' folgt dir';
    _body := 'Du hast einen neuen Follower';
    _url := '/pilot/' || NEW.actor_id;
  ELSE
    RETURN NEW;
  END IF;

  PERFORM public.send_push_notification(NEW.user_id, _title, _body, _url);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_push_on_notification ON public.notifications;
CREATE TRIGGER trigger_push_on_notification
AFTER INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.push_on_notification();

CREATE OR REPLACE FUNCTION public.notify_followers_new_flight()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _follower record;
  _pilot_name text;
BEGIN
  IF NEW.published_to_feed = true AND (TG_OP = 'INSERT' OR OLD.published_to_feed = false) THEN
    SELECT COALESCE(NULLIF(pilot_name, ''), 'Ein Pilot') INTO _pilot_name
    FROM profiles WHERE user_id = NEW.user_id;
    IF _pilot_name IS NULL THEN _pilot_name := 'Ein Pilot'; END IF;

    FOR _follower IN
      SELECT follower_id FROM follows WHERE following_id = NEW.user_id
    LOOP
      PERFORM public.send_push_notification(
        _follower.follower_id,
        _pilot_name || ' hat einen Flug geteilt',
        'Neuer Flug im Feed',
        '/flights/' || NEW.id
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_followers_new_flight ON public.flights;
CREATE TRIGGER trigger_notify_followers_new_flight
AFTER INSERT OR UPDATE OF published_to_feed ON public.flights
FOR EACH ROW EXECUTE FUNCTION public.notify_followers_new_flight();