
-- Enum for group member roles
CREATE TYPE public.group_role AS ENUM ('admin', 'member');

-- Enum for event status
CREATE TYPE public.event_status AS ENUM ('announced', 'confirmed', 'cancelled');

-- Groups table
CREATE TABLE public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  invite_code uuid NOT NULL DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

-- Group members table
CREATE TABLE public.group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.group_role NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(group_id, user_id)
);
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

-- Flight events table
CREATE TABLE public.flight_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status public.event_status NOT NULL DEFAULT 'announced',
  event_date timestamptz NOT NULL,
  signup_deadline timestamptz,
  event_type text,
  meeting_point text,
  instructor text,
  launch_helper text,
  max_participants integer,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.flight_events ENABLE ROW LEVEL SECURITY;

-- Event signups table
CREATE TABLE public.event_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.flight_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  signed_up boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id)
);
ALTER TABLE public.event_signups ENABLE ROW LEVEL SECURITY;

-- Security definer: check if user is member of a group
CREATE OR REPLACE FUNCTION public.is_group_member(_user_id uuid, _group_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.group_members WHERE user_id = _user_id AND group_id = _group_id)
$$;

-- Security definer: check if user is admin of a group
CREATE OR REPLACE FUNCTION public.is_group_admin(_user_id uuid, _group_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.group_members WHERE user_id = _user_id AND group_id = _group_id AND role = 'admin')
$$;

-- RLS for groups: members can read, creator manages
CREATE POLICY "Members can view groups" ON public.groups FOR SELECT
  USING (public.is_group_member(auth.uid(), id));

CREATE POLICY "Authenticated users can create groups" ON public.groups FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Admins can update groups" ON public.groups FOR UPDATE
  USING (public.is_group_admin(auth.uid(), id));

CREATE POLICY "Admins can delete groups" ON public.groups FOR DELETE
  USING (public.is_group_admin(auth.uid(), id));

-- RLS for group_members
CREATE POLICY "Members can view group members" ON public.group_members FOR SELECT
  USING (public.is_group_member(auth.uid(), group_id));

CREATE POLICY "Admins can insert members" ON public.group_members FOR INSERT
  WITH CHECK (public.is_group_admin(auth.uid(), group_id) OR auth.uid() = user_id);

CREATE POLICY "Admins can delete members" ON public.group_members FOR DELETE
  USING (public.is_group_admin(auth.uid(), group_id) OR auth.uid() = user_id);

-- RLS for flight_events
CREATE POLICY "Members can view events" ON public.flight_events FOR SELECT
  USING (public.is_group_member(auth.uid(), group_id));

CREATE POLICY "Admins can create events" ON public.flight_events FOR INSERT
  WITH CHECK (public.is_group_admin(auth.uid(), group_id));

CREATE POLICY "Admins can update events" ON public.flight_events FOR UPDATE
  USING (public.is_group_admin(auth.uid(), group_id));

CREATE POLICY "Admins can delete events" ON public.flight_events FOR DELETE
  USING (public.is_group_admin(auth.uid(), group_id));

-- RLS for event_signups: members can view, users manage own
CREATE POLICY "Members can view signups" ON public.event_signups FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.flight_events fe
    WHERE fe.id = event_id AND public.is_group_member(auth.uid(), fe.group_id)
  ));

CREATE POLICY "Users can insert own signup" ON public.event_signups FOR INSERT
  WITH CHECK (auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM public.flight_events fe
    WHERE fe.id = event_id AND public.is_group_member(auth.uid(), fe.group_id)
  ));

CREATE POLICY "Users can update own signup" ON public.event_signups FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own signup" ON public.event_signups FOR DELETE
  USING (auth.uid() = user_id);

-- Allow reading groups by invite_code for joining
CREATE POLICY "Anyone can view group by invite code" ON public.groups FOR SELECT
  USING (true);
