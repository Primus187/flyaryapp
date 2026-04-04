
Ziel: Der Follow-Modus soll flüssig bleiben, aber Zoom, Pitch und Blickrichtung auf Mobile und Desktop jederzeit zulassen. Follow bleibt aktiv, bis das Crosshair deaktiviert wird, pausiert aber die automatische Zentrierung zuverlässig während echter Benutzer-Gesten.

1. Ursache beheben
- Die Kamera wird aktuell im Animations-Loop weiter per `jumpTo` nachgeführt.
- Dadurch wird die Kartenmitte selbst dann noch laufend überschrieben, wenn der Nutzer gerade mit den Fingern zoomt, dreht oder kippt.
- Die aktuelle Gesture-Erkennung mit kurzer Timeout-Logik ist dafür zu unzuverlässig, besonders auf Touch-Geräten.

2. Follow-Logik robuster machen
- In `src/components/Flight3DMap.tsx` die aktuelle `userInteractingRef`-Steuerung auf ein klareres Pause-System umstellen:
  - `followPausedUntilRef`
  - `programmaticMoveRef`
- Bei echten Nutzer-Gesten die Follow-Zentrierung nur temporär pausieren, nicht deaktivieren.
- Beim Ende der Geste automatisch nach kurzer Verzögerung wieder aufnehmen.

3. Nutzer-Gesten zuverlässiger erkennen
- Nicht nur auf einzelne Start/End-Events verlassen.
- Zusätzliche Move-bezogene Karten-Events verwenden, damit auch Pinch/Rotate/Pitch auf Mobile sauber erkannt werden.
- Programmgesteuerte Kamera-Updates dabei ausfiltern, damit Follow sich nicht selbst als User-Interaktion markiert.

4. Kamera-Update entschärfen
- `map.stop()` aus der Gesture-Logik entfernen.
- Im Follow-Block nur dann zentrieren, wenn gerade keine User-Interaktion aktiv ist.
- Weiterhin nur das `center` nachführen, niemals `zoom`, `bearing` oder `pitch`.
- Eine sanfte Interpolation beibehalten, aber mit kleinerem Smoothing und optionalem Mindestabstand, damit die Kamera nicht mikroruckelt.

5. Resume-Verhalten verbessern
- Die Pause nach einer Geste etwas länger wählen als aktuell, damit die Kamera nicht sofort zurückschnappt.
- So kann der Nutzer nach Zoom/Rotate/Pitch noch kurz in seiner gewählten Perspektive bleiben, bevor Follow wieder weich übernimmt.

6. Erwartetes Ergebnis
- Animation bleibt flüssig.
- Während der Wiedergabe kann der Nutzer mit den Fingern frei zoomen, drehen und kippen.
- Follow bleibt aktiv, solange das Crosshair aktiv ist.
- Nach Ende einer Geste übernimmt die Kamera wieder automatisch und weich.

Technische Details
- Datei: nur `src/components/Flight3DMap.tsx`
- Wahrscheinlich anzupassen:
  - Event-Handler rund um `pauseFollowForGesture` / `resumeFollowAfterGesture`
  - Refs für Interaction-/Pause-Status
  - Follow-Block im `animate()`-Loop
  - Entfernen von `map.stop()` und Vereinfachung der bisherigen Timeout-Logik
