

# Flyary Social & Gamification Update

Das ist ein grosses Update mit mehreren neuen Systemen. Ich empfehle eine schrittweise Umsetzung in 4 Phasen.

## Phase 1: Design-Refresh (Dark-First, Instagram-Stil)

### Visuelles Fundament
- Dark Mode als Standard setzen (tiefes Schwarz statt Dunkelblau)
- CSS-Variablen anpassen: `--background: 0 0% 4%`, Karten dunkler, Kontraste schärfer
- Karten mit grossen Bild-Headern (Flugfotos) im Instagram-Card-Stil
- Bottom-Nav Icons minimalistischer: nur Icon + Dot-Indicator statt Text (à la Instagram)
- Profilbilder rund mit farbigem Ring (wie Instagram Stories)

### Dateien
- **Edit**: `src/index.css` — Dark-Theme-Variablen anpassen
- **Edit**: `src/components/BottomNav.tsx` — Icon-only Navigation mit Active-Dot
- **Edit**: `src/pages/Dashboard.tsx` — Flug-Karten mit Foto-Header
- **Edit**: `src/pages/Profile.tsx` — Rundes Profilbild prominenter

## Phase 2: Social Feed

### Neue Tabelle & Datenmodell
- `feed_likes` Tabelle: `id, flight_id, user_id, created_at`
- `feed_comments` Tabelle: `id, flight_id, user_id, message, created_at`
- Flüge innerhalb derselben Gruppe werden im Feed sichtbar (neue RLS-Policy auf `flights`: Gruppenmitglieder können Flüge sehen)
- Neue SELECT-Policy auf `flight_photos` für Gruppenmitglieder

### Feed-Seite
- Neue Seite `/feed` (ersetzt oder ergänzt Dashboard)
- Zeigt Flüge von Gruppenmitgliedern chronologisch
- Jeder Eintrag: Avatar + Pilotname, Foto(s) als Swipe-Galerie, Fluginformationen, Like-Button (Herz), Kommentare
- Pull-to-Refresh für neue Einträge

### Dateien
- **Migration**: `feed_likes`, `feed_comments` Tabellen + RLS
- **Migration**: Neue RLS-Policy auf `flights` und `flight_photos` für Gruppenmitglieder
- **Neu**: `src/pages/Feed.tsx` — Social Feed
- **Neu**: `src/components/FeedCard.tsx` — Einzelner Feed-Eintrag
- **Edit**: `src/App.tsx` — Route hinzufügen
- **Edit**: `src/components/BottomNav.tsx` — Feed-Tab (Home-Icon)

## Phase 3: Leaderboard & XP-System

### Datenmodell
- `pilot_xp` Tabelle: `id, user_id, total_xp, level, updated_at`
- XP-Berechnung via DB-Trigger nach Flight-Insert: Airtime-Minuten × 2 + Höhenmeter × 0.5 + Distanz × 10
- Level-Stufen (z.B. 0-500 = Lv.1, 500-1500 = Lv.2, etc.)

### UI
- XP-Anzeige im Profil mit Progress-Bar zum nächsten Level
- Leaderboard-Seite unter "Mehr": Rangliste pro Gruppe und Saison
- Badges: Level-Icons (Bronze → Silber → Gold → Diamant)

### Dateien
- **Migration**: `pilot_xp` Tabelle + Trigger-Funktion für XP-Berechnung
- **Neu**: `src/pages/Leaderboard.tsx`
- **Edit**: `src/pages/Profile.tsx` — XP-Bar + Level
- **Edit**: `src/pages/More.tsx` — Leaderboard-Link

## Phase 4: Challenges

### Datenmodell
- `challenges` Tabelle: `id, group_id, title, description, type, start_date, end_date, created_by`
- `challenge_goals` Tabelle: `id, challenge_id, location_id, points`
- `challenge_progress` Tabelle: `id, challenge_id, user_id, goal_id, flight_id, completed_at`

### UI
- Challenge-Übersicht pro Gruppe (im Gruppen-Detail)
- Challenge-Detail: Karte mit Wegpunkten, Fortschrittsbalken, Teilnehmer-Ranking
- Badges/Trophies als SVG-Icons für abgeschlossene Challenges

### Dateien
- **Migration**: 3 neue Tabellen + RLS
- **Neu**: `src/pages/ChallengeDetail.tsx`
- **Neu**: `src/components/ChallengeCard.tsx`
- **Edit**: `src/pages/GroupDetail.tsx` — Challenges-Tab

## Empfohlene Reihenfolge

Da jede Phase für sich funktioniert, schlage ich vor, mit **Phase 1 (Design-Refresh)** zu starten — das gibt der App sofort ein frischeres Gefühl. Danach **Phase 2 (Social Feed)**, da es den grössten Mehrwert für die Community bringt.

Soll ich mit Phase 1 beginnen, oder möchtest du eine andere Reihenfolge?

