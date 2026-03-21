
-- Allow admins to update group members (e.g. change role)
CREATE POLICY "Admins can update members"
ON public.group_members
FOR UPDATE
TO authenticated
USING (is_group_admin(auth.uid(), group_id))
WITH CHECK (is_group_admin(auth.uid(), group_id));
