

# Flugspur als dünne Linie statt Segmente

## Problem

Der Track wird aktuell als breite rechteckige fill-extrusion Segmente (Breite `0.00025`) gerendert, was blockhaft aussieht. Gewünscht: eine dünne, durchgehende Linie mit Höhenfarbkodierung. Nur die aktuelle Animationsposition soll als Segment mit Drop-Fläche dargestellt werden.

## Lösung

MapLibre's `line`-Layer unterstützt keine Elevation über Terrain — fill-extrusion bleibt nötig. Aber durch deutlich reduzierte Breite und angepasste base/height wirkt es wie eine durchgehende Linie.

### Änderungen in `Flight3DMap.tsx`

1. **Segment-Breite reduzieren**: `segmentToPolygon` Breite von `0.00025` auf `0.00008` — erscheint als dünne Linie statt breiter Ribbon
2. **Base = Height**: Statt `base: relHeight - 8` → `base: relHeight` (kein vertikaler Balken, nur eine flache Linie auf Flughöhe)
3. **Gleiche Anpassung für `track-progress`** (progressiver Aufbau bei Animation)
4. **Positions-Marker beibehalten**: Der weisse Punkt auf der Fluglinie bleibt als prominentes Segment
5. **Drop-Fläche beibehalten**: Die blaue Curtain an der aktuellen Position bleibt unverändert

### Technisch

- Statischer Track (`extrusionFeatures`): `width: 0.00008`, `base: relHeight` (gleich wie height → flach)
- Progressiver Track: gleiche Parameter
- Pos-Marker + Drop-Surface: bleiben wie bisher (breit + prominent)

Eine Datei, wenige Zeilen.

