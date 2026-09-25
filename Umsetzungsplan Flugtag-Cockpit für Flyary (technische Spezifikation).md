# Umsetzungsplan: Flugtag-Cockpit für Flyary

2026-09-25 · Tobias Bolliger · Stand: C1 abgeschlossen und abnahmegeprüft (Betriebshandbuch offen), C2 umgesetzt (Abnahmeprüfung offen); C3 offen

Dieses Dokument beschreibt, wie das Schulteam am eigentlichen Flugtag erfasst, wer da ist, wer welche Flüge gemacht hat und welche Rückmeldungen dazugehören. Heute ist das auf vier Stellen verteilt (Anwesenheit, Ausbildungsblatt F1–F6, Schülerflüge, geplante Manöver), und Schulteam und Schüler erfassen dieselben Flüge doppelt und ohne Abgleich. Das Flugtag-Cockpit ersetzt das durch **einen Bildschirm pro Flugtag**, auf dem jeder Flug ein **echter Eintrag der Schule** ist.

Der Plan ist wie die Umsetzungspläne für die Flugschul-Erweiterungen und den Marktplatz aufgebaut: Jeder Unterabschnitt ist ein eigener Auftrag an den Coding-Agenten, mit Ziel, Akzeptanzkriterien, Datenmodell und Platz in der Navigation.

## Status

| Stufe | Status | Bemerkung |
| --- | --- | --- |
| C1 – Cockpit und Flugerfassung (MVP) | ✅ Abgeschlossen | 4.1–4.5 umgesetzt und abnahmegeprüft; Betriebshandbuch noch nicht nachgeführt |
| C2 – Tagesabschluss | 🚧 Umgesetzt, Abnahmeprüfung offen | 5.1 ✅, 5.2 ✅ |
| C3 – Flugbuch-Abgleich und Ausbildungsnachweis | ⏳ Offen | 6.1–6.3 |
| C4 – Später / optional | ⏸ Zurückgestellt | 7.1–7.6 |

## 1. Ausgangslage

| Heute | Wo | Problem |
| --- | --- | --- |
| Anwesenheit | Reiter *Teilnehmende*, `EventAttendance.tsx` | Zweite Liste neben der Anmeldeliste; `attended` kennt nur ja/nein, «noch nicht eingecheckt» und «fehlt» sind nicht unterscheidbar |
| Beobachtungen | Reiter *Coaching*, `CoachDayView.tsx` (`student_day_notes`, `flight_number` 1–6) | Freitext-Slots ohne Bezug zu einem echten Flug; höchstens 6 Flüge (am Übungshang oft 10–15); Sichtbarkeit pro Notiz über ein Augen-Symbol |
| Pausieren | `student_day_notes` mit `flight_number = -1` | Zweckentfremdete Notiz statt Tagesstatus, ohne Grund |
| Übernommene Zusammenfassung | `CoachDayView.tsx` | Vorausgefüllt vom letzten Termin **der Gruppe**, auch wenn der Schüler dort nicht dabei war; alter Text wirkt wie eine heutige Feststellung |
| Manöverbewertung | `EventStudentFlights.tsx` (`flight_training_items.instructor_rating`) | Erst sichtbar, wenn der Schüler den Flug selbst erfasst hat; nur für Admins; Flüge werden per Datum statt per `event_id` gesucht |
| Geplante Manöver | Reiter *Planung* (`event_maneuvers`) | Tauchen beim Coaching nicht mehr auf |
| Sammelbuchung | `EventAttendance.book()` im Browser | Miete pauschal für alle Anwesenden, unabhängig von einer Ausleihe; mehrere Schreibschritte ohne Transaktion |
| Flugzahl im Dossier | `school_student_dossier` zählt `flights` mit `group_id` | Stammt aus dem privaten Flugbuch; der Schüler kann Einträge ändern oder löschen, und nur erfasste Flüge zählen |

## 2. Grundsatzentscheide

| # | Frage | Entscheid | Herkunft | Folge für die Umsetzung |
| --- | --- | --- | --- | --- |
| E1 | Wer führt den Nachweis der Schulflüge? | **Die Schule**, in einer eigenen Tabelle. Das private Flugbuch bleibt beim Schüler | Entschieden 2026-09-25 (Nachweis gegenüber dem SHV muss aus Flyary kommen) | `event_school_flights` ist die massgebliche Quelle für Flugzahlen im Dossier und im Nachweis. Schüler können sie nicht ändern |
| E2 | Wer erfasst? | **Starthelfer am Startplatz** (Start), **Fluglehrer am Landeplatz** (Landung, Bewertung, Rückmeldung). Beide sind per Funk verbunden | Entschieden 2026-09-25 | Zwei Ansichten desselben Tages mit Live-Abgleich. Jede Seite kann einen Flug auch allein erfassen, falls die andere keine Hand frei hat |
| E3 | Doppelte Erfassung durch Schule und Schüler | **Die Schule erfasst, der Schüler übernimmt** mit einem Tipp in sein Flugbuch oder verknüpft bereits erfasste Flüge | Entschieden 2026-09-25 | Keine automatischen Schreibzugriffe der Schule in `flights` des Schülers (Datenhoheit, RLS bleibt einfach) |
| E4 | Offline | **Kein Offline-Modus** in C1–C3. Empfang ist selten ein Problem. Die bestehende Autosave-Logik (im Speicher, mit Wiederholen) bleibt | Entschieden 2026-09-25 | Keine Schülerdaten im Browser-Speicher (bisheriger Grundsatz bleibt). Offline-Warteschlange nur als Option in C4 |
| E5 | Bestehende F1–F6-Notizen | **Nicht in Flüge umwandeln**, sie bleiben als Lesansicht bei alten Terminen | Entschieden 2026-09-25 | Eine Umwandlung würde Flüge erfinden und den Nachweis verfälschen |
| E6 | Bewertung durch den Fluglehrer und Selbsteinschätzung | **Getrennt anzeigen**, die Bewertung des Fluglehrers überschreibt `training_progress` des Schülers nicht | Entschieden 2026-09-25 | Der Ausbildungsstand zeigt beide Werte (6.3) |
| E7 | Sichtbarkeit von Rückmeldungen | **Zwei Felder statt Umschalter:** «Rückmeldung an Schüler» und «Intern (nur Team)» | Entschieden 2026-09-25 | Interne Notizen sind für Schüler nie lesbar, auch nicht über die API (siehe 4.1) |
| E8 | Wann sieht der Schüler Rückmeldungen? | **Erst nach dem Tagesabschluss** (oder spätestens am Folgetag um 06:00) | Entschieden 2026-09-25 | Kein Mitlesen halbfertiger Notizen während des Tages; eine gebündelte Push-Mitteilung statt vieler einzelner |

