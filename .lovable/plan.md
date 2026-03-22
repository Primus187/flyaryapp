

# Öffentliches Profil mit Badges & besserer Visualisierung

## Übersicht
Neue Seite `/pilot/:userId` als öffentliches Profil, sichtbar für Gruppenmitglieder. Zeigt Hero-Header mit Avatar, Pilotname, Bio, XP/Level, Top-Badges und Flugstatistiken. Der eigene User kann sein öffentliches Profil über die Profile-Seite vorab sehen.

## 1. Neue Seite: `src/pages/PilotProfile.tsx`

Öffentliches Profil mit Instagram-artigem Layout:
- **Hero-Header**: Grosser Avatar mit Gradient-Ring, Pilotname, Level-Badge, Bio
- **Stats-Leiste**: Flüge | Stunden | XP als kompakte Zahlen-Row (wie Instagram Follower/Posts)
- **Top-Badges-Sektion**: Die 6 besten (höchster Tier zuerst) freigeschalteten Badges als HexBadge-Grid
- **Klick auf "Alle Badges"** öffnet BadgeGrid vollständig
- **Glider-Info**: Aktiver Schirm
- **Flugschule / SHV-Nummer** falls vorhanden

Daten werden geladen aus: `profiles`, `pilot_xp`, `pilot_badges`, `flights` (aggregiert), `pilot_gliders`

## 2. Routing

**Edit: `src/App.tsx`**
- Neue Route: `/pilot/:userId` → `PilotProfile`

## 3. Verlinkung

**Edit: `src/pages/Leaderboard.tsx`**
- Klick auf Leaderboard-Eintrag navigiert zu `/pilot/${entry.user_id}`

**Edit: `src/components/FeedCard.tsx`**
- Klick auf Pilotname/Avatar im Feed navigiert zu `/pilot/${userId}`

## 4. Profil-Vorschau

**Edit: `src/pages/Profile.tsx`**
- Button "Öffentliches Profil ansehen" der zu `/pilot/${user.id}` navigiert

## 5. RLS

Bestehende Policies reichen: `profiles`, `pilot_badges`, `pilot_xp` haben bereits "Group members can view"-Policies. `pilot_gliders` braucht eine neue SELECT-Policy für Gruppenmitglieder.

## 6. Migration

- Neue RLS-Policy auf `pilot_gliders`: Gruppenmitglieder können Gliders sehen

## 7. i18n

Neue Keys: `pilotProfile.title`, `pilotProfile.flights`, `pilotProfile.hours`, `pilotProfile.topBadges`, `pilotProfile.viewPublicProfile`

## Dateien
- **Neu**: `src/pages/PilotProfile.tsx`
- **Migration**: RLS für `pilot_gliders` (Gruppenmitglieder lesen)
- **Edit**: `src/App.tsx` — Route
- **Edit**: `src/pages/Leaderboard.tsx` — Navigation zu Profil
- **Edit**: `src/components/FeedCard.tsx` — Navigation zu Profil
- **Edit**: `src/pages/Profile.tsx` — "Profil ansehen"-Button
- **Edit**: `src/i18n/locales/{de,en,fr}.json`

