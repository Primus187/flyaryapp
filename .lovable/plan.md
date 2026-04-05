
Fix: Play startet nicht wegen Re-Render/Remount-Schleife

Ursache
- `Flight3DMap` meldet während der Animation per `onAnimIndex` laufend den aktuellen Index an `FlightDetail`.
- `FlightDetail` rendert dadurch neu und erzeugt `points={...map(...)}` bei jedem Render als neues Array.
- In `Flight3DMap` hängt die Map-Initialisierung an `renderPoints`; durch das neue `points`-Array wird die Karte während der Animation laufend neu aufgebaut.
- Ergebnis: Beim Klick auf Play startet der Loop kurz, die Map wird aber direkt wieder zurückgesetzt. Die Ref-Warnungen im Console-Log sind separat und nicht der Hauptgrund für das aktuelle Problem.

Änderungen
1. `src/pages/FlightDetail.tsx`
- Die gemappten Track-Punkte einmal per `useMemo` aus `track.track_data.points` ableiten.
- Dieselbe stabile `trackPoints`-Referenz an `Flight3DMap` und `FlightAltitudeProfile` weitergeben.
- So führen `animIdx`/`hoverIdx`-Updates nicht mehr zu einem “neuen Track”.

2. `src/components/Flight3DMap.tsx`
- Den Animations-Loop zusätzlich robuster machen:
  - `cancelAnimationFrame` im Cleanup und beim Reset/Stop
  - `frameCountRef` beim Start/Reset zurücksetzen
  - `onAnimIndex(null)` nur bei echtem Stop/Reset/Ende
- Die Map-Initialisierung bleibt funktional gleich, wird aber nicht mehr unbeabsichtigt durch Parent-Re-Renders getriggert.

3. Verifikation
- 3D-Ansicht öffnen, Play klicken, prüfen:
  - Progress-Bar läuft sichtbar
  - weisser Positionsmarker bewegt sich
  - Drop-Fläche wandert mit
  - Höhenprofil-Linie läuft mit
  - Trail Mode funktioniert weiterhin

Technische Details
- Hauptfix ist kein MapLibre-Problem, sondern React-State-Churn durch instabile Prop-Referenzen.
- Wahrscheinlich reichen 2 Dateien: `FlightDetail.tsx` und `Flight3DMap.tsx`.
- Die Ref-Warnungen (`Function components cannot be given refs`) können danach separat aufgeräumt werden, sind aber für den Play-Bug nicht kritisch.
