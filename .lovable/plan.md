

# Verbesserungsplan: Performance, Emoji-Reactions, Jahresvergleich

## 1. Performance — Schnelleres Laden

### Problem
- **Dashboard** lädt ALLE Flüge des Users (`select *`), nur um `COUNT`, `SUM(duration_minutes)` und `COUNT(DISTINCT takeoff_location_id)` zu berechnen. Bei 200+ Flügen ist das viel zu viel Datenverkehr.
- **Feed** macht eine Kaskade von sequentiellen API-Calls: erst Gruppen, dann Members, dann Flights+Events+Achievements, dann Photos, dann Profiles, dann Signed URLs, dann Bookmarks. Insgesamt ~10+ Roundtrips.
- **Feed** lädt `track_data` (JSON mit bis zu 2000 Punkten) für jeden Flug im Feed — nur um eine kleine Mini-Karte zu zeigen. Das sind potenziell Megabytes an Daten.
- **Kein Caching** zwischen Seitenwechseln — jedes Mal wenn man vom Feed zum Dashboard und zurück navigiert, werden alle Daten neu geladen.

### Lösung

**A) Serverseitige Stats-Aggregation (DB-Funktion)**
- Neue DB-Funktion `get_pilot_stats(user_id)` die `COUNT`, `SUM`, `COUNT(DISTINCT)` direkt in SQL berechnet und als eine Zeile zurückgibt
- Dashboard ruft nur noch diese Funktion + `flights.limit(5)` für die letzten Flüge auf

**B) Feed: Track-Daten nicht im Feed laden**
- `igc_tracks.track_data` aus dem Feed-Query entfernen
- Stattdessen nur `igc_tracks.flight_id` laden (ob ein Track existiert)
- Mini-Karte im FeedCard erst laden wenn sichtbar (Intersection Observer + lazy fetch)

**C) React Query Caching aktivieren**
- `QueryClient` ist bereits eingebunden aber wird nicht genutzt
- Dashboard-Daten und Feed in `useQuery` wrappen mit `staleTime: 5min`
- Seitenwechsel zeigt sofort gecachte Daten, Refetch im Hintergrund

**D) Feed: Parallele statt sequentielle Queries**
- Gruppen-IDs, Members und Gruppen-Namen in einem einzigen Query laden
- Photos + Profiles + Likes + Comments bereits parallel (ist teilweise schon so), aber die Signed-URL-Generierung blockiert — in einen eigenen Step auslagern

### Dateien
- Neue Migration: `get_pilot_stats` DB-Funktion
- `src/hooks/use-dashboard-data.ts`: React Query + neue Stats-Funktion nutzen
- `src/pages/Feed.tsx`: Track-Daten entfernen, React Query
- `src/components/FeedCard.tsx`: Lazy Track Loading

---

## 2. Feed: Emoji-Reactions statt nur Like

### Aktuell
`feed_likes` Tabelle mit nur `user_id` + `flight_id/event_id/achievement_id`. Kein Emoji-Typ.

### Lösung

**A) Migration**
- `feed_likes` um Spalte `reaction_type TEXT NOT NULL DEFAULT 'heart'` erweitern
- Unique Constraint auf `(user_id, flight_id, reaction_type)` etc. damit ein User pro Typ nur einmal reagieren kann
- Bestehende Likes bekommen automatisch `'heart'` als Default

**B) Verfügbare Reactions**
6 Emojis: ❤️ `heart`, 🔥 `fire`, 👏 `clap`, 😍 `wow`, 💪 `strong`, 🪂 `paraglider`

**C) UI-Änderungen**
- Long-Press / Click auf Like-Button öffnet eine kleine Emoji-Leiste (ähnlich Instagram/Slack)
- Unter dem Post: Gruppierte Reaction-Badges mit Count (z.B. "❤️ 3  🔥 2")
- Quick-Tap setzt/entfernt Standard-Reaction (❤️)

**D) Dateien**
- Migration: `ALTER TABLE feed_likes ADD COLUMN reaction_type`
- `src/pages/Feed.tsx`: Reaction-Type in Like-Toggle übergeben
- `src/components/FeedCard.tsx` + `FeedEventCard.tsx` + `FeedAchievementCard.tsx`: Reaction-Leiste und gruppierte Anzeige
- Neuer Komponente: `src/components/ReactionPicker.tsx`

---

## 3. Flugbuch: Jahresvergleich & Fortschritt

### Lösung

**A) Neue Sektion auf der Stats-Seite**
- Jahresvergleich-Karte: Aktuelles Jahr vs. Vorjahr
- Metriken: Anzahl Flüge, Flugstunden, Höhenmeter, Distanz — jeweils als Balkendiagramm nebeneinander
- Monatlicher Fortschritt: Kumulative Linie (dieses Jahr vs. letztes Jahr), bereits als `CumulativeHoursChart` und `YearComparisonChart` Komponenten vorhanden

**B) Monatsfortschritts-Widget auf dem Dashboard**
- Kleine Karte "Dieses Jahr": Flüge, Stunden, mit Vergleich zum Vorjahr in Prozent (+12% etc.)
- Nutzt die neue `get_pilot_stats` Funktion mit Jahresfilter

**C) Dateien**
- `src/pages/Stats.tsx`: Jahresvergleich-Sektion erweitern
- `src/pages/Dashboard.tsx`: Fortschritts-Widget hinzufügen
- `src/hooks/use-dashboard-data.ts`: Vorjahres-Stats laden

---

## Zusammenfassung

| Bereich | Dateien | Aufwand |
|---------|---------|--------|
| Performance | 1 Migration, 4 Dateien | Mittel |
| Emoji-Reactions | 1 Migration, 5 Dateien | Mittel |
| Jahresvergleich | 2-3 Dateien | Klein |

Empfohlene Reihenfolge: **Performance zuerst** (grösster Impact), dann Emoji-Reactions, dann Jahresvergleich.

