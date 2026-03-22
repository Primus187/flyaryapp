

# Bestehende Orte mit Ländercode aktualisieren & Listen-Refresh fixen

## Problem
1. Alle ~50 bestehenden Orte haben `country_code: null`, obwohl Koordinaten vorhanden sind
2. Die Orte-Liste aktualisiert sich möglicherweise nicht korrekt nach Änderungen

## Lösung

### 1. Automatisches Backfill beim Laden der Orte-Seite
- Beim Laden der Orte prüfen, welche `country_code: null` haben aber gültige Koordinaten (lat/lng != 0)
- Für diese Orte sequentiell Reverse Geocoding via Nominatim durchführen (1 Request/Sekunde Rate Limit)
- Jeden Ort einzeln updaten und danach die Liste neu laden
- Fortschrittsanzeige: kleiner Banner "Ländercodes werden aktualisiert... (12/48)"
- Läuft nur einmal, da beim nächsten Laden alle country_codes gesetzt sind

### 2. Listen-Refresh absichern
- `fetchLocations` wird nach dem Backfill erneut aufgerufen
- `useEffect` Dependency korrekt setzen

## Dateien
- **Edit**: `src/pages/Locations.tsx` — Backfill-Logik + Fortschrittsanzeige beim Mount

## Technische Details
- Nominatim Rate Limit: 1 req/sec, daher `await new Promise(r => setTimeout(r, 1100))` zwischen Requests
- Bei ~50 Orten dauert das ca. 1 Minute beim ersten Mal
- Abbruch wenn Seite verlassen wird (cleanup in useEffect)