## 3. Datenmodell

Logisches Zielbild. Vor der Umsetzung gegen das echte Schema abgleichen (Feldnamen von `equipment_assignments`, `event_staff`, `group_member_functions`, Hilfsfunktionen `is_group_staff` / `has_group_function`). Migrationen gehören in `drizzle/migrations/`, fortlaufend ab `0050_…`, mit Eintrag in `meta/_journal.json`.

| Tabelle | Zweck | Wichtige Felder | Feature |
| --- | --- | --- | --- |
| `event_school_flights` | Ein Flug eines Schülers an einem Flugtag, von der Schule erfasst | `id`, `event_id`, `group_id` (denormalisiert für RLS), `student_user_id`, `seq` (laufende Nummer pro Schüler und Tag), `status` (`in_air`/`landed`/`aborted`), `started_at`, `landed_at` (beide nullable), `takeoff_location_id`, `landing_location_id`, `start_note` (Starthelfer, nur Team), `created_by`, `landed_by`, `logbook_flight_id` (nullable, gesetzt nach Übernahme, 6.1), `created_at`, `updated_at` | 4.1 |
| `event_school_flight_notes` | Rückmeldung an den Schüler und interne Notiz zu einem Flug, nur für Fluglehrer lesbar | `flight_id` (PK), `feedback`, `internal_note`, `updated_by`, `updated_at` | 4.1 |
| `event_school_flight_items` | Bewertete Manöver pro Flug | `flight_id`, `training_item_id`, `rating` (1–3), PK (`flight_id`, `training_item_id`) | 4.3 |
| `event_signups` (erweitert) | Tagesstatus pro Teilnehmer | + `presence` (`expected`/`present`/`absent`, Default `expected`), + `checked_in_at`; `attended` wird generierte Spalte | 4.2 |
| `event_day_pauses` | Pause eines Schülers an diesem Tag (nur Team) | `event_id`, `student_user_id` (PK zusammen), `reason` (`material`/`fatigue`/`injury`/`weather`/`other`), `note`, `paused_by`, `paused_at` | 4.2 |
| `student_day_notes` (bleibt) | Tageszusammenfassung und nächster Lernschritt | Nur noch `flight_number IS NULL` wird neu geschrieben. Die Zeilen mit 1–6 bleiben als Altbestand, die Zeilen mit `-1` werden nach `paused_reason` migriert und gelöscht | 4.5 |
| `flight_events` (erweitert) | Tagesabschluss | + `day_closed_at`, + `day_closed_by`, + `feedback_released_at` | 5.1 |
| `flights` (erweitert) | Verknüpfung Flugbuch ↔ Schulflug | + `school_flight_id` (nullable, UNIQUE) | 6.1 |

**Interne Notizen liegen in einer eigenen Tabelle.** Ein spaltenweises `REVOKE SELECT` wirkt nicht, solange ein Tabellen-Grant besteht (Erkenntnis aus dem Audit vom 2026-09-24 bei `profiles`). Schüler erhalten auf `event_school_flight_notes` keine Leserechte. Auf `event_school_flights` lesen sie nur eigene Zeilen und erst ab `feedback_released_at` (E8). `start_note` wird ihnen über die RPC `my_school_flights` nicht geliefert. Eine direkte SELECT-Policy für Schüler gibt es auf dieser Tabelle nicht.

**`attended` bleibt lesbar.** `event_signups.attended` wird in derselben Migration durch eine generierte Spalte `attended = (presence = 'present')` ersetzt, damit lesende Stellen (`EquipmentQuotaHint`, Datenbanktests, RPCs) unverändert funktionieren. Vorher alle schreibenden Stellen suchen (`grep attended`, Migrationen, Tests) und im selben Auftrag umstellen. Bestehende Werte: `attended = true` → `present`, sonst bei vergangenen Terminen `absent`, bei künftigen `expected`.

**Schreiben über RPCs**, wie bei `set_event_status` (0024): `school_flight_start`, `school_flight_land`, `school_flight_add` (Flug nachtragen), `school_flight_abort`, `school_flight_delete`, `set_signup_presence`, `close_flight_day`, `reopen_flight_day`. So sind Rollen (Starthelfer oder Fluglehrer), die Nummerierung (`seq`) und der gesperrte Tag nach dem Abschluss serverseitig durchgesetzt.

**Rechte in der Übersicht:**

| Wer | Lesen | Schreiben |
| --- | --- | --- |
| Fluglehrer, Schulleitung, Admin der Schule | Alles des Tages inkl. interner Notizen | Alles, auch nach dem Abschluss mit `reopen_flight_day` |
| Starthelfer (im Termin eingeteilt oder mit Funktion `launch_helper`) | Namen, Tagesstatus, Flüge des Tages mit Zeiten und `start_note`; **keine** internen Notizen, keine Rückmeldungen, kein Dossier | Einchecken, Start, Startabbruch, `start_note` |
| Schüler | Eigene Flüge und `feedback` ab Freigabe (über `my_school_flights`) | Nichts, ausser der Übernahme ins eigene Flugbuch (6.1) |

