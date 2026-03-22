
-- Notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  type text NOT NULL,
  reference_id uuid,
  reference_type text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
ON public.notifications FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
ON public.notifications FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Authenticated can insert notifications"
ON public.notifications FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Users can delete own notifications"
ON public.notifications FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, read) WHERE read = false;

-- Comment likes table
CREATE TABLE public.comment_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES public.feed_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(comment_id, user_id)
);

ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view comment likes"
ON public.comment_likes FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated can insert comment likes"
ON public.comment_likes FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own comment likes"
ON public.comment_likes FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- Bookmarks table
CREATE TABLE public.bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  flight_id uuid REFERENCES public.flights(id) ON DELETE CASCADE,
  event_id uuid REFERENCES public.flight_events(id) ON DELETE CASCADE,
  achievement_id uuid REFERENCES public.feed_achievements(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, flight_id),
  UNIQUE(user_id, event_id),
  UNIQUE(user_id, achievement_id)
);

ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own bookmarks"
ON public.bookmarks FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Function to create notification on like
CREATE OR REPLACE FUNCTION public.notify_on_like()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _owner_id uuid;
BEGIN
  -- Find the owner of the liked item
  IF NEW.flight_id IS NOT NULL THEN
    SELECT user_id INTO _owner_id FROM flights WHERE id = NEW.flight_id;
  ELSIF NEW.event_id IS NOT NULL THEN
    SELECT created_by INTO _owner_id FROM flight_events WHERE id = NEW.event_id;
  ELSIF NEW.achievement_id IS NOT NULL THEN
    SELECT user_id INTO _owner_id FROM feed_achievements WHERE id = NEW.achievement_id;
  END IF;

  -- Don't notify yourself
  IF _owner_id IS NOT NULL AND _owner_id != NEW.user_id THEN
    INSERT INTO notifications (user_id, actor_id, type, reference_id, reference_type)
    VALUES (
      _owner_id,
      NEW.user_id,
      'like',
      COALESCE(NEW.flight_id, NEW.event_id, NEW.achievement_id),
      CASE
        WHEN NEW.flight_id IS NOT NULL THEN 'flight'
        WHEN NEW.event_id IS NOT NULL THEN 'event'
        ELSE 'achievement'
      END
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_notify_on_like
AFTER INSERT ON public.feed_likes
FOR EACH ROW EXECUTE FUNCTION public.notify_on_like();

-- Function to create notification on comment
CREATE OR REPLACE FUNCTION public.notify_on_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _owner_id uuid;
BEGIN
  IF NEW.flight_id IS NOT NULL THEN
    SELECT user_id INTO _owner_id FROM flights WHERE id = NEW.flight_id;
  ELSIF NEW.event_id IS NOT NULL THEN
    SELECT created_by INTO _owner_id FROM flight_events WHERE id = NEW.event_id;
  ELSIF NEW.achievement_id IS NOT NULL THEN
    SELECT user_id INTO _owner_id FROM feed_achievements WHERE id = NEW.achievement_id;
  END IF;

  IF _owner_id IS NOT NULL AND _owner_id != NEW.user_id THEN
    INSERT INTO notifications (user_id, actor_id, type, reference_id, reference_type)
    VALUES (
      _owner_id,
      NEW.user_id,
      'comment',
      COALESCE(NEW.flight_id, NEW.event_id, NEW.achievement_id),
      CASE
        WHEN NEW.flight_id IS NOT NULL THEN 'flight'
        WHEN NEW.event_id IS NOT NULL THEN 'event'
        ELSE 'achievement'
      END
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_notify_on_comment
AFTER INSERT ON public.feed_comments
FOR EACH ROW EXECUTE FUNCTION public.notify_on_comment();
