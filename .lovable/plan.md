

# YouTube-Videos auf Flug-Detailseite und im Feed

## Übersicht
YouTube-Videos, die einem Flug zugeordnet sind, sollen (1) auf der Detailseite als eingebetteter Player angezeigt werden und (2) im Feed als abspielbarer Inhalt erscheinen.

---

## 1. FlightDetail.tsx — Eingebetteter YouTube-Player

Aktuell zeigt die Detailseite nur ein Thumbnail mit externem Link. Änderung:
- YouTube-URL parsen → Video-ID extrahieren
- Eingebetteten `<iframe>` Player rendern (responsive, 16:9 Aspect Ratio)
- Mehrere Videos untereinander

## 2. FeedFlight Interface erweitern

`FeedFlight` in `FeedCard.tsx` bekommt neues Feld:
```typescript
videoUrls: string[];  // YouTube-URLs
```

## 3. Feed.tsx — Videos laden

In `fetchFlights`:
- Zusätzlich `flight_videos` für alle `flightIds` laden
- YouTube-URLs pro Flight in `videoUrls` Array mappen

## 4. FeedCard.tsx — Video im Feed anzeigen

- YouTube-Video als eingebetteter iframe im Feed-Post (vor oder nach Fotos)
- Wenn Fotos UND Video vorhanden: Video als erstes Slide in der Carousel einbinden, oder als separater Block unter den Fotos
- Responsive 16:9 Embed mit Autoplay-off
- Double-Tap-Like funktioniert auch auf Video-Bereich

## 5. YouTube Embed Helper

Kleine Utility-Funktion zum Extrahieren der Video-ID:
```typescript
function getYoutubeEmbedUrl(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
  return match ? `https://www.youtube.com/embed/${match[1]}` : null;
}
```

## 6. i18n

Neue/bestehende Keys: `flights.videos`, `flights.watchVideo` bereits vorhanden.

---

## Dateien
- **Edit**: `src/pages/FlightDetail.tsx` — iframe statt Thumbnail-Link
- **Edit**: `src/components/FeedCard.tsx` — `videoUrls` Feld + Video-Embed
- **Edit**: `src/pages/Feed.tsx` — `flight_videos` laden + mappen
- Keine DB-Migration nötig (`flight_videos` Tabelle existiert bereits)

