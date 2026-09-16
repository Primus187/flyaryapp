# Flugschul-Paket: Ersatz für Flightbook und Telegram

Ziel: Die Flugschule verwaltet alle Personen, Termine (Höhenflüge, Grundkurs, Camps, Vorträge) und die Kommunikation in Flyary – ohne Flightbook und ohne Telegram.

## 1. Personen und Rollen

Heute kennt eine Gruppe nur "Admin" und "Mitglied". Neu bekommt jede Person in einer Schulgruppe:

- **Funktion**: Schüler, Brevetiert, Starthelfer, Fluglehrer, Schulleitung – mehrere gleichzeitig möglich (z. B. Brevetiert + Starthelfer).
- **Ausbildungsstand**: getrennt davon, z. B. Grundschulung / Höhenflug / Brevetreif / brevetiert.

Neue Ansicht "Personen" im Flugschul-Bereich: Liste mit Suche, Filter nach Funktion und Ausbildungsstand, Zählerkacheln (Schüler, Brevetierte, Starthelfer, Fluglehrer). Schulleitung kann Funktionen und Ausbildungsstand setzen. CSV-Export der Liste.

## 2. Termine statt Kurse

Keine eigenen "Kurse" – die bestehenden Flugtage werden zu flexiblen Terminen:

- **Termin-Typ**: Höhenflug, Grundkurstag, Schulevent (Vortrag, Theorie), Experienced-Event, mehrtägiger Event (Camp'Air, Flugreise). Der Typ steuert Darstellung und Einteilungs-Optionen.
- **Mehrtägige Termine**: Start- und Enddatum; im Detail ein Tagesprogramm (Einträge mit Datum, Uhrzeit, Titel, Ort, z. B. pro Camptag Theorie/Fliegen/Gemeinsames).
- **Terminserien**: optional einen Termin als Serie anlegen (z. B. Grundkurs mit 6 Tagen) – erzeugt mehrere verknüpfte Einzeltermine in einem Schritt.
- **Fortschritt**: bleibt über das vorhandene Kontrollblatt und die Ausbildungsstands-Anzeige sichtbar – gefiltert auf die Teilnehmenden eines Termins oder der ganzen Schule.

## 3. Höhenflug-Planung (gilt für alle Flug-Termine)

- **Plätze und Warteliste**: Teilnehmerlimit; Anmeldungen nach dem Limit landen auf der Warteliste und rücken automatisch nach, wenn jemand absagt.
- **Anmeldeschluss und Bestätigung**: Frist, danach keine Anmeldung mehr; die Schule bestätigt oder sagt ab, Betroffene erhalten Push.
- **Einteilung**: pro Termin Fluglehrer und Starthelfer zuweisen (mit Position wie Start, Landeplatz, Funk), sichtbar für alle Teilnehmenden.
- **Transport**: Fahrgemeinschaften – wer fährt, freie Plätze, wer fährt mit, Abfahrtsort und -zeit.

## 4. Kommunikation statt Telegram

- **Gruppenchat** pro Schulgruppe, dauerhaft (zusätzlich zum bestehenden Chat pro Termin).
- **Foto- und Dateianhänge** im Chat.
- **Ankündigungen**: nur Fluglehrer und Schulleitung können posten, alle erhalten Push; im Chat oben angepinnt.
- Ungelesen-Zähler, Erwähnungen mit @, Push bei neuen Nachrichten.

## Umsetzungsreihenfolge

1. Rollen und Ausbildungsstand + Personen-Übersicht
2. Termin-Typen, mehrtägige Termine und Serien, Tagesprogramm
3. Höhenflug-Planung (Plätze, Warteliste, Anmeldeschluss, Einteilung, Fahrgemeinschaften)
4. Gruppenchat mit Anhängen und Ankündigungen

Nach jedem Schritt ist die Funktion nutzbar und kann von der Schule getestet werden.

## Technische Details

**Datenbank (neue Tabellen, jeweils mit GRANTs und RLS):**
- `group_member_functions` (group_id, user_id, function enum: student, licensed, launch_helper, instructor, school_lead) – Mehrfachrollen; Schreibrecht nur Gruppen-Admin.
- `flight_events` erweitern: `event_category` (height_flight, basic_course, school_event, experienced, multi_day), `end_date` (nullable = eintägig), optional `series_id` für verknüpfte Serientermine.
- `event_program_items` (event_id, date, time, title, location, sort_order) – Tagesprogramm.
- `event_staff` (event_id, user_id, role: instructor/launch_helper, position text).
- `event_carpools` (event_id, driver_user_id, seats, departure_place, departure_time) + `event_carpool_riders`.
- `event_signups` erweitern: `status` (confirmed/waitlist/declined/cancelled), `waitlist_position`, `confirmed_by_school`.
- `group_messages` (group_id, user_id, message, attachment_path, is_announcement) mit Realtime; Storage-Bucket `chat-attachments` (privat, RLS über Gruppenmitgliedschaft).
- `profiles.training_level` bleibt Ausbildungsstand; Werteliste vereinheitlichen.

**Logik:** Warteliste-Nachrücken per Trigger auf `event_signups`; Anmeldeschluss serverseitig geprüft; Serien-Anlage erzeugt mehrere Termin-Zeilen clientseitig; Pushes über bestehende `send_push_notification`-Funktion; Ankündigungs-Schreibrecht per Security-Definer-Funktion `has_group_function(user, group, function)`.

**UI:** Flugschul-Dashboard erhält Tabs Personen / Termine / Chat; Termin-Formular bekommt Typ-Auswahl, Enddatum und Serien-Option; Termin-Detail erhält Abschnitte Programm, Einteilung, Warteliste, Fahrgemeinschaften. Alles dreisprachig (de/en/fr).