## 4. C1 – Cockpit und Flugerfassung (MVP)

### 4.1 Datenmodell, Rechte und RPCs für Schulflüge ✅

**Ziel:** Tabellen `event_school_flights`, `event_school_flight_notes` und die Schreib-RPCs als Grundlage.

**Akzeptanzkriterien:**

- `school_flight_start(event_id, student_id, note?)` legt einen Flug mit `status = 'in_air'`, `started_at = now()` und der nächsten `seq` an. Standard-Startplatz aus dem Termin (Fluggebiet); ist keiner hinterlegt, bleibt das Feld leer
- Pro Schüler und Termin höchstens **ein** Flug gleichzeitig `in_air`. Ein zweiter Start schlägt mit einer verständlichen Meldung fehl
- `school_flight_land(flight_id, landing_location_id?, feedback?, internal?, items?)` setzt `landed`, `landed_at`, `landed_by`. Items und interne Notiz werden in derselben Transaktion gespeichert
- `school_flight_add(event_id, student_id, …)` erfasst einen Flug direkt als `landed` (Start nicht erfasst, Fluglehrer allein, Übungshang). `started_at` bleibt leer
- `school_flight_abort(flight_id, note?)` markiert einen Startabbruch mit optionalem Grund (z. B. «Aufziehen asymmetrisch»). **Startabbrüche erscheinen nie im Nachweis** und nicht beim Schüler, sondern nur intern beim Team (Entscheid 2026-09-25). Sie zählen nicht als Flug
- Löschen nur durch Fluglehrer, Schulleitung oder Admin, und nur solange der Tag nicht abgeschlossen ist. Danach wird `seq` der folgenden Flüge **nicht** neu nummeriert (Nachvollziehbarkeit); die Anzeige nummeriert fortlaufend
- Nur Schüler mit Anmeldung (`signed_up = true`, nicht auf der Warteliste) können Flüge erhalten
- Nach `day_closed_at` lehnen alle Schreib-RPCs ab, bis der Tag wieder geöffnet ist
- Datenbanktests auf PGlite mit: Fluglehrer, Starthelfer, Schüler (eigene und fremde Flüge, vor und nach der Freigabe), Team einer fremden Schule, nicht angemeldet. Der Schüler darf weder `event_school_flight_notes` noch `start_note` lesen

**Datenmodell:** `event_school_flights`, `event_school_flight_notes` (Abschnitt 3). Realtime für `event_school_flights` aktivieren (`ALTER PUBLICATION supabase_realtime ADD TABLE …`). Realtime beachtet RLS; prüfen, dass Starthelfer über Realtime nichts erhalten, was sie über SELECT nicht sehen.

**Logik in `src/lib/school-flights.ts`:** Anzeigenummer, Dauer, Zähler pro Schüler (Flüge ohne Abbrüche), «in der Luft seit». Vitest-Tests.

**Ist-Stand:** Migration `0050_event_school_flights.sql` mit `event_school_flights`, `event_school_flight_notes`, der Rollenfunktion `flight_day_role` und den RPCs `school_flight_start`, `_land`, `_add`, `_abort`, `_update`, `_set_notes`, `_delete`, `set_flight_day_locations` und `my_school_flights`. Datenbanktests in `src/test/school-flights-database.test.ts` (Fluglehrer, Starthelfer mit Funktion und nur im Termin eingeteilt, Fluglehrer nur im Termin eingeteilt, Schüler vor und nach der Freigabe, Team einer fremden Schule, Aussenstehende, nicht angemeldet, Termin eines Clubs, abgeschlossener Tag, direkte Schreibversuche). **Abweichungen:** Die Rückmeldung liegt mit der internen Notiz in `event_school_flight_notes` statt in `event_school_flights`, sonst hätten Starthelfer sie über SELECT und Realtime gelesen. `flight_events` erhält schon hier Standard-Start- und Landeplatz (der Termin kannte das Fluggebiet nur als Text) sowie `day_closed_at`, `day_closed_by` und `feedback_released_at`, damit Sperre und Freigabe von Anfang an gelten. Standardorte: zuletzt an diesem Tag verwendeter Ort, sonst der Termin-Standard.

### 4.2 Check-in und Tagesstatus ✅

**Ziel:** Anwesenheit und Pausieren werden Teil des Cockpits; die Anwesenheitskarte im Reiter *Teilnehmende* entfällt.

**Akzeptanzkriterien:**

- Neuer Reiter **Flugtag** im Termin für Schulteam und Starthelfer. Er ersetzt den Reiter *Coaching*. Am Tag des Termins öffnet er sich für das Team automatisch (sonst *Übersicht*). Deep-Link `?tab=day`; der alte Link `#coaching` aus dem Dossier leitet dorthin um
- **Check-in:** Alle Angemeldeten erscheinen als Kacheln (Name, Ausbildungsstand als Kürzel). Tippen schaltet `expected → present`. Über ein Menü an der Kachel lässt sich «fehlt» setzen. «Alle anwesend» als Sammelaktion mit Bestätigung
- Oben ein Zähler «9 von 11 da, 1 fehlt, 1 offen»
- Der erste erfasste Flug eines Schülers setzt `presence = 'present'` automatisch, falls noch `expected`
- **Heute pausieren** mit optionalem Grund (Auswahl «Material», «Müdigkeit», «Verletzung», «Wetter», «Anderes» + Freitext). Pausierte Schüler rutschen ans Ende und sind abgedimmt. Pausieren ist jederzeit rückgängig zu machen
- Zeilen mit `flight_number = -1` sind nach `paused_reason = 'other'` migriert; `CoachDayView` liest sie nicht mehr
- Inaktive Schüler werden wie heute ausgeblendet, mit dem bestehenden Schalter «Inaktive anzeigen»
- Die Anmeldeliste im Reiter *Teilnehmende* bleibt (für alle sichtbar), zeigt für das Team aber nur noch den Tagesstatus als Badge

