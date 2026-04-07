

# Instagram-Style Feed & Shared Flight Redesign

## Analyse: Was fehlt zum Instagram-Look

### FeedCard (aktuell)
- Fotos, Videos und Map werden **separat untereinander** dargestellt statt in einem einheitlichen Medien-Carousel
- Map ist nur 150px hoch und non-interactive — wirkt klein und technisch
- Fotos sind aspect-square, Videos aspect-video — kein einheitliches Format
- Kein Fullscreen-Lightbox bei Tap auf ein Foto
- Keine Swipe-Dots für Videos im Carousel

### SharedFlightDetail (aktuell)
- Fotos als kleine horizontal scrollende Thumbnails (h-32) — nicht immersiv
- Videos separat unten — kein zusammenhängendes Medien-Erlebnis
- Layout ist "Daten-zentriert" (Cards mit Stats) statt "Medien-zentriert"
- Kein Gradient-Ring am Avatar wie im Feed

---

## Umsetzung

### 1. Unified Media Carousel im FeedCard

Alle Medien (Videos, Fotos, Map-Preview) in **einem einzigen Embla-Carousel** zusammenführen:

```text
Slide-Reihenfolge:
[YouTube Video(s)] → [Fotos] → [Map-Preview (wenn Track/Takeoff vorhanden)]
```

- Einheitliches `aspect-[4/5]` Format (Instagram-Proportionen) statt mix aus square und video
- Pagination-Dots zeigen alle Slides an
- "1/5" Counter oben rechts (wie Instagram)
- Map-Slide wird grösser (aspect-[4/5] statt 150px) und bekommt einen Gradient-Overlay mit Stats-Badges
- DoubleTapHeart wraps das gesamte Carousel (statt jeden Abschnitt einzeln)

**Datei:** `src/components/FeedCard.tsx`

### 2. Fullscreen Photo Lightbox im Feed

- Tap auf ein Foto-Slide öffnet eine Fullscreen-Lightbox (Dialog)
- Swipe zwischen Fotos in der Lightbox
- Pinch-to-zoom optional (CSS `touch-action`)

**Datei:** `src/components/FeedCard.tsx` (inline Dialog)

### 3. SharedFlightDetail Instagram-Redesign

Komplett-Umbau der SharedFlightDetail-Seite:

- **Hero-Carousel** ganz oben: Videos + Fotos + Map in einem Carousel (gleiche Logik wie FeedCard)
- **Avatar-Header** mit Gradient-Ring (wie Feed) über dem Carousel als Overlay
- **Stats als Overlay-Badges** auf der Map (nicht als separate Cards)
- **Kompakte Info-Section** unter dem Carousel: Pilot-Name, Datum, Route (Takeoff → Landing), Beschreibung
- **Stats-Grid** kompakter: nur die relevanten Werte, inline statt in eigenen Cards
- 2D/3D Toggle bleibt, aber nur sichtbar wenn Track vorhanden

**Datei:** `src/pages/SharedFlightDetail.tsx`

### 4. FeedCard: Kommentare Instagram-Style

- Kommentar-Input bekommt einen Avatar des aktuellen Users
- "Gefällt X Personen" Text statt nur Emoji-Badges
- Timestamp unter jedem Kommentar
- "Antworten" Option (visuell, keine Sub-Threading-Logik)

**Datei:** `src/components/FeedCard.tsx`

---

## Zusammenfassung der Änderungen

| Datei | Änderung |
|-------|----------|
| `src/components/FeedCard.tsx` | Unified Media Carousel, Lightbox, Kommentar-Styling |
| `src/pages/SharedFlightDetail.tsx` | Hero-Carousel, Instagram-Layout |
| `tailwind.config.ts` | ggf. `aspect-[4/5]` falls nicht default |

Keine DB-Migrationen nötig. Rein Frontend-Änderungen.

