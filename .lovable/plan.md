

# Challenge-Achievements im Feed & Instagram-Interaktionen für alle Posts

## Übersicht
Zwei Änderungen: (1) Challenges erscheinen nur noch als Achievement-Posts im Feed wenn ein Ziel oder die ganze Challenge geschafft wurde — mit Badge und Gamification-Design. (2) Alle Feed-Post-Typen (Flüge, Events, Challenges) bekommen einheitliche Instagram-Interaktionen (Likes + Kommentare).

---

## 1. Neues Datenmodell: Achievement-basierte Challenge-Posts

### Migration
Neue Tabelle `feed_achievements`:
- `id uuid PK`, `user_id uuid`, `challenge_id uuid`, `goal_id uuid NULL` (NULL = ganze Challenge geschafft)
- `achievement_type text` ("goal_reached" oder "challenge_completed")
- `created_at timestamptz DEFAULT now()`
- RLS: Gruppenmitglieder können lesen, User kann eigene erstellen

Erweitere `feed_likes` und `feed_comments`:
- `ADD COLUMN achievement_id uuid NULL` (neben bestehendem `flight_id`)
- `ADD COLUMN event_id uuid NULL`
- Bestehende Constraints anpassen: `flight_id` wird nullable
- Neue RLS-Policies für Likes/Comments auf Events und Achievements

### Automatische Achievement-Erstellung
In `FlightForm.tsx` bei der IGC-Verifikation: wenn ein Challenge-Goal erreicht wird, zusätzlich `feed_achievements`-Eintrag erstellen. Wenn alle Goals geschafft → zusätzlich "challenge_completed" Achievement.

---

## 2. Feed-Logik anpassen (`src/pages/Feed.tsx`)

- **Challenges entfernen** aus dem direkten Feed-Fetch (keine aktiven Challenges mehr anzeigen)
- **Achievements laden**: `feed_achievements` mit Challenge-Titel, Goal-Label, Pilot-Info
- Neuer FeedItem-Type: `"achievement"`
- Likes/Comments generisch machen: `handleLikeToggle` und `handleComment` erweitern für `achievement_id` und `event_id`

---

## 3. Achievement-Card (`src/components/FeedAchievementCard.tsx`)

Gamification-Design:
- Goldener/Amber Gradient-Header mit Glitter-Effekt (CSS animation)
- Grosses Trophy-Icon bei Challenge-Komplett, Target-Icon bei einzelnem Goal
- Pilot-Avatar + Name im Instagram-Header-Stil
- Badge: "🏆 Challenge geschafft!" oder "🎯 Ziel erreicht!"
- Challenge-Name + Goal-Label
- Fortschrittsbalken (X/Y Goals)
- Instagram-Interaktionen: Like-Heart, Kommentar-Icon, Kommentar-Liste, Kommentar-Input

---

## 4. Instagram-Interaktionen für Events (`src/components/FeedEventCard.tsx`)

- Like-Button (Heart) und Kommentar-Section hinzufügen (identisch zu FeedCard)
- Props erweitern: `onLikeToggle`, `onComment`, `likes`, `comments`
- Interface `FeedEvent` erweitern: `likes`, `comments` Arrays

---

## 5. Generische Like/Comment-Infrastruktur

Die bestehenden `feed_likes` und `feed_comments` Tabellen werden erweitert um polymorphe Referenzen (flight_id, event_id, achievement_id). Feed.tsx bekommt generische Handler die den richtigen ID-Typ setzen.

---

## 6. i18n-Keys
- `feed.goalReached`, `feed.challengeCompleted`, `feed.achievementBy`
- `feed.xOfYGoals`, `feed.congratulations`

## Dateien
- **Migration**: `feed_achievements` Tabelle + `feed_likes`/`feed_comments` erweitern
- **Neu**: `src/components/FeedAchievementCard.tsx`
- **Edit**: `src/pages/Feed.tsx` — Achievements statt Challenges, generische Interaktionen
- **Edit**: `src/components/FeedEventCard.tsx` — Likes + Comments hinzufügen
- **Edit**: `src/pages/FlightForm.tsx` — Achievement-Einträge bei IGC-Verifikation
- **Edit**: `src/i18n/locales/{de,en,fr}.json`

## Technische Details
- `feed_likes.flight_id` wird nullable, dafür kommt ein CHECK constraint: genau einer von `flight_id`, `event_id`, `achievement_id` muss gesetzt sein
- Bestehende Likes/Comments für Flüge bleiben kompatibel
- Achievement-Card nutzt CSS `@keyframes` für subtile Gold-Shimmer-Animation auf dem Badge