**Datenmodell:** `event_signups.presence`, `paused_reason`, `checked_in_at`; RPC `set_signup_presence`.

**Ist-Stand:** Migration `0051_flight_day_presence.sql` (`presence`, `checked_in_at`, `attended` als generierte Spalte, `event_day_pauses`, RPCs `set_signup_presence`, `set_signups_present`, `set_day_pause`, `set_signup_confirmed`, Trigger `protect_signup_school_fields` und «erster Flug checkt ein»), Oberfläche `src/components/flightday/DayCheckIn.tsx` im neuen Reiter «Flugtag». **Fund:** Die Anwesenheitshäkchen und «Bestätigen» des Schulteams wurden bei anderen Personen bisher still ignoriert (RLS nur «eigene Anmeldung»), ein Schüler konnte dafür bei sich selbst `attended` und `confirmed_by_school` setzen. Beides behoben. **Abweichungen:** Pausengrund in eigener Tabelle `event_day_pauses` (nur Team) statt `event_signups.paused_reason`, weil alle Gruppenmitglieder die Anmeldungen lesen; nicht angehakte frühere Anmeldungen bleiben `expected` statt `absent`; auch Starthelfer dürfen pausieren; Ausbildungsblatt, Schülerflüge und Tagesbuchung stehen bis 4.3–5.1 unten im Reiter, nur für Admin, Fluglehrer und Schulleitung.

### 4.3 Flug erfassen am Landeplatz (Fluglehrer) ✅

**Ziel:** Der Fluglehrer erfasst einen Flug samt Bewertung mit wenigen Tipps, mit einer Hand und Handschuhen.

**Ansicht (Liste, eine Zeile pro Schüler):**

```
┌ Höhenflüge Niederbauen · Bestätigt ──────── 9/11 da ┐
│ In der Luft: Anna (seit 4 min)                       │
├──────────────────────────────────────────────────────┤
│ Anna    ✈ 3  ●●◐   ⤷ in der Luft        [Gelandet]   │
│ Beat    ✈ 2  ●●                         [+ Flug]     │
│ Carla   ⏸ Material                                   │
└──────────────────────────────────────────────────────┘
```

**Akzeptanzkriterien:**

- Pro Zeile: Name, Anzahl Flüge heute, ein Punkt pro Flug (gefüllt = Rückmeldung vorhanden), Status. Hauptaktion: **Gelandet**, wenn der Schüler in der Luft ist, sonst **+ Flug**
- **Gelandet** bzw. **+ Flug** öffnet ein Bottom-Sheet:
  - Die geplanten Manöver des Termins (`event_maneuvers`) als Chips; ein Tipp wählt ein Manöver, dann Bewertung 1–3 («nochmals», «geht», «sitzt»)
  - Textbausteine als Chips (Standard aus i18n, z. B. «Vorfliegen zu kurz», «Anflug sauber», «Blick in die Kurve»), die an die Rückmeldung angehängt werden
  - Feld **Rückmeldung an Schüler**, Feld **Intern** (eingeklappt); die Diktierfunktion der Tastatur funktioniert ohne Zusatzaufwand
  - Landeplatz vorausgefüllt aus dem Termin, änderbar
  - **Speichern** schliesst das Sheet; ohne Text ist das in **höchstens 3 Tipps** möglich (Zeile → Gelandet → Speichern)
- Ein Tipp auf die Zeile klappt den Schüler auf: Flüge des Tages mit Nummer, Zeiten und Rückmeldung (bearbeitbar), darunter der **letzte nächste Lernschritt** aus früheren Terminen als Lesetext (nicht vorausgefüllt)
- Autosave und Speicherstatus wie heute (`coachNoteAutosave` wiederverwenden bzw. verallgemeinern); bei Fehlern gut sichtbar «Nicht gespeichert – Wiederholen»
- **Übungshang-Modus** für Termine der Art `basic_course`: Die Hauptaktion ist ein Zähler **+1** (legt sofort einen Flug via `school_flight_add` an, Toast mit «Rückgängig» für 5 s). Die Bewertung ist optional über die aufgeklappte Zeile
- Grosse Touch-Ziele (mindestens 48 px), keine Aktionen, die nur über Wischen erreichbar sind

**Datenmodell:** `event_school_flight_items`.

**Ist-Stand:** Migration `0052_school_flight_items.sql` (`event_school_flight_items`, nur Fluglehrer lesen; `school_flight_land`/`_add` mit Bewertungen in einer Transaktion; `school_flight_set_items`; `my_school_flights` mit Bewertungen; Lese-Policy für die Orte eines Flugtags), Oberfläche `FlightBoard.tsx`, `RecordFlightSheet.tsx`, `DaySitesCard.tsx`. **Fund:** Orte gehören einer Person; ohne die neue Policy hätten zweiter Fluglehrer und Starthelfer die Namen der Plätze des Tages nicht lesen können. **Abweichungen:** Landeplatz einmal als Platz des Tages statt pro Flug im Sheet (Korrektur pro Flug über `school_flight_update`); Ausbildungsblatt F1–F6 bleibt bis 4.5 unter der Flugliste; Bewertungen noch nicht im Ausbildungsstand (6.3). Für die Übernahme ins Flugbuch (6.1) beachten: Die Orte der Schulflüge gehören dem Fluglehrer, nicht dem Schüler.

### 4.4 Startplatz-Ansicht für Starthelfer und «In der Luft» ✅

**Ziel:** Der Starthelfer oder der Fluglehrer (wenn es der Starthelfer nicht macht, er es aber über das Radio gemeldet kriegt) meldet Starts, der Fluglehrer am Landeplatz sieht live, wer unterwegs ist. Der Funk bleibt das Hauptmittel, die App spiegelt den Stand.

