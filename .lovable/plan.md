

# burnair Meteo-Karte einbinden

## Analyse
Die burnair Map (`burnair.ch/meteo/map.php`) ist eine eigenständige Leaflet-Web-App mit Live-Wetterdaten, Windstationen und Thermik-Infos. Sie kann per `iframe` eingebettet werden. Beim ersten Laden erscheint ein Nutzungsbedingungen-Dialog, den der User einmalig akzeptieren muss.

## Umsetzung

### Zwei Integrationspunkte:

1. **LocationDetail-Seite**: Neben dem bestehenden Windy-Widget einen Link/Button zur burnair Map hinzufügen, der die Karte direkt auf die Koordinaten des Standorts zentriert (`?lat=...&lon=...&zoom=12` falls unterstützt, sonst Basis-URL)

2. **Eigene "Wetter"-Seite oder Sektion im "Mehr"-Menü**: Vollbild-iframe der burnair Map, damit Piloten die komplette interaktive Karte nutzen können — mit allen Layern, Windstationen etc.

### Empfehlung
Da die burnair Map am nützlichsten in Vollbild ist (viele Layer, Interaktion nötig), schlage ich eine **neue Route `/weather`** vor, erreichbar über das "Mehr"-Menü. Zusätzlich ein direkter Link auf der LocationDetail-Seite neben dem MeteoSchweiz-Link.

### Änderungen
- **`src/pages/Weather.tsx`** (neu): Vollbild-iframe mit `https://www.burnair.ch/meteo/map.php`
- **`src/App.tsx`**: Neue Route `/weather`
- **`src/pages/More.tsx`**: Neuer Menüpunkt "burnair Meteo Map"
- **`src/pages/LocationDetail.tsx`**: Link zur burnair Map (analog MeteoSchweiz-Link)
- **`src/i18n/locales/de.json`**: Übersetzung für "Meteo Map" etc.

### Technisch
- Einfacher iframe-Embed, keine API-Keys nötig
- `allow="geolocation"` auf dem iframe, damit die Karte den eigenen Standort nutzen kann
- Auf der LocationDetail-Seite wird der Link als `target="_blank"` geöffnet (besser als eingebetteter iframe, da die Karte viel Platz braucht)

