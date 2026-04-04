

# Follow-Modus als POV-Kamera

## Aktuell
Der Follow-Modus zentriert die Karte nur auf die aktuelle Position (`easeTo({ center })`), ohne Bearing oder Pitch zu ändern — eine Draufsicht.

## Lösung
Im Follow-Modus die Kamera **hinter dem Piloten** positionieren, in Flugrichtung blickend:

### Änderungen in `Flight3DMap.tsx`

1. **Bearing aus Flugrichtung berechnen**: Aus aktuellem und nächstem Punkt den Kurs (Heading) ableiten:
   ```
   bearing = atan2(dx, dy) * 180 / PI
   ```

2. **Kamera leicht versetzt hinter dem Piloten**: `easeTo` mit:
   - `center`: leicht hinter der aktuellen Position (entgegen der Flugrichtung versetzt)
   - `bearing`: Flugrichtung
   - `pitch`: 70° (steiler Blickwinkel von hinten)
   - `zoom`: 14 (näher dran)
   - `duration`: 300ms (smooth)

3. **Follow-Modus aktivieren**: Beim Einschalten auch sofort Pitch/Zoom/Bearing setzen. Beim Deaktivieren oder Drag → zurück zum freien Modus (Pitch/Zoom bleiben wie vom User gesetzt).

4. **Update-Frequenz**: Weiterhin alle ~20 Frames, Bearing wird geglättet um Zittern zu vermeiden.

### Technisch
- Neue Hilfsfunktion `calcBearing(p1, p2)` → Grad
- Offset-Berechnung: ~0.001° entgegen Bearing für "hinter dem Piloten"-Effekt
- Nur der Follow-Block im `animate()` Loop ändert sich (Zeilen 443-449)

Eine Datei, eine Funktion ergänzt, ein Block angepasst.

