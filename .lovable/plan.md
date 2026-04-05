

# Toggle: Nur letzte 25 Segmente anzeigen

## Übersicht
Ein neuer Toggle-Button in der Kontrollleiste, der während der Animation nur die letzten 25 Segmente des Tracks anzeigt statt den gesamten bisherigen Verlauf. Erzeugt einen "Schlangen"-Effekt.

## Änderungen in `src/components/Flight3DMap.tsx`

1. **State + Ref**: `trailMode` Boolean State + `trailModeRef` hinzufügen
2. **Toggle-Button**: Neuer Button in der Kontrollleiste (z.B. `Orbit`-Icon von Lucide oder ein einfaches Label "Trail") zwischen Crosshair und Fortschrittsbalken
3. **Progressive Track anpassen** (Zeilen 447-454): Wenn `trailModeRef.current` aktiv, statt `slice(0, idx)` nur `slice(Math.max(0, idx - 25), idx)` verwenden — zeigt nur die letzten 25 Segmente
4. **Bei Animation-Ende/Reset**: Wenn trailMode aktiv ist, nach Stopp trotzdem den vollen Track wieder anzeigen (bestehendes Verhalten bleibt)

Nur eine Datei, wenige Zeilen.

