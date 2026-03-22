

# Länder-Flaggen bei Orten anzeigen

## Problem
Die `locations`-Tabelle hat kein `country`-Feld. Flaggen können daher nicht angezeigt werden.

## Lösung

### 1. Migration: `country` Spalte hinzufügen
- Neue Spalte `country_code text` (2-Buchstaben ISO-Code, z.B. "CH", "DE", "AT") auf `locations`
- Nullable, da bestehende Orte keinen Ländercode haben

### 2. Flaggen-Emoji aus Country-Code
- Einfache Hilfsfunktion: ISO-Code → Flaggen-Emoji (z.B. "CH" → 🇨🇭) via Unicode Regional Indicator Symbols
- Keine Library nötig, nur 2 Zeilen Code

### 3. Locations-Liste: Flagge anzeigen
- In `renderLocationCard` neben dem Ortsnamen die Flagge als Emoji anzeigen
- Nur wenn `country_code` gesetzt

### 4. Formular: Country-Code Feld
- Im Create/Edit-Dialog ein neues Feld "Land" als Select mit den gängigsten Ländern (CH, DE, AT, FR, IT, ES, etc.) oder als freies Input für den 2-Buchstaben-Code
- `form`-State um `country_code` erweitern

### 5. LocationDetail, ImportLocations
- `LocationDetail.tsx`: Country-Flagge neben dem Namen anzeigen
- `ImportLocations` / CSV-Import: bestehende `country`-Spalte aus CSV in `country_code` mappen

## Dateien
- **Migration**: `ALTER TABLE locations ADD COLUMN country_code text`
- **Edit**: `src/pages/Locations.tsx` — Form + Flaggen-Anzeige
- **Edit**: `src/pages/LocationDetail.tsx` — Flagge anzeigen
- **Edit**: `src/pages/ImportLocations.tsx` — Country-Code beim Import setzen

