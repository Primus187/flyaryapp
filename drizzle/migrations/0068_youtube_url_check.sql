-- Security review 2026-09-28: a flight video's YouTube address was stored unchecked and shown as a
-- link, so an address like "javascript:…" written through the API ran in the session of whoever
-- clicked it. Only http(s) addresses on YouTube's hosts are accepted now (same hosts as
-- src/lib/youtube.ts). All stored addresses satisfied this when it was added.

ALTER TABLE public.flight_videos DROP CONSTRAINT IF EXISTS flight_videos_youtube_url_check;
ALTER TABLE public.flight_videos ADD CONSTRAINT flight_videos_youtube_url_check CHECK (
  youtube_url IS NULL
  OR youtube_url ~* '^https?://((www|m|music)\.)?(youtube\.com|youtube-nocookie\.com|youtu\.be)(/|$)'
);
