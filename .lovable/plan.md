

# Event-Fotos, Feed-Beschreibung & Publish-Preview für Termine

## Übersicht
Termine (Events) bekommen analog zu Flügen: Foto-Upload, Feed-Beschreibung, `published_to_feed`/`published_at` Felder, und einen Publish-Preview-Dialog vor der Veröffentlichung im Feed.

---

## 1. Datenbank-Migration

### Neue Tabelle `event_photos`
```sql
CREATE TABLE public.event_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  storage_path text NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.event_photos ENABLE ROW LEVEL SECURITY;
-- RLS: Gruppenmitglieder können sehen, Ersteller kann CRUD
```

### Erweitere `flight_events`
```sql
ALTER TABLE public.flight_events
  ADD COLUMN published_to_feed boolean NOT NULL DEFAULT false,
  ADD COLUMN published_at timestamptz,
  ADD COLUMN feed_description text;
```

---

## 2. EventDetail.tsx — Foto-Upload & Publish-Button

Analog zu `FlightDetail.tsx`:
- Foto-Upload-Bereich mit Grid-Ansicht, Lightbox, Löschen
- "Im Feed veröffentlichen"-Button öffnet Preview-Dialog
- "Aus Feed entfernen"-Button wenn bereits publiziert
- Fotos werden in `flight-photos` Storage-Bucket gespeichert (existierender Bucket)

---

## 3. EventPublishPreviewDialog — Neue Komponente

`src/components/EventPublishPreviewDialog.tsx`:
- Ähnlich wie `PublishPreviewDialog` aber für Events
- Zeigt Vorschau: Avatar, Pilotname, Gruppenname, Event-Titel, Datum/Uhrzeit, Treffpunkt
- Ausgewählte Fotos (Swipe-Galerie)
- Bearbeitbare Feed-Beschreibung (Textarea)
- Foto-Auswahl mit Checkboxen
- "Veröffentlichen"-Button

---

## 4. Feed-Logik anpassen

### `Feed.tsx` — fetchEvents
- Nur Events mit `published_to_feed = true` laden (analog zu Flügen)
- Nach `published_at` sortieren
- `feed_description` als Beschreibung im Feed verwenden
- Event-Fotos laden und als Signed URLs bereitstellen

### `FeedEventCard.tsx`
- Foto-Swipe-Galerie hinzufügen (analog zu FeedCard)
- Feed-Beschreibung unterhalb der Event-Infos anzeigen
- Pilotname/Avatar des Erstellers anzeigen

---

## 5. FeedEvent Interface erweitern

```typescript
export interface FeedEvent {
  // bestehende Felder...
  feed_description: string | null;
  photos: { id: string; url: string }[];
  pilot_name: string;
  avatar_url: string;
  created_by: string;
  published_at: string;
}
```

---

## 6. i18n

Neue Keys in de/en/fr:
- `events.publishToFeed`, `events.unpublishFromFeed`, `events.publishedToFeed`
- `events.feedPreview`, `events.feedDescription`, `events.feedDescriptionPlaceholder`
- `events.addPhotos`, `events.selectPhotos`

## Dateien
- **Migration**: `event_photos` Tabelle + `flight_events` erweitern
- **Neu**: `src/components/EventPublishPreviewDialog.tsx`
- **Edit**: `src/pages/EventDetail.tsx` — Foto-Upload, Publish-Preview-Button
- **Edit**: `src/pages/Feed.tsx` — Events mit `published_to_feed` filtern, Fotos laden
- **Edit**: `src/components/FeedEventCard.tsx` — Fotos, Feed-Beschreibung, Ersteller-Info
- **Edit**: `src/i18n/locales/{de,en,fr}.json`

## Technische Details
- Event-Fotos nutzen denselben `flight-photos` Storage-Bucket (Pfad: `events/{userId}/{eventId}/...`)
- Bilder werden vor Upload mit `compressImage` komprimiert
- RLS auf `event_photos`: Gruppenmitglieder können SELECT, Event-Ersteller kann INSERT/DELETE
- Events ohne `published_to_feed = true` erscheinen nicht mehr automatisch im Feed