**Akzeptanzkriterien:**

- Starthelfer sehen im Reiter **Flugtag** dieselbe Liste in einer reduzierten Form: Check-in, Hauptaktion **Start** (setzt `in_air`), im Menü **Startabbruch** und eine kurze **Startnotiz** (nur Team, z. B. «2. Versuch, Aufziehen zu schnell»)
- Keine Rückmeldungsfelder, keine internen Notizen, kein Lernschritt, kein Link ins Dossier
- **Live-Abgleich** über Supabase Realtime (Muster aus `ChannelChat.tsx`): Ein Start erscheint beim Fluglehrer innerhalb weniger Sekunden als «In der Luft: Anna (seit 0 min)». Die Landung verschwindet ebenso beim Starthelfer
- Leiste **In der Luft** oben bei beiden Rollen, mit laufender Zeit seit dem Start, am längsten Fliegende zuerst. **Keine feste Warnschwelle**, weil Flüge je nach Tag 5 bis 30 min und später bei Thermik- oder Soaringflügen deutlich länger dauern (Entscheid 2026-09-25). Optional kann der Fluglehrer pro Flugtag «Hinweis nach … min» setzen (Aus / 15 / 30 / 45 / 60 / 90, Standard **Aus**); dann wird der Eintrag orange mit «Landung erfassen?». Das ist nur ein Hinweis, keine Alarmierung
- Beim Wiederverbinden (App im Hintergrund, Funkloch) wird die Liste komplett neu geladen, damit keine Realtime-Nachricht fehlt
- Starthelfer haben im Einsatz immer ein Handy dabei (Entscheid 2026-09-25). Der Ablauf Start → Landung ist darum der Normalfall. **+ Flug** des Fluglehrers bleibt als Rückfall, wenn ein Start vergessen ging (E2)
- Ein Fluglehrer kann über einen Schalter «Als Startplatz arbeiten» zur Starthelfer-Ansicht wechseln (z. B. wenn er selbst oben ist)

**Ist-Stand:** Migration `0053_flight_day_landing_hint.sql` (`flight_events.landing_hint_minutes`, RPC `set_flight_day_landing_hint`), Oberfläche `TakeoffBoard.tsx`, `InAirBar.tsx`, `FlightDayStations.tsx` (Umschalter Landeplatz/Startplatz, pro Gerät gemerkt), Hook `use-flight-day-live.ts`. Auf dem Landeplatz steht neben «+ Flug» ein «Start» für Starts, die nur per Funk gemeldet werden. Pausierte Schüler lassen sich nach Rückfrage starten. Der Landehinweis wird in der Karte «Plätze des Tages» gesetzt und gilt für alle Geräte des Tages.

### 4.5 Ablösung von Ausbildungsblatt und Schülerflügen ✅

**Ziel:** Keine parallelen Wege mehr. Zusammenfassung und nächster Lernschritt wandern ins Cockpit.

**Akzeptanzkriterien:**

- In der aufgeklappten Schülerzeile gibt es unten die **Tageszusammenfassung** mit dem Schalter «Als nächsten Lernschritt markieren» (wie heute in `student_day_notes`, `flight_number IS NULL`)
- **Keine vorausgefüllte Übernahme mehr.** Der letzte nächste Lernschritt steht als Lesetext darüber. Er stammt aus dem letzten Termin, **an dem dieser Schüler anwesend war** (statt aus dem letzten Termin der Gruppe). Ein Knopf «Als Vorlage übernehmen» kopiert ihn bei Bedarf bewusst
- Die Sichtbarkeit der Zusammenfassung für den Schüler folgt E8 (Freigabe mit dem Tagesabschluss); das Augen-Symbol entfällt
- `CoachDayView` wird für Termine **ohne** Schulflüge, aber mit alten F1–F6-Notizen, als Lesansicht «Ausbildungsblatt (bisher)» weiter angezeigt. Neue F1–F6-Notizen sind nicht mehr möglich
- `EventStudentFlights` entfällt im Reiter; Flüge aus privaten Flugbüchern mit `event_id` des Termins erscheinen als kleiner Hinweis «Von Schülern selbst erfasst: 4 Flüge» (Grundlage für 6.1)
- `school_student_dossier`, `latestNextStepPerStudent` (`src/lib/handoff-notes.ts`) und `StudentDayFeedback` lesen weiterhin korrekt; Tests anpassen
- Betriebshandbuch Kapitel 14, 15 und 27 überarbeiten (neue Screenshots über `scripts/capture-school-handbook.mjs`)

**Ist-Stand:** Migration `0054_flight_day_feedback_release.sql` (Freigabe-Regel `flight_day_feedback_released`: Tagesabschluss oder spätestens Folgetag 06:00 Schweizer Zeit, nach dem letzten Tag bei mehrtägigen Terminen; gilt für `my_school_flights` und die Schüler-Policy auf `student_day_notes`), `DaySummaryEditor.tsx` (Zusammenfassung und nächster Lernschritt in der aufgeklappten Zeile, «Letzten Lernschritt als Vorlage übernehmen»), `LegacyCoachNotes.tsx` (F1–F6 nur lesen), `StudentDayFeedback.tsx` (Schulflüge mit Bewertungen und Rückmeldung für Schüler). `CoachDayView.tsx` und `EventStudentFlights.tsx` entfernt. **Abweichungen:** Freigabe-Regel und Schüleranzeige aus 5.2 vorgezogen (Push folgt mit 5.2); der letzte Lernschritt stammt aus dem letzten früheren Termin mit markiertem Lernschritt; **Betriebshandbuch noch offen** (die Handbuch-Dateien und das Screenshot-Skript sind noch nicht eingecheckt).

## 5. C2 – Tagesabschluss

### 5.1 Abschluss-Assistent mit Abrechnung ✅

