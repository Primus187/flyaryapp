

# Live-Flugaufzeichnung mit Variometer

## Übersicht
Neue Seite `/record` zum Aufzeichnen von Flügen direkt in der App mit GPS-Tracking, Live-Karte und akustischem Variometer.

## Funktionen

### Live-Aufzeichnung
- **GPS-Tracking** via `navigator.geolocation.watchPosition()` mit hoher Genauigkeit
- Aufzeichnung von Position, Höhe (GPS-Altitude) und Zeitstempel in einem Intervall
- Start/Stop-Button, Pause-Möglichkeit
- Aufgezeichnete Punkte werden im State gesammelt und am Ende als IGC-Datei generiert

### Live-Karte
- Leaflet-Karte zeigt die aktuelle Position als Marker
- Bisheriger Track wird als Polyline live gezeichnet
- Karte folgt der Position (zentriert sich automatisch)

### Variometer (akustisches Steigen/Sinken)
- Berechnung der Vertikalgeschwindigkeit (m/s) aus den letzten GPS-Höhenwerten
- **Audio-Feedback** via Web Audio API (`OscillatorNode`):
  - Steigen: Aufsteigende Pieptöne (höhere Frequenz + schnelleres Intervall bei stärkerem Steigen)
  - Sinken: Tiefer Dauerton ab einem konfigurierbaren Schw