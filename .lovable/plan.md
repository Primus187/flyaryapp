

# Fix: Animation startet nicht

## Ursache

In Zeile 372 prüft der Animations-Loop `!animMarkerRef.current`. Da der Boden-Marker entfernt wurde, wird `animMarkerRef.current` nie gesetzt (bleibt `null`). Die Animation bricht sofort ab.

## Lösung

In `src/components/Flight3DMap.tsx`:
- Zeile 372: `animMarkerRef.current` aus der Guard-Bedingung entfernen
- `animMarkerRef` komplett entfernen (Ref-Deklaration, Cleanup, Zuweisung) — wird nicht mehr benötigt

Eine einzige Datei, minimale Änderung.