**Ziel:** Ein geführter Abschluss am Ende des Tages ersetzt die Sammelbuchung im Browser.

**Akzeptanzkriterien:**

- Knopf **Tag abschliessen** im Cockpit (Fluglehrer, Schulleitung, Admin), ab dem Termindatum aktiv. Ein Assistent in vier Schritten:
  1. **Alle gelandet?** Flüge mit `in_air` werden aufgelistet und müssen gelandet, abgebrochen oder gelöscht werden. Schüler mit `expected` werden auf `present` oder `absent` gesetzt. Flüge ohne Startplatz werden angezeigt und können gesammelt ergänzt werden (nötig für die Anzahl Fluggebiete im Nachweis, 6.2)
  2. **Zusammenfassungen:** Liste der anwesenden Schüler ohne Tageszusammenfassung. Ein Vorschlag wird aus den heutigen Rückmeldungen zusammengesetzt («F1: …, F2: …»), keine KI. Überspringen ist erlaubt (kein hartes Blockieren)
  3. **Material:** Offene Ausleihen der heutigen Teilnehmer (`equipment_assignments` ohne `returned_on`), einzeln oder gesammelt zurücknehmen oder bewusst offen lassen
  4. **Abrechnung:** Vorschau pro Person. Startleiter-Guthaben für die im Termin eingeteilten Starthelfer, Mietposten nur für Anwesende **mit einer Ausleihe an diesem Tag** (bestätigt 2026-09-25) (`equipment_assignments.event_id` = Termin oder Ausleihzeitraum deckt das Datum). Jede Zeile lässt sich abwählen. Bereits gebuchte Posten erscheinen als «schon gebucht»
- **Abschliessen** ruft `close_flight_day(event_id, bookings jsonb)` auf: bucht Guthaben und Posten, setzt `day_closed_at`/`day_closed_by` und `feedback_released_at` in **einer** Transaktion. Doppelte Buchungen sind serverseitig ausgeschlossen (eindeutiger Schlüssel oder Prüfung pro Person, Termin und Art)
- Nach dem Abschluss zeigt das Cockpit «Abgeschlossen am … von …» und ist nur noch lesbar. **Wieder öffnen** (`reopen_flight_day`) storniert keine Buchungen und weist darauf hin
- `EventAttendance` samt clientseitiger `book()` entfällt; `school.attendance.*`-Texte aufräumen
- Wird ein Tag nicht abgeschlossen, gibt es am Folgetag eine Push-Mitteilung an den Fluglehrer des Termins: «Flugtag vom … noch nicht abgeschlossen»

**Logik in `src/lib/flight-day-close.ts`:** Vorschau der Buchungen aus Anwesenheit, Einteilung, Ausleihen und Ansätzen; Vorschlag der Zusammenfassung. Vitest-Tests für Fälle wie Ansatz null, bereits gebucht, Ausleihe über mehrere Tage oder Starthelfer, der zugleich Teilnehmer ist.

### 5.2 Rückmeldung an die Schüler ✅

**Ziel:** Schüler erhalten ihre Rückmeldungen gebündelt und zuverlässig.

**Akzeptanzkriterien:**

- Mit `feedback_released_at` erhält jeder Schüler mit mindestens einem Flug oder einer freigegebenen Zusammenfassung **eine** Push-Mitteilung: «Deine Rückmeldung zum Flugtag … ist da» (bestehende `send_push_notification`)
- Fallback ohne Abschluss: Ein nächtlicher Lauf gibt Rückmeldungen am Folgetag um 06:00 frei (E8), falls `pg_cron` verfügbar ist (wie beim Marktplatz-Aufräumen). Sonst erfolgt die Freigabe beim ersten Öffnen des Termins durch das Team am Folgetag
- `StudentDayFeedback` zeigt pro Flug Nummer, Zeiten, bewertete Manöver (als Stufe, nicht als Zahl) und die Rückmeldung, darunter die Zusammenfassung und den nächsten Lernschritt
- Interne Notizen und Startnotizen erscheinen nie (Test)

**Ist-Stand C2:** Migration `0055_flight_day_close.sql` (`flight_day_close_preview`, `close_flight_day` in einer Transaktion mit Rückgaben, Guthaben, Mietposten, Abschluss, Freigabe und Push; `reopen_flight_day`; `school_flight_fill_takeoff`; eindeutige Indizes gegen Doppelbuchungen; `flight_day_daily_run` für Folgetag-Freigabe mit Push und Erinnerung an die Fluglehrer) und `0056_flight_day_schedule.sql` (stündlich über pg_cron). Oberfläche `CloseDayWizard.tsx`, `DayCloseBar.tsx`; `EventAttendance.tsx` entfernt. **Abweichungen:** Freigabe-Regel und Schüleranzeige schon mit 4.5; der Assistent übernimmt Zusammenfassungen direkt; die Routine berücksichtigt nur Termine ab 2026-09-25, damit ältere Tage keine Mitteilungen auslösen; die Mietposten-Beschreibung ist fix «Materialmiete Flugtag».

## 6. C3 – Flugbuch-Abgleich und Ausbildungsnachweis

### 6.1 Übernahme ins Flugbuch

**Ziel:** Schluss mit der doppelten Erfassung ohne Abgleich (E3).

**Akzeptanzkriterien:**

