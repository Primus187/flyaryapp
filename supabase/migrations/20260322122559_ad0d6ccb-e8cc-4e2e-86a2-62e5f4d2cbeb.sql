CREATE POLICY "Group members can view group flight igc tracks"
ON public.igc_tracks
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM flights f
    JOIN group_members gm ON gm.group_id = f.group_id
    WHERE f.id = igc_tracks.flight_id AND gm.user_id = auth.uid()
  )
);