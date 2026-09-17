# Bereit für den Testlauf mit Vertical

Stand heute in der Datenbank für die Gruppe „Vertical": 7 Mitglieder, 10 Termine, 16 Anmeldungen — aber nur **eine** vergebene Funktion (und zwar „Brevetiert"), **keine** Ansätze, **kein** Material und **keine** aktive Push-Anmeldung im ganzen System. Das sind genau die Punkte, die einen ersten echten Testlauf ausbremsen.

## Was vor dem Testlauf fehlt

1. **Funktionen sind nicht verteilt.** Da niemand als Schulleitung, Fluglehrer oder Starthelfer eingetragen ist, ist der Reiter „Team" leer und der Flugschul-Bereich ist für das Team gar nicht sichtbar. Wir brauchen eine Einrichtungshilfe, die das in wenigen Klicks erledigt: Mitgliederliste mit direkter Zuweisung der Funktionen, mehrere Personen hintereinander, ohne Umweg über einzelne Dialoge.

2. **Einladen der Kursteilnehmer ist zu umständlich.** Für den Testlauf muss die Schule 10–20 Leute schnell hereinholen: Einladungslink und QR-Code direkt im Flugschul-Bereich, zum Teilen per Telegram/WhatsApp, mit kurzer Anleitung „App installieren → Konto anlegen → Gruppe beitreten".

3. **Push ist ungeprüft.** Es existiert bisher keine einzige Push-Anmeldung. Ohne Push wirkt die Höhenflug-Ankündigung wie ein Rückschritt gegenüber Telegram. Wir brauchen eine sichtbare Aufforderung „Mitteilungen aktivieren" (Startseite und Terminansicht), eine Testnachricht an sich selbst, und beim Senden eine ehrliche Anzeige, wie viele Empfänger Mitteilungen tatsächlich erhalten.

4. **Ansätze und Material sind leer.** Abrechnung und Startleiter-Guthaben rechnen mit Ansätzen, die es noch nicht gibt. Beim ersten Öffnen sollen Vorschlagswerte angeboten werden (Fahrtkosten pro km, Miete pro Tag/Woche, Guthaben pro Tag), die die Schule nur bestätigt oder anpasst. Beim Material dasselbe: Schnellerfassung mehrerer gleichartiger Stücke statt Einzeleingabe.

5. **Es gibt keine Einrichtungs-Übersicht.** Eine Karte „Flugschule einrichten" auf der Flugschul-Startseite zeigt die offenen Punkte (Funktionen verteilt, Ansätze gesetzt, Material erfasst, Mitteilungen aktiv, erster Termin erstellt) und führt jeweils direkt hin. Ist alles erledigt, verschwindet sie.

6. **Rückmeldungen einsammeln.** Ein kleiner Punkt „Feedback" im Menü, der eine Nachricht mit App-Version und Seite an dich schickt — sonst versickern die Beobachtungen des Testlaufs im Gruppenchat.

7. **Ausbildungsstand aufräumen.** Die vorhandenen Einträge sind deutsche Freitexte („Grundkurs", „Brevetkurs", „SiKu") und passen nicht zu den Auswahlwerten. Vor dem Testlauf einmalig auf die Auswahlwerte vereinheitlichen, damit Filter und Statistiken stimmen.

## Reihenfolge

Zuerst 1, 2 und 5 (ohne die drei kann Vertical nicht starten), dann 3, danach 4, zuletzt 6 und 7.

## Technische Hinweise

- Einrichtungs-Übersicht als neue Komponente `src/components/school/SchoolSetupCard.tsx`, eingebunden in `SchoolOverview.tsx`; Prüfungen per Count-Abfragen auf `group_member_functions`, `school_rates`, `school_equipment`, `push_subscriptions`, `flight_events`.
- Massenzuweisung der Funktionen in `SchoolPeople.tsx`: Mehrfachauswahl in der Liste, Insert/Delete auf `group_member_functions` (UNIQUE group_id/user_id/function beachten).
- Einladung: `groups.invite_code` bereits vorhanden; QR-Code clientseitig rendern, Beitritt über bestehende RPC `join_group_by_invite_code`.
- Push: bestehende `send-push`-Funktion für den Selbsttest nutzen; Empfängerzahl in `notify-event-participants` zurückgeben und im Ankündigungs-Dialog anzeigen.
- Ansatz-Vorschläge als Standard-Inserts in `school_rates` (rate_key/amount/unit/valid_from), nur beim ersten Öffnen angeboten.
- Ausbildungsstand-Vereinheitlichung als einmalige Migration mit Mapping auf `ground`/`altitude`/`exam_ready`/`licensed`.
- i18n-Schlüssel für de/en/fr in jedem Schritt mitziehen.
