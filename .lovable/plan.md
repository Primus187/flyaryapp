

# Social Network UX Verbesserungen

## Analyse des Ist-Zustands
Der Feed hat bereits: Likes, Kommentare, Foto-Galerie, Pull-to-Refresh, relative Zeitanzeigen, Avatar-Navigation zu Profilen. Es fehlen jedoch mehrere Kern-Features, die User von Instagram/Strava gewohnt sind.

---

## Vorgeschlagene Verbesserungen (priorisiert)

### 1. Doppeltipp-Like auf Fotos/Karten
Instagram-Signature-Feature: Doppeltipp auf ein Bild löst Like aus mit kurzer Heart-Animation.
- `FeedCard`: `onDoubleClick` auf Foto-Bereich und Karte
- Kurze ❤️-Animation (scale-in/fade-out) als Overlay
- Haptisches Feedback (wenn verfügbar via `navigator.vibrate`)

### 2. Like-Animation
- Heart-Icon: Bouncy Scale-Animation beim Liken (spring-Effekt)
- Kurzes rotes Partikel-Burst oder Pulse-Ring

### 3. Kommentar-Likes
- Jeder Kommentar bekommt ein kleines Heart-Icon zum Liken
- Neue Tabelle `comment_likes` oder Spalte in `feed_comments`
- Meistgelikte Kommentare werden oben angezeigt

### 4. Push-Benachrichtigungen (In-App)
- Notification-Bell im Header mit Badge-Counter
- Neue Tabelle `notifications` (type: like, comment, achievement, event_reminder)
- Trigger: Bei Like/Kommentar auf eigenen Post → Notification erstellen
- Notification-Dropdown mit "X hat deinen Flug geliked", "Y hat kommentiert"

### 5. Share/Bookmark-Buttons
- Share-Button (native `navigator.share()` API) um Posts extern zu teilen
- Bookmark-Button zum Speichern interessanter Posts
- Neue Tabelle `bookmarks` mit Bookmark-Icon in der Action-Bar

### 6. Story-ähnliche Highlights (Gruppen-Stories)
- Horizontale Avatar-Reihe oben im Feed (wie Instagram Stories)
- Zeigt Piloten die heute/gestern geflogen sind
- Klick öffnet deren neuesten Post direkt

### 7. Erweiterte Kommentar-UX
- @Mentions mit Auto-Complete (Gruppenmitglieder)
- Antworten auf Kommentare (Thread-Struktur)
- Emoji-Schnellreaktionen (👏🔥🪂🏔️)

### 8. Infinite Scroll mit Lazy Loading
- Aktuell: Festes Limit von 20 Posts
- Neu: Cursor-basiertes Paging, lädt weitere Posts beim Scrollen
- Skeleton-Loader am Ende des Feeds

---

## Empfohlene Umsetzungsreihenfolge

**Phase 1 — Quick Wins (höchster Impact):**
- Doppeltipp-Like mit Heart-Animation
- Like-Animation (Bounce)
- Infinite Scroll
- "Heute aktive Piloten" als Story-Leiste

**Phase 2 — Engagement:**
- In-App Notifications
- Kommentar-Likes
- Share & Bookmark

**Phase 3 — Advanced:**
- @Mentions & Antworten
- Emoji-Reaktionen

---

## Technische Details

### Doppeltipp-Like
```typescript
// Einfacher Double-Tap Handler
let lastTap = 0;
const handleTap = () => {
  const now = Date.now();
  if (now - lastTap < 300) { onLikeToggle(id); showHeartAnimation(); }
  lastTap = now;
};
```

### Notifications-Tabelle
```sql
CREATE TABLE notifications (
  id uuid PK, user_id uuid, type text,
  actor_id uuid, -- wer hat die Aktion ausgelöst
  reference_id uuid, reference_type text,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
```

### Infinite Scroll
- `published_at` Cursor statt OFFSET
- IntersectionObserver am letzten Element
- 10 Posts pro Batch

### Story-Leiste
- Query: Piloten mit Flügen der letzten 48h aus eigenen Gruppen
- Horizontaler ScrollArea-Container mit gradient Ring um Avatar

## Dateien (Phase 1)
- **Edit**: `src/components/FeedCard.tsx` — Double-tap, Like-Animation
- **Edit**: `src/components/FeedEventCard.tsx` — Like-Animation
- **Edit**: `src/components/FeedAchievementCard.tsx` — Like-Animation
- **Edit**: `src/pages/Feed.tsx` — Infinite Scroll, Story-Leiste
- **Neu**: `src/components/FeedStoryBar.tsx` — Heute-aktive-Piloten
- **Migration**: Keine für Phase 1

