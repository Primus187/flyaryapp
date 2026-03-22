

# XContest Login-basierter Import mit IGC-Download

## Übersicht
User gibt seine XContest-Zugangsdaten (E-Mail + Passwort) im Profil ein. Eine Edge Function loggt sich bei XContest ein, liest die Flugliste, lädt IGC-Dateien herunter und erstellt automatisch Flugeinträge in Flyary.

## Sicherheitshinweis
Die XContest-Credentials werden verschlüsselt in der DB gespeichert. Die Edge Function greift serverseitig auf XContest zu — die Zugangsdaten verlassen nie den Browser direkt.

## 1. Datenbank-Migration

- `profiles` erweitern: `xcontest_username text`, `xcontest_password_encrypted text`
- Neue Tabelle `xcontest_imports`:
  - `id uuid PK`, `user_id uuid`, `xcontest_flight_url text UNIQUE`, `flight_id uuid`, `imported_at timestamptz`
  - RLS: User sieht nur eigene Einträge

## 2. Edge Function: `sync-xcontest`

Ablauf:
1. User-ID aus JWT holen, XContest-Credentials aus `profiles` laden
2. HTTP-Login bei XContest (POST mit Cookie-Session)
3. Flugliste des Users scrapen (`/world/en/flights/?filter[pilot]=USERNAME`)
4. Für jeden neuen Flug (nicht in `xcontest_imports`):
   - Flug-Detailseite laden, IGC-Download-Link finden
   - IGC herunterladen, parsen (Datum, Dauer, Höhe, Koordinaten)
   - `flights`-Eintrag erstellen
   - IGC in Storage (`igc-files`) hochladen
   - `igc_tracks`-Eintrag erstellen
   - `xcontest_imports`-Eintrag erstellen
5. Antwort: Anzahl importierter Flüge

Technische Details:
- Login via `fetch("https://www.xcontest.org/world/en/", { method: "POST", body: formData })` mit Cookie-Handling
- IGC-Download-URL-Pattern: typisch `/download-igc/` Link auf der Flug-Detailseite
- Rate Limiting: max 2 Requests/Sekunde, max 50 Flüge pro Sync

## 3. Profil-UI erweitern

- Neuer Abschnitt "XContest" im Profil mit:
  - Username-Feld
  - Passwort-Feld (verschlüsselt gespeichert)
  - "Jetzt synchronisieren"-Button
  - Letzter Sync-Status + Anzahl importierter Flüge
- Warnung: "Deine XContest-Zugangsdaten werden verschlüsselt gespeichert und nur für den Sync verwendet."

## 4. i18n
Neue Keys in de/en/fr für XContest-Sync UI.

## Einschränkungen
- XContest kann HTML-Struktur jederzeit ändern → Scraping kann brechen
- Rate Limiting beachten, um nicht geblockt zu werden
- Nur eigene, öffentlich gelistete Flüge werden gefunden

## Dateien
- **Migration**: `profiles` erweitern + `xcontest_imports` Tabelle + RLS
- **Neu**: `supabase/functions/sync-xcontest/index.ts`
- **Edit**: `src/pages/Profile.tsx` — XContest-Felder + Sync-Button
- **Edit**: `src/i18n/locales/{de,en,fr}.json`

