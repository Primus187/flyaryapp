
-- =============================================
-- FIX 1: groups - remove "OR true" broken policy
-- =============================================
DROP POLICY IF EXISTS "Members or invite code can view groups" ON public.groups;

CREATE POLICY "Members can view groups"
ON public.groups FOR SELECT
USING (public.is_group_member(auth.uid(), id));

-- RPC for joining via invite code without exposing other groups
CREATE OR REPLACE FUNCTION public.join_group_by_invite_code(_invite_code uuid)
RETURNS TABLE(id uuid, name text, already_member boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _group_id uuid;
  _group_name text;
  _user_id uuid := auth.uid();
  _exists boolean;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT g.id, g.name INTO _group_id, _group_name
  FROM public.groups g WHERE g.invite_code = _invite_code;

  IF _group_id IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.group_members WHERE group_id = _group_id AND user_id = _user_id) INTO _exists;

  IF NOT _exists THEN
    INSERT INTO public.group_members (group_id, user_id, role) VALUES (_group_id, _user_id, 'member');
  END IF;

  RETURN QUERY SELECT _group_id, _group_name, _exists;
END;
$$;

-- =============================================
-- FIX 2: notifications - prevent injecting into other users' inboxes
-- =============================================
DROP POLICY IF EXISTS "Users can insert notifications as actor" ON public.notifications;

-- Notifications should only be created by triggers/SECURITY DEFINER functions.
-- Block direct user inserts entirely (existing triggers run as SECURITY DEFINER and bypass RLS).
CREATE POLICY "Block direct notification inserts"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (false);

-- =============================================
-- FIX 3: profiles - restrict sensitive columns to owner only
-- =============================================
-- Drop broad SELECT policies that exposed all columns to group members / followers
DROP POLICY IF EXISTS "Group members can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Followers can view followed profiles" ON public.profiles;

-- Owner can still view all their own data (existing policy retained)
-- Create a security-definer view that exposes ONLY safe columns to group members & followers
CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = true) AS
SELECT
  user_id,
  pilot_name,
  bio,
  avatar_url,
  cover_photo_url,
  glider_info,
  flight_school,
  training_level,
  created_at,
  updated_at
FROM public.profiles;

-- The view inherits RLS from profiles; we need a SELECT policy that allows
-- group members and followers to read the underlying rows BUT only via the view's
-- safe columns. Since column-level RLS is not native, we instead create a
-- helper function that returns the safe columns for any visible profile.

CREATE OR REPLACE FUNCTION public.get_public_profile(_user_id uuid)
RETURNS TABLE(
  user_id uuid,
  pilot_name text,
  bio text,
  avatar_url text,
  cover_photo_url text,
  glider_info text,
  flight_school text,
  training_level text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.pilot_name, p.bio, p.avatar_url, p.cover_photo_url,
         p.glider_info, p.flight_school, p.training_level
  FROM public.profiles p
  WHERE p.user_id = _user_id
    AND (
      auth.uid() = p.user_id
      OR EXISTS (
        SELECT 1 FROM public.group_members gm1
        JOIN public.group_members gm2 ON gm1.group_id = gm2.group_id
        WHERE gm1.user_id = auth.uid() AND gm2.user_id = p.user_id
      )
      OR EXISTS (
        SELECT 1 FROM public.follows
        WHERE follower_id = auth.uid() AND following_id = p.user_id
      )
    );
$$;

-- Re-add a SELECT policy on profiles for group members / followers but this is
-- a fallback for the view. To prevent leakage of sensitive columns, we add a
-- restrictive policy that limits non-owners through the view function only.
-- Since policies are row-level (not column-level), we keep direct table SELECT
-- restricted to owners. Other access must use get_public_profile() or public_profiles view.

-- Make the view callable by authenticated users (RLS on profiles still applies via security_invoker)
GRANT SELECT ON public.public_profiles TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_public_profile(uuid) TO authenticated, anon;

-- Re-introduce a narrowed SELECT policy for the view to function for non-owners.
-- This policy is required because security_invoker views still apply RLS.
-- We allow SELECT for group members and followers, BUT we revoke column privileges
-- on sensitive columns for the authenticated role.
CREATE POLICY "Group members can view profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.group_members gm1
    JOIN public.group_members gm2 ON gm1.group_id = gm2.group_id
    WHERE gm1.user_id = auth.uid() AND gm2.user_id = profiles.user_id
  )
);

CREATE POLICY "Followers can view followed profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.follows
    WHERE follower_id = auth.uid() AND following_id = profiles.user_id
  )
);

-- Column-level revocation: prevent authenticated role from selecting sensitive columns directly.
-- Owners still access their own data because we GRANT all on those columns back to owner-evaluated paths
-- via a separate per-column GRANT scheme. Postgres column-level GRANTs apply globally per role,
-- so we instead revoke from authenticated and grant via a SECURITY DEFINER function for owners.
-- 
-- Simpler & correct approach: revoke sensitive columns from `authenticated`, and provide a
-- SECURITY DEFINER RPC `get_own_profile_private()` for owners to read their own sensitive data.

REVOKE SELECT (
  blood_type, medical_notes, allergies,
  emergency_contact_name, emergency_contact_phone,
  xcontest_password_encrypted, xcontest_username,
  shv_number, health_data_consent_at,
  exam_theory_date, exam_practical_date
) ON public.profiles FROM authenticated, anon;

-- Owner-only access to private data via RPC
CREATE OR REPLACE FUNCTION public.get_own_profile_private()
RETURNS TABLE(
  blood_type text,
  medical_notes text,
  allergies text,
  emergency_contact_name text,
  emergency_contact_phone text,
  xcontest_username text,
  xcontest_password_encrypted text,
  shv_number text,
  health_data_consent_at timestamp with time zone,
  exam_theory_date date,
  exam_practical_date date
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT blood_type, medical_notes, allergies,
         emergency_contact_name, emergency_contact_phone,
         xcontest_username, xcontest_password_encrypted,
         shv_number, health_data_consent_at,
         exam_theory_date, exam_practical_date
  FROM public.profiles
  WHERE user_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.get_own_profile_private() TO authenticated;
