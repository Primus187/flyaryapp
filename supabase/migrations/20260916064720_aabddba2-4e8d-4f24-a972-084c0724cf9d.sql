CREATE TYPE public.group_function AS ENUM ('student', 'licensed', 'launch_helper', 'instructor', 'school_lead');

-- 1. Multi-function roles per group member
CREATE TABLE public.group_member_functions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  function public.group_function NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id, function)
);
GRANT SELECT ON public.group_member_functions TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.group_member_functions TO authenticated;
GRANT ALL ON public.group_member_functions TO service_role;
ALTER TABLE public.group_member_functions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_group_function(_user_id uuid, _group_id uuid, _function public.group_function)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_member_functions
    WHERE user_id = _user_id AND group_id = _group_id AND function = _function
  )
$$;

CREATE OR REPLACE FUNCTION public.is_group_staff(_user_id uuid, _group_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_group_admin(_user_id, _group_id)
    OR EXISTS (
      SELECT 1 FROM public.group_member_functions
      WHERE user_id = _user_id AND group_id = _group_id
        AND function IN ('instructor', 'school_lead')
    )
$$;

CREATE POLICY "Members can view functions" ON public.group_member_functions
  FOR SELECT TO authenticated
  USING (public.is_group_member(auth.uid(), group_id));
CREATE POLICY "Admins manage functions" ON public.group_member_functions
  FOR ALL TO authenticated
  USING (public.is_group_admin(auth.uid(), group_id))
  WITH CHECK (public.is_group_admin(auth.uid(), group_id));

-- 2. Event extensions: category, end date, series
ALTER TABLE public.flight_events
  ADD COLUMN IF NOT EXISTS event_category text NOT NULL DEFAULT 'height_flight',
  ADD COLUMN IF NOT EXISTS end_date date,
  ADD COLUMN IF NOT EXISTS series_id uuid;

-- 3. Program items per event
CREATE TABLE public.event_program_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.flight_events(id) ON DELETE CASCADE,
  item_date date NOT NULL,
  item_time time,
  title text NOT NULL,
  location text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.event_program_items TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.event_program_items TO authenticated;
GRANT ALL ON public.event_program_items TO service_role;
ALTER TABLE public.event_program_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view program" ON public.event_program_items
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.flight_events e WHERE e.id = event_id AND public.is_group_member(auth.uid(), e.group_id)));
CREATE POLICY "Staff manage program" ON public.event_program_items
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.flight_events e WHERE e.id = event_id AND public.is_group_staff(auth.uid(), e.group_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.flight_events e WHERE e.id = event_id AND public.is_group_staff(auth.uid(), e.group_id)));

-- 4. Staff assignments per event
CREATE TABLE public.event_staff (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.flight_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('instructor', 'launch_helper')),
  "position" text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id, role)
);
GRANT SELECT ON public.event_staff TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.event_staff TO authenticated;
GRANT ALL ON public.event_staff TO service_role;
ALTER TABLE public.event_staff ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view staff" ON public.event_staff
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.flight_events e WHERE e.id = event_id AND public.is_group_member(auth.uid(), e.group_id)));
CREATE POLICY "Staff manage staff" ON public.event_staff
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.flight_events e WHERE e.id = event_id AND public.is_group_staff(auth.uid(), e.group_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.flight_events e WHERE e.id = event_id AND public.is_group_staff(auth.uid(), e.group_id)));

-- 5. Carpools
CREATE TABLE public.event_carpools (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.flight_events(id) ON DELETE CASCADE,
  driver_user_id uuid NOT NULL,
  seats integer NOT NULL DEFAULT 1,
  departure_place text,
  departure_time time,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, driver_user_id)
);
CREATE TABLE public.event_carpool_riders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  carpool_id uuid NOT NULL REFERENCES public.event_carpools(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (carpool_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_carpools TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_carpool_riders TO authenticated;
GRANT ALL ON public.event_carpools TO service_role;
GRANT ALL ON public.event_carpool_riders TO service_role;
ALTER TABLE public.event_carpools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_carpool_riders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view carpools" ON public.event_carpools
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.flight_events e WHERE e.id = event_id AND public.is_group_member(auth.uid(), e.group_id)));
CREATE POLICY "Drivers manage own carpool" ON public.event_carpools
  FOR ALL TO authenticated
  USING (driver_user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.flight_events e WHERE e.id = event_id AND public.is_group_member(auth.uid(), e.group_id)))
  WITH CHECK (driver_user_id = auth.uid());
CREATE POLICY "Staff manage carpools" ON public.event_carpools
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.flight_events e WHERE e.id = event_id AND public.is_group_staff(auth.uid(), e.group_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.flight_events e WHERE e.id = event_id AND public.is_group_staff(auth.uid(), e.group_id)));
CREATE POLICY "Members view riders" ON public.event_carpool_riders
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.event_carpools c JOIN public.flight_events e ON e.id = c.event_id
    WHERE c.id = carpool_id AND public.is_group_member(auth.uid(), e.group_id)));
CREATE POLICY "Users join/leave as rider" ON public.event_carpool_riders
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users leave as rider" ON public.event_carpool_riders
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- 6. Signup status / waitlist
ALTER TABLE public.event_signups
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'confirmed',
  ADD COLUMN IF NOT EXISTS waitlist_position integer,
  ADD COLUMN IF NOT EXISTS confirmed_by_school boolean NOT NULL DEFAULT false;

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
      SELECT e.max_participants, e.id, e.title INTO _max, _ev.id, _ev.title FROM public.flight_events e WHERE e.id = NEW.event_id;
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
      -- promote first waitlisted
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

CREATE TRIGGER trg_signup_waitlist
  BEFORE INSERT OR UPDATE ON public.event_signups
  FOR EACH ROW EXECUTE FUNCTION public.handle_signup_waitlist();

-- 7. Group chat
CREATE TABLE public.group_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  message text NOT NULL DEFAULT '',
  attachment_path text,
  is_announcement boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.group_messages TO authenticated;
GRANT ALL ON public.group_messages TO service_role;
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read chat" ON public.group_messages
  FOR SELECT TO authenticated USING (public.is_group_member(auth.uid(), group_id));
CREATE POLICY "Members write chat" ON public.group_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.is_group_member(auth.uid(), group_id)
    AND (NOT is_announcement OR public.is_group_staff(auth.uid(), group_id))
  );
CREATE POLICY "Authors delete own messages" ON public.group_messages
  FOR DELETE TO authenticated USING (user_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages;