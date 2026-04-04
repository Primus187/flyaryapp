

# Fix: Flughöhe relativ zum Terrain + Geschwindigkeitsregler

## Problem 1: Track zu hoch

MapLibre's `fill-extrusion` mit aktivem 3D-Terrain **addiert** die Extrusions-Höhe auf die Terrain-Höhe. Ein Punkt bei 1500m ASL auf einem Berg bei 1200m wird also bei 1200+1500 = 2700m gerendert statt bei 1500m.

**Lösung**: Höhe relativ zum Boden (AGL) berechnen. Die minimale Altitude im Track wird als Bodenniveau approximiert. `height = altitude - minAlt` ergibt bei Start/Landung ~0m (am Boden) und zeigt Thermik-Höhengewinne korrekt an.

## Problem 2: Animation zu schnell

Aktuell `progressRef.current += 0.002` pro Frame (500 Frames = ~8 Sekunden für ganzen Flug).

**Lösung**: Speed-Selector (1x, 2x, 5x, 10x) in den Playback-Controls. Default wird auf ~30 Sekunden Gesamtdauer gesetzt (langsamer). Ein kleiner Button-Toggle zeigt die aktuelle Geschwindigkeit.

## Änderungen in `src/components/Flight3DMap.tsx`

1. **Höhenberechnung anpassen**:
   - `height: avgAlt - minAlt` statt `height: avgAlt`
   - `base: Math.max(0, avgAlt - minAlt - 8)` statt `Math.max(0, avgAlt - 12)`
   - Drop-lines: `height: p.altitude - minAlt`, `base: 0`
   - Animated track: gleiche relative Berechnung

2. **Speed-State hinzufügen**:
   - `speedRef` mit Werten `[0.0004, 0.0008, 0.002, 0.004]` für 1x/2x/5x/10x
   - Default: `0.0004` (~40 Sekunden bei 800 Punkten)
   - Speed-Button in Controls der zwischen Stufen wechselt
   - Anzeige: "1x", "2x", "5x", "10x"

