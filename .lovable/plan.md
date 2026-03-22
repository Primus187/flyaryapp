

# Feed-Redesign: Chronologisch nach Publikationsdatum, Kartenansicht & Publikationsinfos

## Übersicht
Der Feed wird zu einem echten Social-Feed umgebaut: chronologisch nach Erstellungsdatum sortiert, eigene Flüge inklusive, mit Mini-Karte für Flugtracks und vollständigen Publikationsinformationen.

## 1. Chronologische Sortierung nach `created_at`

Aktuell wird nach `date` (Flugdatum) bzw. `event_date` sortiert. Neu wird `created_at` als einheitliches Sortierdatum verwendet.

**Edit: `src/pages/Feed.tsx`**
- `fetchFlights`: zusätzlich `created_at` selektieren, als `date` im FeedItem verwenden
- `fetchEvents`: `created_at` statt `event_date` für Sortierung
- `fetchChallenges`: `created_at` statt `start_date` für Sortierung
- Eigene Flüge **nicht mehr ausschliessen** (`.neq("user_id", userId)` entfernen) — eigene Posts sollen auch im Feed erscheinen

## 2. IGC-Track & Mini-Karte im FeedCard

**Edit: `src/components/FeedCard.tsx`**
- Neues Feld `trackPoints` in `FeedFlight`-Interface
- Zwischen Foto und Actions eine kompakte Karte (150px Höhe) mit `FlightDetailMap` rendern, wenn Track-Daten vorhanden
- Falls kein Foto aber Track vorhanden: Karte als visuelles Hauptelement anzeigen

**Edit: `src/pages/Feed.tsx` (fetchFlights)**
- Zusätzlich `igc_tracks` laden: `track_data` (enthält die Punkte als JSON)
- Takeoff/Landing Location-Koordinaten mitlesen für Karten-Marker
- Track-Punkte in `FeedFlight.trackPoints` speichern
- Takeoff/Landing-Koordinaten in `FeedFlight.takeoff`/`FeedFlight.landing` speichern

## 3. Erweiterte Publikationsinfos in FeedCard

**Edit: `src/components/FeedCard.tsx`**
- Gruppenname unter Pilotname anzeigen (benötigt neues Feld `group_name`)
- `created_at` als "vor X Stunden/Tagen" relative Zeitanzeige
- Klick auf Pilotname/Avatar navigiert zum Flug-Detail
- Glider-Info prominenter darstellen

**Edit: `src/pages/Feed.tsx` (fetchFlights)**
- `group_id` und Gruppenname mitlesen, in FeedFlight-Daten aufnehmen
- `created_at` im FeedFlight-Interface ergänzen

## 4. FeedFlight Interface erweitern

```typescript
export interface FeedFlight {
  // bestehende Felder...
  created_at: string;          // NEU: für relative Zeitanzeige
  group_name: string;          // NEU: Gruppenname
  trackPoints: [number, number][]; // NEU: IGC-Track für Karte
  takeoff: { latitude: number; longitude: number; name?: string } | null; // NEU
  landing: { latitude: number; longitude: number; name?: string } | null; // NEU
}
```

## 5. i18n

Neue Keys in de/en/fr:
- `feed.justNow`, `feed.minutesAgo`, `feed.hoursAgo`, `feed.daysAgo`
- `feed.inGroup` (z.B. "in Vertical")

## Dateien
- **Edit**: `src/pages/Feed.tsx` — `created_at` sortieren, eigene Flüge zeigen, Track-Daten laden
- **Edit**: `src/components/FeedCard.tsx` — Mini-Karte, Gruppenname, relative Zeit
- **Edit**: `src/i18n/locales/{de,en,fr}.json` — Neue Keys

## Technische Details
- IGC `track_data` ist JSONB mit einem Array von `[lat, lng]`-Punkten — wird direkt an `FlightDetailMap` übergeben
- Für die Mini-Karte wird die bestehende `FlightDetailMap`-Komponente mit reduzierter Höhe (150px) wiederverwendet
- Track-Punkte werden nur für die ersten 20 Flüge geladen (Performance)
- Takeoff/Landing-Koordinaten kommen aus der `locations`-Tabelle (bereits via FK verknüpft)

