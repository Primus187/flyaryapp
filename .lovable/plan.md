
# Fix: Drop-Fläche nur aktuelles Segment + transparentes Hellblau

## Problem
1. `TRAIL_LENGTH = 1` bedeutet die Schleife läuft von `idx - 1` bis `idx` → **2 Segmente** statt 1
2. Die Farbe `rgba(135, 206, 250, 0.25)` wird durch `fill-extrusion-opacity: 0.9` multipliziert → zu dunkel

## Lösung in `Flight3DMap.tsx`

1. **Nur aktuelles Segment**: Die Schleife durch eine einzelne Feature-Erzeugung für `idx` ersetzen (kein `startIdx`, kein Fade-Berechnung)
2. **Transparentes Hellblau**: Farbe auf `rgba(135, 206, 250, 0.3)` setzen und `fill-extrusion-opacity` auf `0.5` reduzieren

### Konkrete Änderungen
- Zeile 295: `fill-extrusion-opacity` von `0.9` auf `0.5`
- Zeilen 411-436: Schleife vereinfachen — nur ein einzelnes Feature für das Segment bei `idx` erzeugen, feste Farbe `rgba(135, 206, 250, 0.3)`
- `TRAIL_LENGTH` Konstante kann entfernt werden (nicht mehr benötigt)
