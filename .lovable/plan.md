

# XC-Strecke aus IGC-Datei berechnen

## Problem
Beim IGC-Upload wird `distance_km` nicht ins Formular übernommen. Die aktuell berechnete `totalDistanceKm` ist die gesamte Flugspur-Länge — nicht die XC-relevante Strecke (freie Distanz zwischen Start und fernstem Punkt, bzw. optimiertes Dreieck).

## Lösung

### 1. XC-Distanz-Berechnung hinzufügen (`src/lib/igc-parser.ts`)
Eine neue Funktion `computeXcDistance` berechnet die **freie Strecke** (maximale Distanz zwischen zwei beliebigen Punkten des Tracks). Das ist die gängige XC-Metrik für Nicht-Dreiecks-Flüge und entspricht dem, was XContest als "Free Distance" anzeigt.

**Algorithmus**: Über die gesampelten Track-Punkte wird die maximale Haversine-Distanz zwischen allen Punktpaaren gesucht. Um bei grossen Tracks performant zu bleiben, wird zuerst auf ~500 Punkte heruntergesampelt, dann brute-force die maximale Distanz berechnet (O(n²) mit n=500 → 125k Vergleiche, unkritisch).

Neues Feld in `IGCData`: `xcDistanceKm: number`

### 2. Formular automatisch befüllen (`src/pages/FlightForm.tsx`)
In `handleIGCUpload` (Zeile 101) wird `distance_km` mit `parsed.xcDistanceKm` gesetzt, falls der Wert > 0 ist — analog zu den anderen Feldern.

### 3. Anzeige anpassen (`src/pages/FlightDetail.tsx`)
Falls `distance_km` nicht manuell gesetzt wurde, den XC-Wert aus den IGC-Stats als Fallback anzeigen.

## Dateien

| Datei | Änderung |
|-------|----------|
| `src/lib/igc-parser.ts` | `xcDistanceKm` berechnen (max. Distanz zwischen zwei Track-Punkten) |
| `src/pages/FlightForm.tsx` | `distance_km` aus IGC-Daten ins Formular übernehmen |
| `src/lib/igc-upload.ts` | `xcDistanceKm` in `trackData.stats` mitspeichern |

Keine DB-Migration nötig — `distance_km` existiert bereits in der `flights`-Tabelle.

