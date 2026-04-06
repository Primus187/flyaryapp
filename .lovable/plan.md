

# Flug per Link teilen (öffentliche Detailseite)

## Übersicht
Eine neue öffentliche Route `/shared/flights/:id` zeigt eine reduzierte, read-only Flugdetailseite — ohne Navigation, ohne Login, ohne andere App-Funktionen. Der Empfänger sieht nur den einzelnen Flug. Ein Share-Button auf der normalen Flugdetailseite kopiert den Link in die Zwischenablage.

## Änderungen

### 1. Datenbank: Neues Feld `share_token` auf `flights`
- Migration: `ALTER TABLE flights ADD COLUMN share_token uuid DEFAULT gen_random_uuid();`
- Neuer Index auf `share_token` für schnelle Lookups
- RLS-Policy: `SELECT` für `anon`-Rolle wenn `share_token` übereinstimmt (öffentlich lesbar nur über Token)
- Gleiche Logik für `flight_photos`, `flight_videos`, `igc_tracks`, `locations` — ein `SELECT`-Policy für `anon` basierend auf dem Flight-Share-Token (via Security-Definer-Funktion)

### 2. Edge Function: `get-shared-flight`
- Nimmt `token` als Parameter
- Validiert Token, lädt Flug + Fotos + Track + Videos + Pilotname
- Erstellt signierte URLs für Fotos (da Storage-Buckets privat sind)
- Gibt alle Daten als JSON zurück
- Kein Auth erforderlich

### 3. Neue Seite: `src/pages/SharedFlightDetail.tsx`
- Reduzierte Version von `FlightDetail` — nur Anzeige, kein Edit/Delete/Publish
- Zeigt: Datum, Glider, Takeoff/Landing, Dauer, Höhe, Distanz, Kommentare, Fotos, Videos, Karte, Track
- Kein `AppLayout`, keine Navigation, kein BottomNav
- Branding/Logo oben, "Powered by FlyAry"-Footer mit Link zur App
- Lädt Daten über die Edge Function

### 4. Route in `App.tsx`
- Neue öffentliche Route: `<Route path="/shared/flights/:token" element={<SharedFlightDetail />} />`
- Ausserhalb von `ProtectedRoute`, kein Login nötig

### 5. Share-Button in `FlightDetail.tsx`
- Neuer Button (Share2-Icon) in der Toolbar
- Kopiert `https://flyaryapp.lovable.app/shared/flights/{share_token}` in die Zwischenablage
- Toast: "Link kopiert"
- Nutzt `navigator.share()` API falls verfügbar (native Share-Sheet auf Mobile → WhatsApp, etc.)

## Technische Details
- `share_token` als UUID statt der Flight-ID verhindert URL-Guessing
- Edge Function mit Service-Role-Key kann auf private Buckets zugreifen und signierte URLs generieren
- Keine Änderung an bestehenden RLS-Policies nötig — alles läuft über die Edge Function
- 5 Dateien: 1 Migration, 1 Edge Function, 1 neue Page, 2 bestehende Dateien (App.tsx, FlightDetail.tsx)

