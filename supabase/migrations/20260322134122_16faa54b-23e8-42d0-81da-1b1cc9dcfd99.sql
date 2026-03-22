CREATE POLICY "Group members can view gliders"
ON public.pilot_gliders
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM group_members gm1
    JOIN group_members gm2 ON gm1.group_id = gm2.group_id
    WHERE gm1.user_id = auth.uid() AND gm2.user_id = pilot_gliders.user_id
  )
);