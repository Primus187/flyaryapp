
-- feed_likes table
CREATE TABLE public.feed_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flight_id uuid NOT NULL REFERENCES public.flights(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(flight_id, user_id)
);

ALTER TABLE public.feed_likes ENABLE ROW LEVEL SECURITY;

-- feed_comments table
CREATE TABLE public.feed_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flight_id uuid NOT NULL REFERENCES public.flights(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.feed_comments ENABLE ROW LEVEL SECURITY;

-- RLS for feed_likes: group members can see likes on flights within their groups
CREATE POLICY "Group members can view likes" ON public.feed_likes
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.flights f
    JOIN public.group_members gm ON gm.group_id = f.group_id
    WHERE f.id = feed_likes.flight_id AND gm.user_id = auth.uid()
  ));

CREATE POLICY "Users can like group flights" ON public.feed_likes
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.flights f
      JOIN public.group_members gm ON gm.group_id = f.group_id
      WHERE f.id = feed_likes.flight_id AND gm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can unlike" ON public.feed_likes
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- RLS for feed_comments
CREATE POLICY "Group members can view comments" ON public.feed_comments
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.flights f
    JOIN public.group_members gm ON gm.group_id = f.group_id
    WHERE f.id = feed_comments.flight_id AND gm.user_id = auth.uid()
  ));

CREATE POLICY "Users can comment on group flights" ON public.feed_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.flights f
      JOIN public.group_members gm ON gm.group_id = f.group_id
      WHERE f.id = feed_comments.flight_id AND gm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own comments" ON public.feed_comments
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Allow group members to see flights that have a group_id matching their groups
CREATE POLICY "Group members can view group flights" ON public.flights
  FOR SELECT TO authenticated
  USING (
    group_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = flights.group_id AND gm.user_id = auth.uid()
    )
  );

-- Allow group members to see photos of group flights
CREATE POLICY "Group members can view group flight photos" ON public.flight_photos
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.flights f
      JOIN public.group_members gm ON gm.group_id = f.group_id
      WHERE f.id = flight_photos.flight_id AND gm.user_id = auth.uid()
    )
  );

-- Enable realtime for feed tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.feed_likes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.feed_comments;
