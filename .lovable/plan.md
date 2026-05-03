## Ziel

Videos, die kurz genug sind (≤60s), aber über 50 MB liegen, sollen vor dem Upload automatisch im Browser komprimiert werden, sodass sie unter das 50-MB-Limit passen.

## Was der Nutzer sieht

- Wählt ein Video aus der Galerie
- Wenn Datei > 50 MB, aber Dauer ≤ 60s → Toast: "Video wird komprimiert…" mit Fortschrittsanzeige
- Nach erfolgreicher Komprimierung wird das Video normal als Pending-Video hinzugefügt
- Wenn Komprimierung fehlschlägt oder Endergebnis trotzdem > 50 MB → klare Fehlermeldung mit Empfehlung (z. B. kürzeres Video oder vorab in der Galerie reduzieren)
- Videos > 60s bleiben wie bisher abgelehnt (oder Vorschlag zum Trimmen via bestehendem `VideoTrimDialog`)

## Technische Umsetzung

### Neue Utility: `src/lib/video-compress.ts`

Nutzt die bereits im Projekt vorhandene Browser-API `MediaRecorder` + `HTMLVideoElement.captureStream()` (gleicher Ansatz wie `VideoTrimDialog.tsx` — bekannt funktionsfähig auf Android Chrome, dem Hauptzielsystem des Users).

```ts
export async function compressVideo(
  file: File,
  opts?: { targetBytes?: number; maxBitrate?: number; onProgress?: (pct: number) => void }
): Promise<File>
```

Vorgehen:
1. Video in unsichtbares `<video>` laden, Dauer ermitteln
2. Ziel-Bitrate berechnen: `targetBytes * 8 / duration` (mit Sicherheitsfaktor 0.85, Audio-Reserve ~96 kbps)
3. Optional Skalierung: Wenn Quelle > 1280px breit, auf max. 1280×720 herunterskalieren via `<canvas>` + `canvas.captureStream()` (für noch stärkere Reduktion bei sehr großen Quellen). Erste Iteration: nur Bitrate-Reduktion via `video.captureStream()`, da das einfacher und für 30s-Clips meist ausreicht.
4. `MediaRecorder` mit MIME-Präferenz `video/mp4;codecs=avc1,mp4a.40.2` → Fallback `video/webm`
5. Video von Anfang bis Ende abspielen, Chunks sammeln, am Ende als `File` zurückgeben
6. Falls Resultat immer noch > Ziel → einmal mit halber Bitrate erneut probieren, sonst Fehler

### Edits in `src/pages/FlightForm.tsx`

In `handleVideoSelect` (bzw. `addPendingVideoFromFile`):
- Wenn `file.size > MAX_VIDEO_BYTES` UND `duration ≤ MAX_VIDEO_SECONDS`:
  - State `videoProcessing` mit Label "Komprimiere Video…" setzen
  - `compressVideo(file, { targetBytes: MAX_VIDEO_BYTES * 0.95 })` aufrufen
  - Ergebnis an die bestehende `validateVideo`-Pipeline übergeben
- Bei Erfolg → ganz normal als Pending-Video aufnehmen
- Bei Fehler → Toast mit Original-Fehler

### Edits in `src/lib/video-utils.ts`

- Reihenfolge in `validateVideo` ändern: zuerst Dauer prüfen, **dann** Größe — damit der Aufrufer bei `error === "too large"` + `durationSec ≤ 60` weiß, dass Komprimierung sinnvoll ist. Alternativ neue Hilfs-Konstante `MAX_VIDEO_BYTES` exportieren (existiert bereits) und die Größenprüfung im FlightForm separat vor `validateVideo` machen.

### i18n

Neue Strings in `de.json`/`en.json`/`fr.json`:
- `flights.compressing` — "Komprimiere Video… ({pct}%)"
- `flights.compressFailed` — "Komprimierung fehlgeschlagen. Bitte vorab kürzen oder Qualität reduzieren."
- `flights.compressedTooLarge` — "Auch nach Komprimierung > 50 MB. Bitte kürzeres Video wählen."

### Browser-Kompatibilität

- Android Chrome: voll unterstützt (MP4-Output)
- Desktop Chrome/Firefox: voll unterstützt (WebM-Output)
- iOS Safari: `captureStream()` eingeschränkt — Fallback: Originalfehler "Video zu groß" wie bisher anzeigen, mit Hinweis "Auf iPhone bitte vorher in der Fotos-App kürzen oder Qualität reduzieren"

### Außerhalb des Scopes

- Server-seitiges Transcoding via ffmpeg-wasm Edge Function (deutlich aufwendiger, kann später nachgerüstet werden falls Browser-Komprimierung in der Praxis zu schwach/inkonsistent)
- Komprimierung von Videos > 60s (bleibt YouTube vorbehalten oder via bestehendem Trim-Dialog)

## Geänderte Dateien

- `src/lib/video-compress.ts` (neu)
- `src/pages/FlightForm.tsx`
- `src/lib/video-utils.ts` (kleine Anpassung Reihenfolge)
- `src/i18n/locales/{de,en,fr}.json`
