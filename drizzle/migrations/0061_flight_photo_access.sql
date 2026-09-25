-- Photos in the flight-photos bucket could only be read by their owner ("Users can view own
-- photos"). The app signs other people's photos too: the feed (flight and event photos) and
-- avatars in feed, leaderboard, suggestions and notifications. Those signatures failed, so the
-- pictures stayed empty for everyone but the owner (found 2026-09-25 while fixing the event photo
-- upload; so far only one account had photos).
-- A file is now readable when the row pointing to it is readable: flight_photos and event_photos
-- already carry the right RLS (group members, followers of published flights), so the storage
-- policy just asks for a visible row. Avatars are shown wherever pilots are listed (suggestions,
-- leaderboard), so any signed-in user may read a file that is someone's avatar.
-- Writing stays limited to the own folder; the event photo upload now uses
-- <user id>/events/<event id>/… (it used events/<user id>/… and was rejected).

CREATE OR REPLACE FUNCTION public.is_avatar_path(_name text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE avatar_url = _name)
$$;
REVOKE ALL ON FUNCTION public.is_avatar_path(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_avatar_path(text) TO authenticated;

DROP POLICY IF EXISTS "Visible flight and event photos are readable" ON storage.objects;
CREATE POLICY "Visible flight and event photos are readable" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'flight-photos' AND (
    EXISTS (SELECT 1 FROM public.flight_photos p WHERE p.storage_path = objects.name)
    OR EXISTS (SELECT 1 FROM public.event_photos ep WHERE ep.storage_path = objects.name)));

DROP POLICY IF EXISTS "Signed-in users read avatars" ON storage.objects;
CREATE POLICY "Signed-in users read avatars" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'flight-photos' AND public.is_avatar_path(objects.name));

-- The policies look files up by path.
CREATE INDEX IF NOT EXISTS flight_photos_storage_path ON public.flight_photos (storage_path);
CREATE INDEX IF NOT EXISTS event_photos_storage_path ON public.event_photos (storage_path);
CREATE INDEX IF NOT EXISTS profiles_avatar_url ON public.profiles (avatar_url) WHERE avatar_url IS NOT NULL;
