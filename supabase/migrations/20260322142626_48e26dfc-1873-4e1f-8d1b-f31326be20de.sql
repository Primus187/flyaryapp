CREATE POLICY "Group members can view group flight videos"
ON public.flight_videos
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM flights f
    JOIN group_members gm ON gm.group_id = f.group_id
    WHERE f.id = flight_videos.flight_id AND gm.user_id = auth.uid()
  )
);