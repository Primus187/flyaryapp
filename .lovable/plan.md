

# OG-Vorschau mit Flugkarten-Bild

## Problem
Die OG-Vorschau zeigt aktuell nur Text (Titel, Statistiken) und ggf. ein Flugfoto. Eine 2D-Karte mit dem Flugtrack wäre viel aussagekräftiger.

## Herausforderung
OG-Images müssen statische Bilder (PNG/JPEG) sein, die über eine URL abrufbar sind. Die App ist eine SPA — Karten werden nur im Browser gerendert. Wir brauchen einen serverseitigen Weg, ein Kartenbild zu erzeugen.

## Lösung: Mapbox Static Images API

Mapbox bietet eine URL-basierte API, die eine Karte mit Polyline als PNG zurückgibt — perfekt für OG-Images. Kostenlos bis 50.000 Aufrufe/Monat.

### Änderungen

**1. Neues Secret: `MAPBOX_ACCESS_TOKEN`**
- Ein Mapbox-Account (kostenlos) wird benötigt
- Der Token wird als Secret in Lovable Cloud hinterlegt

**2. `supabase/functions/get-shared-flight/index.ts`**
- Track-Daten (aus `igc_tracks.track_data`) laden (bereits vorhanden)
- Punkte auf ca. 100 reduzieren (Mapbox URL-Längen-Limit)
- Punkte als [GeoJSON Polyline-Overlay](https://docs.mapbox.com/api/maps/static-images/#overlay-options) in die Mapbox Static Image URL kodieren
- URL-Format: `https://api.mapbox.com/styles/v1/mapbox/outdoors-v12/static/geojson({...})/auto/600x400@2x?access_token=TOKEN`
- Diese URL als `og:image` verwenden (Priorität vor Flugfotos, wenn Track vorhanden)
- Fallback: Flugfoto oder kein Bild

```text
Ablauf bei Crawler-Request:
1. Track-Daten laden (schon implementiert)
2. Punkte samplen (jeder N-te Punkt, max ~100)
3. GeoJSON-LineString erstellen
4. Mapbox Static Image URL bauen
5. Als og:image in HTML einfügen
```

### Technische Details
- GeoJSON wird URL-encoded in die Mapbox-URL eingebettet
- `auto` als Bounds → Mapbox zentriert und zoomt automatisch auf den Track
- `600x400@2x` → 1200x800px Retina-Bild, ideal für OG-Vorschau
- Track-Linie: rot, 3px breit
- Kein zusätzlicher Storage nötig — das Bild wird on-the-fly von Mapbox generiert

Eine Datei, ein neues Secret.

