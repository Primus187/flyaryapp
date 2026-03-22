

# Nominatim Reverse Geocoding schlägt fehl (CORS)

## Problem
Alle Nominatim API-Aufrufe scheitern mit "Failed to fetch" — die Preview-Domain wird von Nominatim per CORS blockiert. Deshalb bleiben die 31 Orte ohne `country_code` und das Backfill läuft bei jedem Seitenaufruf erneut, ohne jemals zu funktionieren.

Die Landeplätze, die bereits einen `country_code` haben, wurden wahrscheinlich über die veröffentlichte Domain oder beim Erstellen gesetzt, als CORS noch nicht blockiert hat.

## Lösung

### 1. Backend-Funktion für Reverse Geocoding
- Neue Edge Function `reverse-geocode` erstellen
- Nimmt `lat` und `lon` als Query-Parameter
- Ruft Nominatim serverseitig auf (kein CORS-Problem)
- Gibt `{ country_code: "CH" }` zurück

### 2. Client-Code anpassen
- `Locations.tsx`: Backfill und `reverseGeocode` rufen die Edge Function statt Nominatim direkt auf
- Gleiche Rate-Limiting-Logik (1.1s Delay)

## Dateien
- **Neu**: `supabase/functions/reverse-geocode/index.ts`
- **Edit**: `src/pages/Locations.tsx` — Nominatim-URLs durch Edge Function ersetzen

