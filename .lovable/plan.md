

# Eingebettete Karte auf der Flugdetail-Seite

## Was sich ändert

Eine neue Kartenkomponente (`FlightDetailMap`) wird direkt auf der FlightDetail-Seite zwischen der Route-Card und den Stats eingebettet. Sie zeigt:

- **Startplatz** als grünen Marker (wenn Koordinaten vorhanden)
- **Landeplatz** als roten Marker (wenn Koordinaten vorhanden)
- **IGC-Track** als blaue Polyline (wenn `track_data` vorhanden)
- Karte passt sich automatisch an die Bounds an (Track oder Marker)

## Dateien

### 1. Neue Komponente: `src/components/FlightDetailMap.tsx`
- Leaflet `MapContainer` mit OpenTopoMap-Tiles
- Props: `takeoff` (name/lat/lng), `landing` (name/lat/lng), `trackData` (points-Array, optional)
- Grüner/roter Marker (gleiche Icons wie MapView), Polyline für Track
- `FitBounds`-Logik: Track vorhanden → fit to track, sonst → fit to markers
- Höhe: ~250px, abgerundete Ecken, kein Zoom-Control
- Popups auf den Markern mit Ortsnamen

### 2. Edit: `src/pages/FlightDetail.tsx`
- Import `FlightDetailMap`
- Karte einfügen nach der Route-Card, vor den Stats
- Zeigt die Karte wenn mindestens ein Ort mit Koordinaten ≠ 0,0 vorhanden ist
- Track-Punkte aus dem bereits geladenen `track`-State extrahieren
- Der separate "Track auf Karte anzeigen"-Button entfällt (Karte ist jetzt inline)

