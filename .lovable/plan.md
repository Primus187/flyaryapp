

# 3D-Flugvisualisierung: Start-Fix, Linie statt Segmente, dynamische Drop-Fläche

## Probleme

1. **Start hängt in der Luft**: `minAlt` ist die tiefste Altitude im Track, aber der Startpunkt hat ggf. eine höhere Altitude als `minAlt` (Landung tiefer als Start). Die Höhe wird als `altitude - minAlt` berechnet — funktioniert nur wenn Start = tiefster Punkt.
2. **Boden-Marker zu prominent**: Gelber animierter Marker (`scale: 0.8`) zu auffällig.
3. **Track als Segmente statt durchgängige Linie**: Die fill-extrusion Ribbon-Segmente haben sichtbare Lücken.
4. **Drop-Lines permanent sichtbar**: Statische weisse Balken alle 30 Segmente statt dynamisch bei aktueller Position.

## Lösung

### 1. Start-Höhe korrigieren

Statt `minAlt` als globales Minimum verwenden, den **Startpunkt** als Baseline nehmen. Besser: den Durchschnitt der ersten und letzten 5 Punkte als Bodenniveau berechnen. So starten und landen beide nahe am Boden.

```text
groundLevel = avg(first 5 points altitude, last 5 points altitude)
relHeight = altitude - groundLevel
// Clamp auf min 0, damit negative Werte am Boden bleiben
```

### 2. Track als durchgängige Linie auf Flugebene

Die weisse Animations-Spur wird ersetzt durch einen prominenten **Positions-Marker auf der Fluglinie** (fill-extrusion Punkt-Polygon, grösser, leuchtend). Der Haupttrack bleibt als durchgängiger farbiger Ribbon — die Segment-Breite wird leicht erhöht und Lücken minimiert.

### 3. Boden-Marker dezenter

- Boden-Schatten-Marker: Kleiner (`scale: 0.4`), grau/halbtransparent statt gelb
- Neuer **Fluglinien-Marker**: Prominenter Punkt auf dem 3D-Track (fill-extrusion Kreis-Polygon, weiss/leuchtend, etwas breiter als Track)

### 4. Dynamische Drop-Fläche mit Fade

Statische Drop-Lines entfernen. Stattdessen im Animations-Loop:
- **Aktuelle Position**: Gefüllte blaue Fläche (fill-extrusion) vom Boden bis zur Flughöhe, leicht transparent
- **Letzte ~50 Segmente**: Gleiche blaue Fläche mit abnehmender Opacity (neueste = `0.6`, älteste = `0.0`)
- Da `fill-extrusion-opacity` keine per-Feature-Expression unterstützt, wird der Fade über die **Farb-Alpha-Komponente** gelöst: `rgba(60,130,246, 0.6)` → `rgba(60,130,246, 0.05)`

## Änderungen in `src/components/Flight3DMap.tsx`

1. **groundLevel-Berechnung**: Avg der ersten/letzten 5 Punkte statt globales Min
2. **Statische Drop-Lines entfernen**: `drop-lines` Source/Layer komplett raus
3. **Animated trail umbauen**: Statt weisser Ribbon-Spur → dynamische blaue Drop-Flächen mit Fade (letzte ~50 Segmente, Opacity per Farbe)
4. **Animierter Positions-Marker auf Fluglinie**: Fill-extrusion Punkt auf Flughöhe (weiss, prominent)
5. **Boden-Marker**: `scale: 0.4`, Farbe `#888`, dezent
6. **Segment-Breite**: Leicht erhöht für lückenlosere Darstellung

