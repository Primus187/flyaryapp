-- 1. Extend flight_videos table
ALTER TABLE public.flight_videos
  ALTER COLUMN youtube_url DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS storage_path TEXT NULL,
  ADD COLUMN IF NOT EXISTS poster_path TEXT NULL,
  ADD COLUMN IF NOT EXISTS duration_seconds INT NULL,
  ADD COLUMN IF NOT EXISTS size_bytes BIGINT NULL;

ALTER TABLE public.flight_videos
  DROP CONSTRAINT IF EXISTS flight_videos_source_check;

ALTER TABLE public.flight_videos
  ADD CONSTRAINT flight_videos_source_check
  CHECK (
    (youtube_url IS NOT NULL AND storage_path IS NULL)
    OR (youtube_url IS NULL AND storage_path IS NOT NULL)
  );

-- 2. Create storage bucket for uploaded videos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'flight-videos',
  'flight-videos',
  false,
  52428800, -- 50 MB
  ARRAY['video/mp4', 'video/quicktime', 'video/webm']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 3. Storage RLS policies (analog to flight-photos)
-- Owner can manage own files (path: <user_id>/<flight_id>/...)
CREATE POLICY "Users can upload own flight videos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'flight-videos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view own flight videos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'flight-videos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete own flight videos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'flight-videos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Group members can view group flight videos
CREATE POLICY "Group members can view group flight videos in storage"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'flight-videos'
  AND EXISTS (
    SELECT 1 FROM public.flight_videos fv
    JOIN public.flights f ON f.id = fv.flight_id
    JOIN public.group_members gm ON gm.group_id = f.group_id
    WHERE (fv.storage_path = name OR fv.poster_path = name)
      AND gm.user_id = auth.uid()
  )
);

-- Followers can view videos of published flights
CREATE POLICY "Followers can view published flight videos in storage"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'flight-videos'
  AND EXISTS (
    SELECT 1 FROM public.flight_videos fv
    JOIN public.flights f ON f.id = fv.flight_id
    JOIN public.follows fo ON fo.following_id = f.user_id
    WHERE (fv.storage_path = name OR fv.poster_path = name)
      AND f.published_to_feed = true
      AND fo.follower_id = auth.uid()
  )
);

-- 4. Add RLS for followers/group on flight_videos table for direct uploads
CREATE POLICY "Followers can view published flight videos"
ON public.flight_videos FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.flights f
    JOIN public.follows fo ON fo.following_id = f.user_id
    WHERE f.id = flight_videos.flight_id
      AND f.published_to_feed = true
      AND fo.follower_id = auth.uid()
  )
);