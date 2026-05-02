## Ziel

Im Flugformular zusätzlich zur YouTube-URL **kurze Videos direkt vom Handy hochladen** können. Limit: max. 60 Sekunden, max. 50 MB. YouTube-Integration bleibt parallel bestehen. Vorschaubild wird automatisch aus dem ersten Frame extrahiert.

## Was der Nutzer sieht

- Im FlightForm: zwei klar getrennte Bereiche
  - "Video hochladen" (für kurze Clips vom Handy)
  - "YouTube-Link" (für lange Videos auf YouTube)
- Beim Upload: Live-Validierung von Dauer & Größe; bei Übergröße/zu lang verständliche Fehlermeldung
- Im Feed (`FeedCard`) und in der Flugdetail-Seite: native Video-Player mit Posterframe; Player lädt erst beim Antippen (`preload="none"`), damit der Feed flüssig bleibt
- Videos werden als zusätzliche Slides im bestehenden Karussell angezeigt (vor Fotos)

## Technische Umsetzung

### Datenbank (Migration)

Tabelle `flight_videos` erweitern:

```sql
ALTER TABLE flight_videos
  ALTER COLUMN youtube_url DROP NOT NULL,
  ADD COLUMN storage_path TEXT NULL,
  ADD COLUMN poster_path TEXT NULL,
  ADD COLUMN duration_seconds INT NULL,
  ADD COLUMN size_bytes BIGINT NULL,
  ADD CONSTRAINT flight_videos_source_check
    CHECK (
      (youtube_url IS NOT NULL AND storage_path IS NULL)
      OR (youtube_url IS NULL AND storage_path IS NOT NULL)
    );
```

### Storage

Neuer privater Bucket `flight-videos`, MIME-Whitelist `video/mp4, video/quicktime, video/webm`. RLS-Policies analog zu `flight-photos` (Owner + Group-Member SELECT, Owner INSERT/DELETE). Posterframes (JPEG) leben im selben Bucket unter `posters/...`.

### Frontend

```text
src/lib/video-utils.ts          (neu)
  ├─ validateVideo(file)         → { ok, error, durationSec }
  ├─ extractPoster(file)         → JPEG Blob via <video>+<canvas>
  └─ MAX_SECONDS=60, MAX_BYTES=50MB

src/pages/FlightForm.tsx        (edit)
  ├─ neuer State: pendingVideos: { file, poster, duration }[]
  ├─ Eingabe: <input type="file" accept="video/*" capture="environment" multiple>
  ├─ Validierung + Posterframe-Generierung im Browser
  ├─ Upload nach erfolgreichem Flug-Insert (analog zu photos)
  └─ Insert-Row in flight_videos mit storage_path, poster_path, duration_seconds, size_bytes

src/lib/signed-url-cache.ts     (edit)
  └─ flight-videos Bucket unterstützen (gleiche Memoization-Pattern)

src/components/FeedCard.tsx     (edit)
  ├─ MediaSlide-Variante "uploaded-video" mit { videoUrl, posterUrl }
  └─ <video src poster preload="none" controls playsInline>

src/pages/FlightDetail.tsx      (edit)
  └─ Hochgeladene Videos zwischen YouTube-Embeds & Fotos rendern

src/hooks/use-offline-sync.ts   (edit)
  └─ Video-Files in IndexedDB-Queue ergänzen (analog photos)
```

### Edge Functions

Keine neuen Edge Functions nötig. Direkt-Upload via `supabase.storage.from("flight-videos").upload(...)`.

### Performance / UX-Details

- Player im Feed mit `preload="none"` + Posterframe → keine Bandbreite ohne Tap
- Carousel-Reihenfolge: YouTube-Videos → Direct-Videos → Fotos → Karte
- Upload zeigt Fortschritt pro Datei; bei Fehler bleibt der Flug erhalten (Media nach Flugdaten speichern, gemäß Memory-Regel)
- HEVC (.mov vom iPhone): wird akzeptiert; Hinweis-Text "MP4 empfohlen für beste Kompatibilität"

## Außerhalb des Scopes (bewusst)

- Server-seitiges Transcoding (HEVC→H.264, Adaptive Bitrate) — kann später per ffmpeg-wasm Edge Function nachgerüstet werden
- Video-Trimming im Browser
- Längere Videos (>60s) — bleiben YouTube vorbehalten

## Migration für bestehende Daten

Keine. Bestehende `flight_videos`-Zeilen haben `youtube_url` gesetzt und `storage_path` NULL — Constraint passt.
