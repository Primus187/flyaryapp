-- Group creation and joining on a fresh project (policies the Lovable project apparently had
-- only as manual changes), plus closing a privilege escalation.

-- 1) Creating a group: the app reads the new row back (INSERT ... RETURNING) before the
--    creator's membership exists; "Members can view groups" alone rejects that.
DROP POLICY IF EXISTS "Creators can view own groups" ON public.groups;
CREATE POLICY "Creators can view own groups" ON public.groups
  FOR SELECT TO authenticated USING (created_by = auth.uid());

-- 2) Memberships: the old policy let anyone insert themselves into ANY group with ANY role
--    (auth.uid() = user_id), e.g. as admin of a school to read its students. Now: group admins
--    add members; a user may only add themselves to a group they just created. Joining by
--    invite code goes through join_group_by_invite_code() (SECURITY DEFINER, role 'member').
DROP POLICY IF EXISTS "Admins can insert members" ON public.group_members;
CREATE POLICY "Admins can insert members" ON public.group_members
  FOR INSERT TO authenticated WITH CHECK (
    public.is_group_admin(auth.uid(), group_id)
    OR (auth.uid() = user_id AND EXISTS (
      SELECT 1 FROM public.groups g WHERE g.id = group_id AND g.created_by = auth.uid()))
  );

-- 3) Joining by invite code: non-members cannot read groups, so the app uses this function.
GRANT EXECUTE ON FUNCTION public.join_group_by_invite_code(uuid) TO authenticated;