- Nach der Freigabe sieht der Schüler auf der Startseite und in *Flüge* eine Karte: «Die Schule hat 3 Flüge vom 25.9. erfasst»
- **Übernehmen** legt für jeden Schulflug ohne Verknüpfung einen Eintrag in `flights` an (Datum, Start- und Landeplatz, Termin, Gruppe, Dauer aus den Zeiten, falls beide vorhanden) und setzt `flights.school_flight_id` und `event_school_flights.logbook_flight_id`
- Hat der Schüler für diesen Termin bereits Flüge erfasst (gleiche `event_id`, sonst gleiche Gruppe und gleiches Datum), schlägt die App eine **Zuordnung** vor (nach Reihenfolge bzw. Uhrzeit) statt neue Einträge anzulegen. Der Schüler kann sie korrigieren
- Der Schüler kann den übernommenen Eintrag frei ergänzen (Schirm, Dauer, Track, Fotos). Das ändert den Schulnachweis nicht
- Löscht der Schüler den Flugbuch-Eintrag, wird nur die Verknüpfung gelöst; der Schulflug bleibt
- «Nicht übernehmen» blendet die Karte für diesen Termin aus
- Das Formular für neue Flüge weist bei einem Termin mit Schulflügen darauf hin: «Die Schule hat für diesen Tag schon Flüge erfasst – übernehmen statt neu erfassen?»

**Logik in `src/lib/school-flight-match.ts`:** Zuordnung von Schulflügen zu vorhandenen Flugbuch-Einträgen. Vitest-Tests (gleiche Anzahl, mehr Schul- als Flugbuchflüge und umgekehrt, fehlende Zeiten).

### 6.2 Ausbildungsnachweis im Dossier

**Ziel:** Die Schule kann gegenüber dem SHV belegen, welche Flüge und Manöver ein Schüler bei ihr absolviert hat.

**Akzeptanzkriterien:**

- Das Dossier zählt Flüge aus `event_school_flights` (`landed`, ohne Abbrüche), getrennt nach Terminart (Übungshang / Höhenflug). Die bisherige Zahl aus dem privaten Flugbuch erscheint zusätzlich als «selbst erfasst»
- Neuer Dossier-Abschnitt **Nachweis**: Liste der Flugtage mit Datum, Fluggebiet, Anzahl Flüge, Fluglehrer, bewerteten Manövern
- **Anforderungen des SHV (geklärt 2026-09-25):** alle Flüge, die Anzahl Fluggebiete, Unterschrift und Stempel der Schule (physisch, also auf dem Ausdruck). Startabbrüche erscheinen nicht
- **Export als PDF** pro Schüler, im Format des bestehenden Pilotenauszugs: Die Edge Function `export-flightbook-pdf` (jsPDF, Kopf, Flugtabelle mit Zebra-Zeilen, Totalzeile, Abschnitt «SHV Soloflug-Bestätigung», Zeilen für Ort/Datum, Fluglehrer, Unterschrift/Stempel) wird um eine Variante **Schulnachweis** erweitert, statt ein zweites Layout zu bauen. Gemeinsame Zeichenfunktionen werden dazu herausgelöst
  - Aufruf durch Fluglehrer, Schulleitung oder Admin der Schule aus dem Dossier; die Function prüft die Rolle serverseitig und liest `event_school_flights` (nicht das private Flugbuch)
  - Inhalt: Kopf mit Schule und Schüler, Tabelle aller Flüge (Datum, Startplatz, Landeplatz, Terminart, Fluglehrer), Totale (Anzahl Flüge, getrennt nach Übungshang und Höhenflug, **Anzahl verschiedener Fluggebiete**), am Ende das Feld für Ort, Datum, Unterschrift und Stempel der Schule
  - Zeitraum wählbar (Standard: gesamte Ausbildung bei dieser Schule)
  - Zusätzlich CSV für die eigene Ablage
- **Fluggebiet** = Startplatz (`takeoff_location_id`). Weil die Anzahl Fluggebiete verlangt ist, muss der Startplatz jedes Schulflugs gesetzt sein: vorausgefüllt aus dem Termin; fehlt er, weist das Cockpit beim Tagesabschluss darauf hin (5.1, Schritt 1)
- Jahresbericht (`AnnualReport`) nutzt dieselbe Quelle, falls dort Flugzahlen verlangt sind
- Historische Flüge vor der Einführung: Hinweis «Nachweis ab [Datum der Einführung]; frühere Flüge siehe Flugbuch des Schülers»

### 6.3 Bewertungen im Ausbildungsstand

**Ziel:** Die Bewertungen vom Flugtag werden im Ausbildungsstand des Schülers sichtbar, ohne seine Selbsteinschätzung zu überschreiben (E6).

**Akzeptanzkriterien:**

- In *Ausbildung* zeigt jedes Manöver neben der eigenen Einschätzung «Fluglehrer: sitzt (25.9.)», also die **letzte** Bewertung aus `event_school_flight_items`
- Das Dossier zeigt pro Manöver den Verlauf der Bewertungen über die Flugtage
- Bestehende `flight_training_items.instructor_rating` bleibt lesbar; neue Bewertungen entstehen nur noch über Schulflüge. Ob Altwerte migriert werden, wird bei der Umsetzung anhand der Datenmenge entschieden

## 7. C4 – Später / optional

| # | Idee | Nutzen |
| --- | --- | --- |
| 7.1 | Textbausteine pro Schule verwalten | Eigene Sprache und Schwerpunkte der Schule statt fester Standardtexte |
| 7.2 | KI-Vorschlag für die Tageszusammenfassung aus den Rückmeldungen | Weniger Schreibarbeit am Abend; der Fluglehrer prüft und bestätigt immer selbst |
| 7.3 | Offline-Warteschlange (verschlüsselt, kurzlebig) | Nur falls Empfang doch zum Problem wird (E4) |
| 7.4 | Automatische Zuordnung von IGC-Tracks zu Schulflügen anhand der Startzeit | Dauer und Höhe ohne Zusatzaufwand im Nachweis |
| 7.5 | Kurzes Video pro Flug (Landung) | Videofeedback; nur mit geklärtem Speicherbudget (siehe Media-Storage-Plan) |
| 7.6 | «SHV Soloflug-Bestätigung» im Pilotenauszug aus den Schulflügen statt aus dem selbst gesetzten `is_solo_shv` | Pilotenauszug und Schulnachweis zeigen dieselben Zahlen. **Entscheid zurückgestellt** (2026-09-25), nach C3 neu beurteilen |

