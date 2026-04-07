

# Plan: Push-Notifications, PDF-Export, Persönliche Ziele, Follower-System

## Übersicht
Vier Features in einem Durchgang. Priorisiert nach Abhängigkeiten.

---

## 1. Push-Benachrichtigungen (Web Push API)

### Ansatz
- Service Worker ist bereits vorhanden (PWA mit vite-plugin-pwa)
- Neue DB-Tabelle `push_subscriptions` speichert Web Push Subscriptions pro User
- Neue Edge Function `send-push` wird von DB-Triggern bei Like/Comment aufgerufen
- VAPID-Keys werden als Secrets gespeichert (ein Public Key + ein Private Key)

### Änderungen
- **Migration**: `push_subscriptions` Tabelle (user_id, endpoint, keys_p256dh, keys_auth, created_at) + RLS
- **Edge Function**: `send-push/index.ts` — empfängt Notification-Daten, liest Subscriptions, sendet via Web Push Protocol
- **DB-Trigger**: `notify_on_like` und `notify_on_comment` erweitern → rufen `send-push` via `pg_net` auf
- **Frontend**: Neuer Hook `use-push-notifications.ts` — fragt Permission, registriert Subscription
- **Settings-Seite**: Toggle für Push-Benachrichtigungen
- **Secrets**: `VAPID_PUBLIC_KEY` und `VAPID_PRIVATE_KEY` (werden einmalig generiert)

### Ablauf
```text
User A liked → DB Trigger → pg_net HTTP POST → send-push Edge Function
  → Web Push API → User B's Browser → Notification
```

---

## 2. PDF-Export Verbesserung

### Aktueller Stand
- Edge Function `export-flightbook-pdf` existiert bereits mit jsPDF
- Generiert Cover, Startplätze, Landeplätze, Flugliste, SHV-Solo-Bestätigung

### Verbesserungen
- **Statistik-Seite im PDF**: Zusammenfassung mit Jahresvergleich (Flüge, Stunden, Höhe, Distanz pro Jahr)
- **Glider-Info**: Schirmübersicht mit Check-Daten aus `pilot_gliders`
- **Besseres Layout**: Alternating row colors für bessere Lesbarkeit
- **Flugschul-Logo**: Platz für Flugschul-Name und Logo auf der Titelseite

### Änderungen
- **`supabase/functions/export-flightbook-pdf/index.ts`**: Stats-Seite, Glider-Tabelle, zebra-striping

---

## 3. Persönliche Saisonziele

### Konzept
Piloten setzen sich Ziele für die Saison (z.B. "50 Flüge", "100h Flugzeit", "Erster 50km XC"). Dashboard zeigt Fortschrittsbalken.

### Änderungen
- **Migration**: Neue Tabelle `pilot_goals` (id, user_id, title, goal_type, target_value, current_value, unit, season_year, created_at) + RLS
- `goal_type`: `flights`, `hours`, `altitude`, `distance`, `custom`
- `target_value`: Zielwert (z.B. 50)
- Fortschritt wird live aus Flugdaten berechnet (nicht gespeichert)

- **Neue Komponente**: `src/components/GoalCard.tsx` — Fortschrittsbalken mit Prozent und verbleibendem Wert
- **Dashboard**: Neue Sektion "Meine Ziele" mit GoalCards
- **Profile/Settings**: UI zum Erstellen/Bearbeiten/Löschen von Zielen
- **Berechnung**: Hook `use-pilot-goals.ts` — lädt Ziele, berechnet Fortschritt aus `get_pilot_stats` RPC

### Vordefinierte Ziel-Templates
- Anzahl Flüge (flights)
- Flugstunden (hours)
- Höhenmeter (altitude)  
- Streckenkilometer (distance)
- Freies Ziel (custom, manuell trackbar)

---

## 4. Follower-System

### Konzept
Piloten können anderen Piloten folgen. Deren Flüge erscheinen im Feed — auch ohne gemeinsame Gruppe.

### Änderungen
- **Migration**: Neue Tabelle `follows` (id, follower_id, following_id, created_at) + Unique Constraint + RLS
- **RLS-Erweiterung**: `flights` SELECT-Policy erweitern um "Follower können publizierte Flüge sehen"
- Analog für `feed_likes`, `feed_comments`, `flight_photos` — Follower dürfen sehen/interagieren

- **Feed.tsx**: Query erweitern — neben Gruppen-Flügen auch Flüge von gefolgten Piloten laden
- **PilotProfile.tsx**: "Folgen" / "Entfolgen" Button
- **Neue Seite/Komponente**: Follower/Following-Liste auf dem Profil
- **Search.tsx**: Beim Piloten-Tab "Folgen"-Button direkt in den Suchergebnissen
- **NotificationBell**: Notification wenn jemand dir folgt (neuer Trigger `notify_on_follow`)

### Sicherheit
- Nur publizierte Flüge (`published_to_feed = true`) sind für Follower sichtbar
- Private Flüge und Gruppen-interne Daten bleiben geschützt
- Jeder kann jedem folgen (kein Approval nötig)

---

## Zusammenfassung

| Feature | Migration | Edge Functions | Frontend-Dateien |
|---------|-----------|----------------|------------------|
| Push Notifications | 1 Tabelle + Trigger | 1 neue | 2-3 |
| PDF Export | — | 1 bestehende | — |
| Saisonziele | 1 Tabelle | — | 3-4 |
| Follower | 1 Tabelle + RLS | — | 4-5 |

Insgesamt: 3 Migrationen, 1 neue Edge Function, ~12 Frontend-Dateien.

