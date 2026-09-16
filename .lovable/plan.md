# Flugschul-Paket: Ersatz für Flightbook und Telegram

Ziel: Die Flugschule verwaltet alle Personen, Kurse, Höhenflüge und die Kommunikation in Flyary – ohne Flightbook und ohne Telegram.

## 1. Personen und Rollen

Heute kennt eine Gruppe nur "Admin" und "Mitglied". Neu bekommt jede Person in einer Schulgruppe:

- **Funktion**: Schüler, Brevetiert, Starthelfer, Fluglehrer, Schulleitung – mehrere gleichzeitig möglich (z. B. Brevetiert + Starthelfer).
- **Ausbildungsstand**: getrennt davon, z. B. Grundschulung / Höhenflug / Brevetreif / brevetiert, plus Brevet-Nummer und Prüfungsdaten (bereits im Profil vorhanden).

Neue Ansicht "Personen" im Flugschul-Bereich: Liste mit Suche, Filter nach Funktion und Ausbildungsstand, Zählerkacheln (Schüler, Brevetierte, Starthelfer, Fluglehrer). Schulleitung kann Funktionen und Ausbildungsstand setzen. CSV-Export der Liste.

## 2. Kurse

Neuer Bereich "Kurse" innerhalb einer Schulgruppe:

- Kurs anlegen: Name, Zeitraum, Beschreibung, Status (geplant / laufend / abgeschlossen).
- Teilnehmerliste: Schüler zuteilen, Fluglehrer als Kursleitung zuteilen.
- Kursprogramm: mehrere Termine pro Kurs (Theorie, Übungshang, Höhenflug), verknüpft mit den bestehenden Flugtagen.
- Fortschritt: pro Teilnehmer Ausbildungsstand, Anzahl Flüge und Kontrollblatt-Fortschritt direkt im Kurs sichtbar.

## 3. Höhenflug-Planung

Erweiterung der bestehenden Flugtage:

- **Plätze und Warteliste**: Teilnehmerlimit; wer sich nach dem Limit anmeldet, landet auf der Warteliste und rückt automatisch nach, wenn jemand absagt.
- **Anmeldeschluss und Bestätigung**: Frist, nach der keine Anmeldung mehr möglich ist; die Schule bestätigt oder sagt ab, betroffene Personen erhalten eine Push-Meldung.
- **Einteilung**: pro Flugtag Fluglehrer und Starthelfer zuweisen (mit Rolle wie Start, Landeplatz, Funk), sichtbar für alle Teilnehmenden.
- **Transport**: Fahrgemeinschaften – wer fährt, wie viele Plätze frei, wer fährt mit, Abfahrtsort und -zeit.

## 4. Kommunikation statt Telegram

- **Gruppenchat** pro Schulgruppe und pro Kurs, dauerhaft (zusätzlich zum bestehenden Chat pro Flugtag).
- **Foto- und Dateianhänge** im Chat.
- **Ankündigungen**: nur Fluglehrer und Schulleitung können posten, alle erhalten Push; oben angepinnt sichtbar.
- Ungelesen-Zähler, Erwähnungen mit @, Push-Benachrichtigung bei neuen Nachrichten.

## Umsetzungsreihenfolge

1. Rollen und Ausbildungsstand + Personen-Übersicht
2. Höhenflug-Planung (Plätze, Warteliste, Einteilung, Fahrgemeinschaften)
3. Gruppen- und Kurschat mit Anhängen und Ankündigungen
4. Kurse mit Programm und Fortschritt

Nach jedem Schritt ist die Funktion nutzbar und kann von der Schule getestet werden.

## Technische Details

**Datenbank (neue Tabellen, jeweils mit GRANTs und RLS):**
- `group_member_functions` (group_id, user_id, function enum: student, licensed, launch_helper, instructor, school_lead) – Mehrfachrollen; Schreibrecht nur Gruppen-Admin.
- `courses`, `course_participants` (role: student/instructor), `course_sessions` (optional verknüpft mit `flight_events.id`).
- `event_staff` (event_id, user_id, role: instructor/launch_helper, position text).
- `event_carpools` (event_id, driver_user_id, seats, departure_place, departure_time) + `event_carpool_riders`.
- `group_messages` (group_id, optional course_id, user_id, message, attachment_path, is_announcement) mit Realtime; Storage-Bucket `chat-attachments` (privat, RLS über Gruppenmitgliedschaft).
- `event_signups` erweitern: `status` (confirmed/waitlist/declined/cancelled), `waitlist_position`, `confirmed_by_school`.
- `profiles.training_level` bleibt Ausbildungsstand; Werteliste vereinheitlichen.

**Logik:** Warteliste-Nachrücken per Trigger auf `event_signups`; Anmeldeschluss serverseitig geprüft; Pushes über bestehende `send_push_notification`-Funktion; Ankündigungs-Schreibrecht per Security-Definer-Funktion `has_group_function(user, group, function)`.

**UI:** Flugschul-Dashboard erhält Tabs Personen / Kurse / Flugtage; Flugtag-Detail erhält Abschnitte Einteilung, Warteliste, Fahrgemeinschaften; Gruppen-Detail erhält Chat-Tab. Alles dreisprachig (de/en/fr).
