

# Flyary Verbesserungsplan — basierend auf App-Analyse

## Bewertung der Kritikpunkte

Die Analyse ist fundiert. Ich priorisiere nach Machbarkeit in Lovable (kein persistenter Backend-Server, kein Live-Tracking möglich) und Nutzerimpact.

---

## Phase 1 — Schnelle Wins (sofort umsetzbar)

### 1.1 Globale Suchfunktion
- Neue Seite `/search` mit Suchfeld, das Flüge (Datum, Startplatz, Schirm, Kommentare), Standorte, Events und Piloten durchsucht
- Erreichbar über Such-Icon in der BottomNav oder More-Seite
- Client-seitige Suche über bereits geladene Daten + Supabase-Textsuche

### 1.2 Erweiterte Statistiken
- **Fortschrittskurve**: Kumulative Flugstunden über Zeit (LineChart)
- **Jahresvergleich**: Overlay aktuelle vs. Vorjahres-Kurve
- **Heatmap der Flugtage**: Kalender-Heatmap (ähnlich GitHub Contributions)
- **Höhenmeter-Trend**: Durchschnittliche Höhenmeter pro Monat
- **Top-5 Startplätze**: Horizontales Balkendiagramm
- Recharts ist bereits installiert — alle Chart-Typen sind verfügbar

### 1.3 Schirm-Wartungstracking
- Neue Felder auf `pilot_gliders`: `last_check_date`, `next_check_date`, `reserve_repack_date`, `total_flight_hours`
- Automatische Berechnung der Flugstunden pro Schirm basierend auf Flügen mit diesem Glider-Namen
- Warnhinweis auf Dashboard wenn Check überfällig
- Neue Karte auf der Profil-Seite: "Ausrüstungs-Status"

### 1.4 DSGVO — Gesundheitsdaten-Zustimmung
- Beim ersten Ausfüllen von Notfalldaten: explizites Consent-Modal mit Hinweis auf Art. 9 DSGVO / revDSG
- Consent-Zeitstempel in `profiles` speichern (`health_data_consent_at`)
- Notfalldaten nur anzeigen wenn Consent erteilt
- Hinweistext auf der Profil-Seite

---

## Phase 2 — Mittlere Features

### 2.1 Wetter-Integration (Windy Embed)
- Auf der Standort-Detailseite: Windy-Embed-Widget mit den GPS-Koordinaten des Startplatzes
- Windy bietet ein kostenloses Embed-Widget (kein API-Key nötig): `https://embed.windy.com/embed2.html?lat=X&lon=Y`
- Zusätzlich: Link zu MeteoSchweiz für Schweizer Standorte basierend auf country_code
- Auf Event-Detailseite: Wetter-Widget wenn ein Meeting-Point mit Koordinaten verknüpft ist

### 2.2 Coach/Fluglehrer-Feedback-Modus
- Neue Spalte `flight_training_items`: `instructor_rating` (1-5), `instructor_note`
- Gruppenadmins (Fluglehrer) können bei Flügen ihrer Gruppenmitglieder Bewertungen zu Trainingsmanövern hinzufügen
- Schüler sieht Fluglehrer-Feedback auf seiner Flugdetailseite
- RLS: Gruppenadmin kann UPDATE auf `flight_training_items` wo der Flug-Owner in seiner Gruppe ist

### 2.3 Flug-Templates
- Neue Tabelle `flight_templates` (user_id, name, takeoff_location_id, landing_location_id, glider, group_id)
- Button "Als Template speichern" auf FlightForm
- Dropdown "Aus Template laden" beim Erstellen eines neuen Fluges
- Ersetzt die einfache Duplizierfunktion

---

## Phase 3 — Fortgeschritten

### 3.1 Offline-Erfassung (verbessertes PWA)
- IndexedDB-Queue für Flugerfassung wenn offline
- Service Worker fängt fehlgeschlagene Supabase-Requests ab und speichert sie
- Bei Wiederverbindung: automatischer Sync mit Konfliktprüfung
- Status-Indikator in der UI: "Offline — Daten werden gespeichert"
- Technisch: `idb-keyval` oder `localForage` + Background Sync API

### 3.2 Story-Leiste verbessern
- Fallback wenn keine Aktivität in 48h: "Letzte Woche aktiv" anzeigen (Zeitfenster auf 7 Tage erweitern)
- Bei weniger als 3 Piloten: Leiste ausblenden statt leere Bubbles

---

## Bewusst NICHT umgesetzt

| Punkt | Begründung |
|-------|-----------|
| Live-Tracking/Notfallalarm | Benötigt persistenten Backend-Server + Push-Service — nicht in Lovable machbar |
| Flugrouten-Planung | Komplex, XCTrack/Ayvri sind spezialisiert — kein sinnvoller MVP |
| iOS Capacitor Build | Nur Konfigurationsarbeit, kein Code-Change nötig — User kann dies selbst tun |
| DB-Schema-Refactoring | Polymorphe reactions-Tabelle würde alle bestehenden RLS-Policies brechen — Risiko zu hoch |
| XContest Duplikat-Problem | Bereits via URL-Hash gelöst, edge case für manuelle Flüge ist akzeptabel |
| Wetterabhängige Event-Stornierung | Wetter-APIs erfordern kostenpflichtige Subscriptions + Backend-Cronjob |

---

## Umsetzungsreihenfolge

1. **DSGVO Gesundheitsdaten-Consent** (Migration + UI)
2. **Globale Suchfunktion** (neue Seite)
3. **Erweiterte Statistiken** (Stats.tsx erweitern)
4. **Schirm-Wartungstracking** (Migration + Profile.tsx)
5. **Wetter-Widget** (LocationDetail + EventDetail)
6. **Coach-Modus** (Migration + RLS + UI)
7. **Flug-Templates** (Migration + FlightForm)
8. **Story-Leiste Fix** (FeedStoryBar.tsx)
9. **Offline-Queue** (PWA-Erweiterung)

## Dateien
- **Neu**: `src/pages/Search.tsx`
- **Migration**: `pilot_gliders` (Wartungsfelder), `profiles` (consent), `flight_training_items` (instructor fields), `flight_templates` (neue Tabelle)
- **Edit**: `src/pages/Stats.tsx` — erweiterte Charts
- **Edit**: `src/pages/Profile.tsx` — Wartungskarten, DSGVO-Consent
- **Edit**: `src/pages/LocationDetail.tsx` — Windy Embed
- **Edit**: `src/pages/EventDetail.tsx` — Wetter-Widget
- **Edit**: `src/components/FeedStoryBar.tsx` — Fallback-Logik
- **Edit**: `src/pages/FlightForm.tsx` — Template-Funktionalität
- **Edit**: `src/pages/More.tsx` — Such-Tile
- **Edit**: `src/App.tsx` — Route `/search`
- **Edit**: `src/i18n/locales/{de,en,fr}.json`

