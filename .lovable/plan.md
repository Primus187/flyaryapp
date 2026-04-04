

# Fix Start-Höhe + Follow-Modus

## Problem: Start hängt in der Luft

`calcGroundLevel` berechnet den Durchschnitt von Start- und Lande-Altitude. Bei Paragliding ist der Start typisch auf einem Berg (z.B. 1500m), Landung im Tal (z.B. 800m) → groundLevel = 1150m → Start schwebt 350m über dem Terrain.

**Lösung**: Statt eines fixen groundLevel eine **linear interpolierte Baseline** zwischen Start-Altitude und Lande-Altitude verwenden. So ist der Track am Start = 0m (am Boden), bei der Landung = 0m (am Boden), und dazwischen zeigt er den Höhengewinn relativ zur gedachten Gleitlinie.

```text
Punkt i:  baseline = startAlt + (endAlt - startAlt) * (i / totalPoints)
          relHeight = max(0, altitude - baseline)
```

## Follow-Modus

Ein Toggle-Button (Crosshair-Icon) in den Playback-Controls. Wenn aktiv:
- Kamera folgt dem aktuellen Marker mit `map.easeTo()` (nicht `flyTo` — zu teuer)
- Nur alle ~20 Frames updaten, um Ruckeln zu vermeiden
- Pitch und Bearing bleiben vom User steuerbar
- Deaktiviert sich automatisch wenn User die Karte manuell bewegt

## Änderungen in `src/components/Flight3DMap.tsx`

1. **`calcGroundLevel` ersetzen** durch interpolierte Baseline-Funktion
2. **Alle Höhenberechnungen** (statischer Track, Animation, Drop-Surface, Pos-Marker) auf interpolierte Baseline umstellen
3. **Follow-State** hinzufügen: `followRef`, `followingState`
4. **Follow-Button** (Crosshair-Icon) in Controls einfügen
5. **Im Animations-Loop**: Alle ~20 Frames `map.easeTo({ center, duration: 300 })` wenn Follow aktiv
6. **User-Interaktion erkennen**: `map.on('dragstart')` → Follow deaktivieren

