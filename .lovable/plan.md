

# 3D-Flugtrack auf korrekter Höhe über Terrain

## Problem

Die Flugbahn wird aktuell als `line`-Layer gerendert, der in MapLibre GL immer auf das Terrain "gedraped" wird — also auf Bodenhöhe klebt. MapLibre unterstützt im Gegensatz zu Mapbox GL kein `line-z-offset` oder `line-elevation-reference`.

## Lösung: Fill-Extrusion statt Line

Der Track wird als `fill-extrusion`-Layer gerendert. Jedes Segment wird zu einem dünnen Polygon (schmaler Streifen) mit `fill-extrusion-height` = Flughöhe und `fill-extrusion-base` = Flughöhe - 5m. Das erzeugt schmale "Balken" die in der richtigen Höhe über dem Terrain schweben — genau wie bei Burnair.

```text
Aktuell:     Track liegt auf dem Boden ___/\___/\___ 
Neu:         Track schwebt in Flughöhe    ─────────
                                        /          \
                              Terrain: /            \____
```

## Technische Umsetzung

### Datei: `src/components/Flight3DMap.tsx`

1. **Segmente als Polygone**: Jedes Liniensegment (2 Punkte) wird zu einem schmalen Rechteck (~0.00005° breit, senkrecht zur Flugrichtung) aufgeblasen
2. **Fill-Extrusion Layer**: Statt `line`-Layer wird ein `fill-extrusion`-Layer verwendet mit:
   - `fill-extrusion-height`: IGC GPS-Altitude des Segments
   - `fill-extrusion-base`: Altitude - 5m (dünner Balken)
   - `fill-extrusion-color`: Bestehender Farbgradient (blau→gelb→rot)
3. **Schatten-Linie**: Optional eine zweite, gedämpfte `line`-Ebene auf dem Boden als "Schatten" für räumliche Orientierung
4. **Terrain-Exaggeration**: Von 1.5 auf 1.3 reduzieren, damit Proportionen besser stimmen

Keine neuen Dateien, keine DB-Änderungen — nur Umbau der Rendering-Logik in `Flight3DMap.tsx`.