## 8. Stufenplan und Reihenfolge

| Stufe | Fokus | Enthaltene Features | Aufwand |
| --- | --- | --- | --- |
| C1 | Cockpit und Flugerfassung | 4.1–4.5 | L |
| C2 | Tagesabschluss | 5.1–5.2 | M |
| C3 | Flugbuch-Abgleich und Nachweis | 6.1–6.3 | M |
| C4 | Später / optional | 7.1–7.6 | – |

Reihenfolge in C1: 4.1 → 4.2 → 4.3 → 4.4 → 4.5. Die Ablösung (4.5) kommt zuletzt, damit das alte Ausbildungsblatt bis dahin funktioniert. **C1 ist allein nutzbar**; ein Test mit Vertical an einem echten Flugtag vor C2 wird empfohlen, weil die Bedienung mit Handschuhen und Funk am besten draussen geprüft wird.

Deploys bündeln: C1 als möglichst wenige Pushes (Erkenntnis aus dem Marktplatz: viele Deploys kurz hintereinander halten Geräte auf veralteten Versionen fest).

## 9. Definition of Done

Es gelten Abschnitt 13 und 14 des Flugschul-Plans unverändert. Pro Feature: Migration mit RLS, Logik in `src/lib/*.ts` mit Vitest-Tests, UI in der bestehenden Navigation, DE/FR/EN, README-Abschnitt, ein Commit. Vor dem Commit `npm run typecheck`, `npx eslint` für geänderte Dateien und `npx vitest run`, vor dem Push `npm run smoke` (Fixture für neue RPCs in `scripts/smoke-routes.mjs`). Nach Abschluss jeder Stufe eine eigene Abnahmeprüfung aller Features dieser Stufe.

Speziell für das Flugtag-Cockpit:

- [ ] RLS- und Realtime-Tests decken Fluglehrer, Starthelfer, Schüler (eigene/fremde Flüge, vor/nach Freigabe), Team einer fremden Schule und nicht angemeldet ab
- [ ] Interne Notizen und Startnotizen sind für Schüler über keinen Weg lesbar (SELECT, RPC, Realtime)
- [ ] Ein Flug ist am Landeplatz ohne Text in höchstens 3 Tipps erfasst
- [ ] Doppelte Buchungen beim Tagesabschluss sind serverseitig ausgeschlossen und getestet
- [ ] Betriebshandbuch und Pilotenhandbuch sind nachgeführt

## 10. Offene Punkte

- Betriebshandbuch Kapitel 14, 15 und 27 an das Flugtag-Cockpit anpassen, Screenshots neu erstellen (4.5)
- Sollen Starthelfer Schüler mit pausierter oder abgebrochener Ausbildung ausgeblendet sehen? Dazu müsste `inactive_school_students` für Starthelfer lesbar werden (nur IDs, keine Gründe)
- Zurückgestellt: Herkunft der «SHV Soloflug-Bestätigung» im Pilotenauszug (7.6)

**Geklärt am 2026-09-25:**

- Alle Grundsatzentscheide E1–E8 gemäss Abschnitt 2 bestätigt
- SHV-Nachweis: alle Flüge, Anzahl Fluggebiete, Unterschrift und Stempel der Schule physisch, Format wie der bestehende Pilotenauszug (6.2)
- Startabbrüche: nur intern beim Flug erfasst, nie im Nachweis (4.1)
- Starthelfer haben im Einsatz immer ein Handy; der Ablauf Start → Landung ist der Normalfall (4.4)
- Keine feste Schwelle für «in der Luft», weil Flüge 5 bis 30 min und später länger dauern; optionaler Hinweis pro Flugtag, Standard aus (4.4)
- Mietposten nur bei erfasster Ausleihe (5.1)

## 11. Erkenntnisse aus der Umsetzung von C1

- **Zwei stille RLS-Lücken gefunden (4.2):** Auf `event_signups` durfte nur die eigene Anmeldung geändert werden. Die Anwesenheitshäkchen und «Bestätigen» des Schulteams wirkten darum bei anderen Personen nie (0 Zeilen, kein Fehler), während Schüler bei sich selbst `attended` und `confirmed_by_school` setzen konnten. Gleiches Muster wie beim Terminstatus (0024): Schreiben über RPCs, dazu ein Schutz-Trigger.
- **Orte gehören einer Person (4.3):** Ohne zusätzliche Lese-Policy hätten zweiter Fluglehrer und Starthelfer die Namen der Plätze des Tages nicht gesehen. Für die Übernahme ins Flugbuch (6.1) wichtig: Die Orte der Schulflüge gehören dem Fluglehrer.
- **Freigabe ohne geplanten Job (4.5):** «Freigegeben» ist eine Funktion (Tagesabschluss oder Folgetag 06:00 Schweizer Zeit) statt eines nächtlichen Laufs. Frühere Termine gelten damit automatisch als freigegeben, und die Regel wirkt gleich für Schulflüge und Zusammenfassungen.
- **Abnahmeprüfung C1:** vier Funde, alle behoben – Einstellungen des Tages luden nicht neu, kein Neuladen nach einem Funkloch bei offener App, Touch-Ziele unter 48 px, Reihenfolge der pausierten Schüler (README, «Nachtrag Abnahmeprüfung C1»).
- **Arbeitsablauf pro Auftrag** wie beim Marktplatz: Commit → Tobias spielt die Migration ein → lesende Prüfung der Live-Datenbank → Push → Vercel-Build abwarten → Typen neu erzeugen und vorübergehende Casts entfernen.
- **Testlauf auf diesem Rechner:** Die ganze Suite braucht `npx vitest run --maxWorkers=2`; mit den Standard-Workern bricht sie wegen Speichermangel ab (viele PGlite-Datenbanken parallel).

