

# Ort-Detailseite

## Übersicht
Neue Seite `/locations/:id` zeigt alle Infos zu einem Ort: Karte, Metadaten und eine Liste aller Flüge von/zu diesem Ort.

## Dateien

### 1. Neue Seite: `src/pages/LocationDetail.tsx`
- **Header**: Zurück-Button, Ortsname, Bearbeiten/Löschen-Buttons
- **Karte**: Leaflet-Karte mit Marker auf der Position (wie `FlightDetailMap`, aber nur ein Marker). Nur anzeigen wenn Koordinaten ≠ 0,0
- **Info-Cards** (2x2 Grid): Typ (Startplatz/Landeplatz/Beides), Höhe, Koordinaten, Beschreibung
- **Flug-Liste**: Query auf `flights` wo `takeoff_location_id = id OR landing_location_id = id`, sortiert nach Datum absteigend. Jeder Flug als klickbare Card (Datum, Dauer, Gegenort) → navigiert zu `/flights/:flightId`
- Daten laden via Supabase: Location by ID + Flights mit Join auf den jeweiligen Gegenort

### 2. Edit: `src/App.tsx`
- Route `/locations/:id` → `LocationDetail` hinzufügen (innerhalb AppLayout)

### 3. Edit: `src/pages/Locations.tsx`
- Ort-Card klickbar machen → `navigate(/locations/${loc.id})` beim Klick auf den Namen/Card-Bereich
- Bearbeiten/Löschen-Buttons bleiben als Aktionen rechts

