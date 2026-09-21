# Umsetzungsplan: Flugschul-Erweiterungen für Flyary

2026-09-21 · @Someone · zuletzt aktualisiert 2026-09-21 (Stand nach Abschluss Phase 1 + Phase 2)

Dieses Dokument übersetzt den project/ce138141-fdda-49a8-b7a9-3e338e67ef48 in eine technische Spezifikation mit priorisiertem Umsetzungsplan – direkt nutzbar als Vorgabe für Agentic Coding (z. B. Claude Code) gegen die bestehende Flyary-Codebasis (React 18, TypeScript, Vite, Tailwind, shadcn, Supabase mit Row-Level-Security, react-leaflet, MapLibre GL JS).

## Status

| Phase | Status | Bemerkung |
| --- | --- | --- |
| 1 – SHV-Compliance-Basis | ✅ Abgeschlossen | Alle 7 Features (4.1–4.4, 5.1, 9.1, 9.2) umgesetzt und akzeptanzgeprüft |
| 2 – Schüler- und Team-Prozesse | ✅ Abgeschlossen | Alle 6 Features (5.2, 5.3, 6.1, 6.2, 6.3, 7.1, 7.2) umgesetzt und akzeptanzgeprüft |
| 3 – Kommunikation | ⬜ Nicht begonnen | Minderjährigen-Handling (Eltern-Zugang, digitale Einverständniserklärung) aus dem Plan entfernt, siehe Abschnitt 8 |
| 4 – Administration und Zahlung | ⬜ Nicht begonnen | |
| 5 – Reporting und Wetter-Integration | ⬜ Nicht begonnen | 4.4 (SHV-Jahresbericht) ist bereits Teil von Phase 1 und fertig |

Detaillierter Ist-Stand pro Feature direkt bei den jeweiligen Unterabschnitten unten (✅-Markierung). Tatsächliche Implementierungsdetails (Migrationsdateien, Komponenten, Testabdeckung) stehen in der README.md des Repos, dort pro Feature ein eigener Abschnitt mit Begründung für jede Abweichung von diesem Plan. Abschnitt 14 wurde um konkrete Erkenntnisse aus der Umsetzung von Phase 1 und 2 ergänzt.

Bei zwei Akzeptanzkriterien-Prüfungen (nach Phase 1 und nach Phase 2, siehe Abschnitt 14) wurden insgesamt mehrere reale Fehler in bereits „fertigen“ Features gefunden und behoben – u. a. eine RLS-Sichtbarkeitslücke, ein Zeitzonenfehler bei Datums-/Zeitfeldern und eine veraltete Datenanzeige nach Statusänderungen. Diese Prüfung nach jeder Phase hat sich als eigener, lohnender Arbeitsschritt etabliert (siehe Abschnitt 14).

## 1. Einleitung

**Zweck**: Jedes Feature unten ist so formuliert, dass es als eigenständiger Prompt/Task an einen Coding-Agenten (z. B. Claude Code) gegeben werden kann – mit Ziel, Akzeptanzkriterien, konkreten Datenmodelländerungen und UI-Verortung in der bestehenden Navigation.

**Ausgangslage** (gemäss Flyary-Doku v3): React 18 / TypeScript / Vite / Tailwind / shadcn-Komponenten, PWA mit Offline-Zwischenspeicher, Supabase („Lovable Cloud“) als Backend mit zeilenbasierter Zugriffskontrolle (RLS) und Edge Functions für serverseitige Logik (Push-Versand, Ankündigungen, IGC-Upload, PDF-Flugbuch, geteilte Links, Foto-Komprimierung, Konto-Löschung), react-leaflet für 2D- und MapLibre GL JS für 3D-Karten, 54 Tabellen in 8 fachlichen Gruppen (Flugbuch, Piloten, Gruppen, Termine, Flugschule, Ausbildung, Community, Infrastruktur).

**Leitprinzipien für die Umsetzung** (aus der bestehenden Architektur abgeleitet, für neue Features beizubehalten):

- Rollen/Funktionen bleiben in eigenen Tabellen, nie im Profil, Rechte werden serverseitig geprüft (RLS), nicht über die Oberfläche
- Sensible Daten (Gesundheit/Notfall) nur nach ausdrücklicher Einwilligung, besonders geschützt
- Mobile-first, dunkles Erscheinungsbild mit einheitlichem Seitenrahmen, Kachel-Übersicht statt langer Listen
- Neue Schulfunktionen gehören in den bestehenden Flugschul-Bereich (Rollenumschalter Pilot/Flugschule), nicht in eine Parallelstruktur
- Dreisprachigkeit (DE/FR/EN) gilt auch für neue Texte, Formulare und Vorlagen

## 2. Phasenplan

Priorisiert nach SHV-Compliance-Risiko, Abhängigkeiten zu bestehenden Tabellen und Aufwand – nicht nach Kapitelreihenfolge des Anforderungskatalogs. Jede Phase ist unabhängig auslieferbar.

| Phase | Fokus | Enthaltene Features | Begründung | Aufwand | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | SHV-Compliance-Basis | Unfallmeldung, Fluglehrer-Zertifikats-Tracking, Materialquote-Check, Ausrüstungscheck im Onboarding, Wartungsfristen Material | Direktes regulatorisches Risiko bei Nichteinhaltung; baut nur auf bestehenden Tabellen `school_equipment`, `training_progress`, `profiles` auf | M | ✅ |
| 2 | Schüler- und Team-Prozesse | Meilenstein-Freigaben im Kontrollblatt, Pausierungs-Status, Verfügbarkeitsplanung Team, Übergabenotizen, Geh/Nogo-Workflow, Ersatztermin-Vorschlag | Kerntätigkeit des Schulbetriebs; hoher Alltagsnutzen für Vertical | L | ✅ |
| 3 | Kommunikation | Notfall-Schnellzugriff, Lesebestätigung sicherheitsrelevanter Ankündigungen, Team-Verfügbarkeitsumfrage | Alltagsnutzen im laufenden Schulbetrieb; ursprünglich mit Minderjährigen-Handling gebündelt, das nicht mehr Teil des Plans ist (kein spezifischer rechtlicher Zeitdruck mehr) | S | ⬜ |
| 4 | Administration und Zahlung | Online-Zahlung bei Kursbuchung, digitale Vertragsunterschrift, Gutscheine/Rabatte, strukturierter Rechnungsexport | Unabhängiges Teilsystem, benötigt externen Zahlungsanbieter – grösster Integrationsaufwand | L | ⬜ |
| 5 | Reporting und Wetter-Integration | SHV-Jahresbericht-Export, Auslastungs-/Erfolgsquote-Dashboards, Fluggebiets-Wetter-Matching | Baut auf den Daten aus Phase 1–3 auf, liefert erst dann verlässliche Kennzahlen | S–M | ⬜ (4.4 bereits in Phase 1 erledigt) |

Empfehlung: Phase 1 und 2 vor dem nächsten Austausch mit Vertical prototypisch umsetzen – das macht den Workshop (Abschnitt 12 des Anforderungskatalogs) konkreter, weil Vertical an echten Bildschirmen statt an Konzepten Feedback geben kann. **Umgesetzt:** Phase 1 und 2 sind fertig; die nächste sinnvolle Grundlage für den Workshop mit Vertical ist damit vorhanden.

## 3. Datenmodell-Erweiterungen

Logisches Modell als Ausgangspunkt – vor der Umsetzung gegen das tatsächliche Supabase-Schema (54 bestehende Tabellen) abgleichen und als Migration anlegen. Neue Tabellen folgen dem bestehenden Muster: eigene Tabelle pro Fachkonzept, RLS-Policy je Tabelle, keine Rollen-/Berechtigungsfelder im `profiles`-Datensatz.

**Ist-Stand:** Spalte „Status“ zeigt den tatsächlichen Umsetzungsstand; Spalte „Wichtige Felder“ wurde für bereits gebaute Tabellen auf die tatsächlichen Spaltennamen korrigiert (Abweichungen vom ursprünglichen Entwurf sind erwartbar, siehe Abschnitt 14 – dieses Dokument war immer ein fachliches Zielbild, keine verbindliche DDL). Alle tatsächlichen Migrationsdateien liegen unter `drizzle/migrations/000{2..10}_*.sql`.

| Neue/erweiterte Tabelle | Gehört zu Gruppe | Zweck | Wichtige Felder (Ist-Stand, falls abweichend) | Bezug | Status |
| --- | --- | --- | --- | --- | --- |
| `instructor_certifications` | Flugschule | Zertifikate pro Teammitglied mit Gültigkeit | `group_id`, `user_id`, `cert_type`, `issued_at`, `valid_until`, `note`. Unterrichtstage werden **nicht** als Spalte geführt, sondern live aus `event_staff`/`flight_events` über ein rollierendes 3-Jahres-Fenster ab `issued_at` berechnet (`src/lib/instructor-certifications.ts`) | 4, 6 | ✅ |
| `incident_reports` | Flugschule | Unfall-/Vorfallmeldung mit SHV-Frist | `group_id` (statt `school_id`), `event_id`, `flight_id`, `student_user_id`, `reported_by`, `occurred_at`, `shv_deadline` (Trigger: `occurred_at` + 10 Tage), `involved_persons`, `description` (statt „Hergang“), `measures`, `status`, `submitted_at` | 4 | ✅ |
| `equipment_maintenance` | Flugschule (ergänzt `school_equipment`) | Prüf-/Wartungsfälligkeiten pro Gerät | `group_id`, `equipment_id`, `maintenance_type`, `due_at`, `completed_at`, `completed_by`, `note` | 9 | ✅ |
| `school_equipment` (erweitert) | Flugschule | – | + Feld `shv_type_approved: boolean` | 4, 9 | ✅ |
| `equipment_checks` | Ausbildung | Ausrüstungscheck im Onboarding (5.1) | `group_id`, `student_user_id`, `item`, `present`, `checked_at`, `checked_by`, `note`. Im ursprünglichen Entwurf nicht in dieser Tabelle geführt, aber bereits in Abschnitt 5.1 als Alternative vorgesehen | 5 | ✅ |
| `student_status_history` | Ausbildung | Nachvollziehbarer Status je Schüler | `group_id`, `student_id`, `status` (aktiv/pausiert/abgebrochen), `reason`, `changed_by`, `changed_at` | 5 | ✅ |
| `training_categories` (erweitert) | Ausbildung | Meilenstein-Gating | + Feld `unlocks_after_category_id` (self-referenzierend); ist ein globales, schulübergreifendes Curriculum ohne `group_id` | 5 | ✅ |
| `training_level_history` | Ausbildung | *(nicht ursprünglich geplant)* Verlaufsprotokoll für `profiles.training_level`, nötig für jahresbezogene Auswertung im SHV-Jahresbericht (4.4) | `group_id`, `user_id`, `training_level`, `changed_by`, `changed_at` | 4.4 | ✅ (Nachtrag) |
| `instructor_availability` | Flugschule | Verfügbarkeit pro Teammitglied und Tag | `group_id` (statt `school_id`), `user_id` (statt `profile_id`), `date`, `status` (verfügbar/unsicher/nicht verfügbar – **kein** Boolean `available`, da Plan selbst eine Dreifach-Ansicht verlangt), `note` | 6 | ✅ |
| `event_weather_decisions` | Termine (ergänzt `flight_events`) | Strukturierter Geh/Nogo-Entscheid | `event_id`, `decision_deadline`, `status` (bestätigt/wetterabhängig/abgesagt), `decided_by`, `decided_at`, `note`. **Zusatz gegenüber Plan:** Ein-Weg-Sync von `status` nach `flight_events.status` bei den Werten „bestätigt“/„abgesagt“ (siehe Abschnitt 14, `event_status`-Enum bewusst nicht erweitert) | 7 | ✅ |
| `group_messages` (erweitert) | Termine/Community | Interner Team-Kanal (6.3) | + Feld `is_team_only: boolean`, neue RLS-Funktion `is_group_team_member()`. **Abweichung vom Plan:** keine dedizierte „Team“-Gruppe pro Schule (siehe Abschnitt 14) | 6 | ✅ |
| `student_day_notes` (erweitert) | Ausbildung | Übergabenotizen (6.2) | + Feld `is_next_step: boolean`. **Abweichung vom Plan:** nicht `flight_coach_notes` (das ist die allgemeine, gruppenunabhängige Flug-Coaching-Notiz), sondern die bereits bestehende schulspezifische Tagesnotiz-Tabelle (siehe Abschnitt 14) | 6 | ✅ |
| `consent_records` | Piloten | Protokollierte Einwilligungen (Beweiskraft, siehe Abschnitt 12) | `profile_id`, `consent_type` (AGB/Haftungsausschluss/Foto/Datenbearbeitung), `version`, `accepted_at`, `accepted_by` | 10, 12 | ⬜ Phase 4 |
| `announcement_read_receipts` | Termine (ergänzt `event_messages`) | Lesebestätigung sicherheitsrelevanter Ankündigungen | `announcement_id`, `profile_id`, `read_at` | 8 | ⬜ Phase 3 |
| `team_polls`, `team_poll_responses` | Flugschule | Kurze Verfügbarkeitsabfragen im Team | `question`, `closes_at`; `poll_id`, `profile_id`, `response` | 8 | ⬜ Phase 3 |
| `course_payments` | Flugschule (ergänzt `billing_items`) | Online-Zahlung pro Kursbuchung | `billing_item_id`, `amount`, `provider`, `provider_ref`, `status`, `paid_at` | 10 | ⬜ Phase 4 |
| `vouchers` | Flugschule | Gutscheine/Rabattcodes | `code`, `discount_type`, `value`, `valid_until`, `redeemed_by`, `redeemed_at` | 10 | ⬜ Phase 4 |
| `locations` (erweitert) | Infrastruktur | SHV-Fluggebietsstatus, Wetter-Matching | + Felder `shv_approved: boolean`, `wind_sock: boolean`, `optimal_wind_directions: text[]`, `usage_permission_ref` | 4, 7 | ⬜ Phase 5 |

Alle neuen Tabellen erhalten RLS-Policies nach bestehendem Muster (Zugriff nur für Schulteam bzw. betroffene Person selbst); Datenschutz-relevante Tabellen (`consent_records`, Notfalldaten-Zugriff) benötigen eine eigene, engere Policy analog zu den bestehenden Notfall-/Gesundheitsdaten.

**Migrations-Infrastruktur (Nachtrag, nicht ursprünglich Teil des Plans):** Es gibt zwei Migrationsordner – `supabase/migrations/` (historisch, plus ein versehentliches Phase-1-Duplikat vom 21.9.) und `drizzle/migrations/` (die tatsächlich massgebliche Reihe ab Phase 1, s. Abschnitt 14). Eine Reconciliation-Migration (`drizzle/migrations/0004_reconcile_phase1_rls.sql`) bereinigt die daraus entstandenen RLS-Abweichungen idempotent, unabhängig davon, welche der beiden Migrationen tatsächlich zuerst gegen die Datenbank lief.

## 4. SHV-Compliance (Phase 1) ✅ Abgeschlossen

### 4.1 Unfall-/Vorfallmeldung ✅

**Ziel:** Meldung eines Vorfalls direkt aus Termin oder Flug auslösbar, mit Frist-Tracking gemäss SHV-Vorgabe (10 Tage).

**Akzeptanzkriterien:**

- Formularfelder: Datum/Zeit, beteiligte Personen, Hergang, ergriffene Massnahmen, betroffener Termin/Flug (optional verknüpft)
- Nach dem Anlegen zeigt die Übersicht einen Countdown „noch X von 10 Tagen“ bis zur SHV-Meldefrist
- Status-Feld (offen/eingereicht) mit Datum der Einreichung
- Export als PDF in einem an das offizielle SHV-Formular angelehnten Layout
- Nur für Schulleitung und Fluglehrer sichtbar/erstellbar (RLS wie bei bestehenden Coach-Notizen)

**Datenmodell:** neue Tabelle `incident_reports` (Abschnitt 3)

**UI:** Neuer Eintrag im Flugschul-Bereich („Übersicht“-Kachel oder eigene Kachel „Sicherheit“), zusätzlich Schnellzugriff „Vorfall melden“ aus dem Termin-Kontextmenü

**Ist-Stand:** Eigene „Sicherheit“-Kachel mit Tab „Vorfälle“ (`SchoolSafety.tsx` → `IncidentReports.tsx`). Formular in `IncidentReportDialog.tsx` ausgelagert, damit es sowohl in der Übersicht als auch als Schnellzugriff-Button direkt in `EventDetail.tsx` (bei Terminen einer Flugschulgruppe) verwendbar ist. PDF-Export ist ein Browser-Druckdialog mit an ein SHV-Formular angelehntem Tabellen-Layout, kein serverseitig erzeugtes PDF – funktional gleichwertig, aber technisch einfacher. Verknüpfung mit einem konkreten Flug (`flight_id`-Spalte existiert) ist in der UI nicht umgesetzt, nur die Terminverknüpfung.

### 4.2 Zertifikats-Tracking Team ✅

**Ziel:** Ablaufdaten von Fluglehrer-/Startleiter-/Biplace-Zertifikaten sichtbar machen, bevor sie zum Compliance-Problem werden.

**Akzeptanzkriterien:**

- Pro Teammitglied eine Liste der Zertifikate mit Ablaufdatum
- Automatische Berechnung der seit letzter Rezertifizierung geleisteten Unterrichtstage aus `event_staff`/`flight_events`
- Warnung in der Team-Übersicht, wenn ein Zertifikat innerhalb von 90 Tagen abläuft oder die Unterrichtstage-Quote (15 Tage/3 Jahre) nicht erreicht ist
- Warnung bei der Termin-Einteilung, wenn die eingeteilten Personen die SHV-Mindestbesetzung (Abschnitt 1 des Anforderungskatalogs) nicht erfüllen

**Datenmodell:** neue Tabelle `instructor_certifications`

**UI:** Team-Kachel im Flugschul-Bereich, Detailansicht pro Person

**Ist-Stand:** `TeamCertifications.tsx` (Tab „Zertifikate“ in „Sicherheit“). Unterrichtstage-Quote läuft über ein rollierendes 3-Jahres-Fenster ab Ausstellungs-/Rezertifizierungsdatum (nicht Kalenderjahr). Warnung bei der Termin-Einteilung in `EventStaff.tsx` umgesetzt, aber bewusst nur für Betrachter mit Verwaltungsrecht (`canManage`) sichtbar – Schüler können `instructor_certifications` laut RLS nicht einsehen, eine ungefilterte Anzeige hätte ihnen fälschlich „kein gültiges Zertifikat“ angezeigt (Fund aus der Phase-2-Prüfung, siehe Abschnitt 14).

### 4.3 Materialquoten-Check ✅

**Ziel:** Automatische Prüfung, ob für einen Kurstermin genügend Schulmaterial vorhanden ist (SHV: 2 Systeme pro 3 Schüler in den ersten 3 Kurstagen).

**Akzeptanzkriterien:**

- Bei der Termin-Einteilung wird die Anzahl Anmeldungen gegen die Anzahl verfügbarer, `shv_type_approved`-markierter Schirmsysteme im Lager geprüft
- Bei Unterschreitung erscheint ein Hinweis (kein Blocker, da Schüler auch eigenes Material mitbringen können)

**Datenmodell:** `school_equipment.shv_type_approved` (neues Feld, Abschnitt 3), Abgleich mit `equipment_assignments` und `event_signups`

**UI:** Hinweis in der Tagesorganisation des Termins

**Ist-Stand:** `EquipmentQuotaHint.tsx`, nur bei Grundkurs-Terminen aktiver Flugschulgruppen. Zählt Schüler in ihren ersten drei erfassten Grundkurstagen (nicht alle Angemeldeten), prüft echte Ausleihen über `equipment_assignments` statt nur den Gesamtbestand.

### 4.4 Jahresbericht-Export ✅

**Ziel:** Die vom SHV bis 28. Februar verlangten Kennzahlen auf Knopfdruck erzeugen.

**Akzeptanzkriterien:**

- Export (PDF oder CSV) mit: Anzahl Schüler nach Kursart, abgeschlossene Brevetierungen im Berichtsjahr, Betriebstage pro Monat, Team-Zusammensetzung mit Zertifikatsstatus
- Filterbar nach Kalenderjahr
- Erinnerung/Badge im Flugschul-Bereich ab Januar, solange der Bericht des Vorjahres nicht als „eingereicht“ markiert ist

**Datenmodell:** aggregierende Abfrage über bestehende Tabellen (`flight_events`, `training_progress`, `instructor_certifications`), keine neue Tabelle nötig; optional `annual_report_submissions` (Jahr, `submitted_at`) zur Nachverfolgung

**UI:** Statistik-Kachel des Flugschul-Bereichs, neuer Abschnitt „Jahresbericht“

**Ist-Stand:** `AnnualReport.tsx`, `annual_report_submissions`-Tabelle wie geplant. **Nachtrag:** Ursprünglich zeigte der Jahresfilter nur die Betriebstage/Monat korrekt gefiltert an, „Schüler nach Kursart“ und „abgeschlossene Brevetierungen“ blieben ein Live-Snapshot unabhängig vom gewählten Jahr (bei der Phase-1-Prüfung gefunden). Neue Tabelle `training_level_history` protokolliert seither jede Statusänderung mit Zeitstempel; für vergangene Jahre wird daraus rekonstruiert statt geraten. Ausserdem behoben: ein Vokabular-Mismatch zwischen zwei parallel verwendeten `training_level`-Wertebereichen im Bestandscode (`grundkurs/brevetkurs/siku` vs. `ground/altitude/exam_ready/licensed`).

## 5. Schülerverwaltung (Phase 1–2) ✅ Abgeschlossen

### 5.1 Ausrüstungscheck im Onboarding (Phase 1) ✅

**Ziel:** Nur Schüler mit vollständiger, konformer Ausrüstung zum Höhenflug zulassen (SHV-Pflicht).

**Akzeptanzkriterien:**

- Checkliste im Schüler-Onboarding: Helm, Schuhwerk, Gurtzeug mit Protektor/Airbag, Rettungsgerät – je als vorhanden/fehlt markierbar durch Fluglehrer
- Solange nicht vollständig abgehakt, erscheint ein Hinweis bei der Anmeldung zu einem Höhenflug-Termin (kein hartes Blockieren, da Leihmaterial möglich ist)

**Datenmodell:** neues Feld an bestehender Schülerfunktion oder eigene Tabelle `equipment_checks` (`student_id`, `item`, `checked_at`, `checked_by`)

**UI:** Ausbildungsplatz-Ansicht (Kapitel 13 der App-Doku), neuer Reiter „Ausrüstung“

**Ist-Stand:** `StudentEquipmentCheck.tsx` (Fluglehrer-Ansicht) und `StudentEquipmentHint.tsx` (Schüler-Hinweis vor der Anmeldung zu Höhenflug-Terminen, korrekt nicht-blockierend).

### 5.2 Pausierungs-Status (Phase 2) ✅

**Ziel:** Wiedereinstieg sauber vom Neueinstieg unterscheiden, Auswertungen (Abschnitt 11) nicht verfälschen.

**Akzeptanzkriterien:**

- Status pro Schüler: aktiv / pausiert / abgebrochen, mit Grund und Datum
- Statuswechsel durch Schulleitung/Fluglehrer, sichtbar in der Personenübersicht
- Pausierte/abgebrochene Schüler erscheinen nicht mehr in aktiven Terminlisten, bleiben aber im Flugbuch/Kontrollblatt erhalten

**Datenmodell:** neue Tabelle `student_status_history` (Abschnitt 3)

**UI:** Personenübersicht des Flugschul-Bereichs

**Ist-Stand:** `SchoolStudents.tsx`, Statuswechsel über Dialog mit Grund-Erfassung. Personenübersicht zeigt standardmässig nur aktive Schüler (Filter aktiv/alle), pausierte/abgebrochene bleiben über „Alle“ erreichbar. CSV-Export der Übersicht enthält Status/Grund/Datum (bei der Phase-2-Prüfung als Lücke gefunden und nachgezogen).

### 5.3 Meilenstein-Freigaben im Kontrollblatt (Phase 2) ✅

**Ziel:** Verhindern, dass ein Schüler zu einer Übung zugelassen wird, bevor die Voraussetzung erfüllt ist (z. B. Höhenflug erst nach abgeschlossenem Grundkurs).

**Akzeptanzkriterien:**

- Ausbildungskategorien können eine Voraussetzungs-Kategorie referenzieren
- Im Kontrollblatt wird eine gesperrte Kategorie visuell markiert, bis die Voraussetzung zu 100 % erfüllt ist
- Freigabe bleibt manuell durch den Fluglehrer aufhebbar (kein hartes Blockieren, Fluglehrer behält fachliche Entscheidungshoheit)

**Datenmodell:** `training_categories.unlocks_after_category_id` (Abschnitt 3)

**UI:** Bestehende Kontrollblatt-Ansicht (Kapitel 13), ergänzt um Sperr-/Freigabe-Indikator

**Ist-Stand:** `Training.tsx`, Schloss-Badge mit Name der Voraussetzung. Wie gefordert rein informativ – keine deaktivierten Bedienelemente, daher auch kein separater „Freigabe aufheben“-Mechanismus nötig. `training_categories` ist ein globales Curriculum ohne `group_id`; die Beispiel-Verknüpfung aus dem Plan (Höhenflüge nach Übungshang) wurde direkt per Migration gesetzt, analog dazu, wie die Kategorien selbst bereits gepflegt werden (keine App-UI dafür).

## 6. Team- und Fluglehrerorganisation (Phase 2) ✅ Abgeschlossen

### 6.1 Verfügbarkeitsplanung ✅

**Ziel:** Team trägt Verfügbarkeit im Voraus ein, statt nur reaktiv pro Termin eingeteilt zu werden.

**Akzeptanzkriterien:**

- Kalenderansicht pro Teammitglied: verfügbar / nicht verfügbar / unsicher, optional mit Notiz
- Bei der Termin-Einteilung werden nur als verfügbar markierte Personen vorgeschlagen
- Kombiniert mit dem Zertifikats-Tracking (Abschnitt 4.2): Warnung, wenn für einen Termin keine Person mit gültigem Fluglehrer-Zertifikat verfügbar ist

**Datenmodell:** neue Tabelle `instructor_availability` (Abschnitt 3)

**UI:** Team-Kachel im Flugschul-Bereich, neue Wochen-/Monatsansicht

**Ist-Stand:** `TeamAvailability.tsx`, Wochenansicht mit Klick-Zyklus pro Tag/Person (Monatsansicht nicht zusätzlich gebaut, Wochenansicht deckt die Akzeptanzkriterien ab). In `EventStaff.tsx` werden vorschlagbare Personen nach Verfügbarkeit sortiert und markiert (Empfehlung, kein Blocker); eingeteilte, aber als nicht verfügbar gemeldete Personen werden zusätzlich hervorgehoben. Die Zertifikats-Kombination aus dem Akzeptanzkriterium ist als eigene Warnung umgesetzt: greift, wenn für einen Termin noch niemand eingeteilt ist und keine verfügbar gemeldete Person ein gültiges Fluglehrer-Zertifikat hat.

### 6.2 Übergabenotizen zwischen Fluglehrern ✅

**Ziel:** Strukturierte „nächste Schritte“ pro Schüler, sichtbar für das ganze Team, nicht nur für den zuletzt unterrichtenden Fluglehrer.

**Akzeptanzkriterien:**

- Bestehende Coach-Notizen (`flight_coach_notes`) erhalten ein Flag „nächster Schritt“, das in der Schüler-Übersicht prominent angezeigt wird
- Historie bleibt erhalten (keine Überschreibung früherer Notizen)

**Datenmodell:** Ergänzung `flight_coach_notes.is_next_step: boolean`, kein neues Tabellenobjekt nötig

**Ist-Stand/Abweichung:** Statt `flight_coach_notes` (allgemeine, gruppenunabhängige Flug-Coaching-Notiz pro Flug) wurde `student_day_notes` erweitert – die bereits bestehende schulspezifische Tagesnotiz-Tabelle (pro Termin/Schüler, mit Sichtbarkeits-Toggle und Carry-over-Logik in `CoachDayView.tsx`), die schon vor diesem Feature Quelle der „letzten Zusammenfassung“ in der Schüler-Übersicht war. Siehe Abschnitt 14. Toggle „Nächster Schritt“ an der Zusammenfassungs-Notiz, Indikator-Icon in der kompakten Terminansicht je Schüler. Die zuletzt markierte Notiz wird in `SchoolStudents.tsx` anhand des tatsächlichen Termin-Datums ermittelt (nicht der Abfragereihenfolge, die bei Supabase ohne `ORDER BY` nicht garantiert ist).

**UI:** Schüler-Detailansicht im Ausbildungsplatz

### 6.3 Interner Team-Kanal ✅

**Ziel:** Kommunikation zwischen Fluglehrern/Startleitern trennen vom Termin-Chat mit Schülern.

**Akzeptanzkriterien:**

- Eigener Chat-Kanal pro Schule (nicht pro Termin), sichtbar nur für Teamfunktionen
- Gleiche Push-Mechanik wie bestehender Termin-Chat

**Datenmodell:** Wiederverwendung des bestehenden `group_messages`-Musters mit einer dedizierten „Team“-Gruppe pro Schule statt neuer Tabelle

**Ist-Stand/Abweichung:** Keine dedizierte Gruppe pro Schule – hätte laufend synchronisierte Mitgliedschaft gebraucht und wäre in Gruppenübersicht, Termin-Erstellung und Schulauswahl als normale, auswählbare Gruppe aufgetaucht. Stattdessen `group_messages.is_team_only` (Boolean), Sichtbarkeit live über eine neue Funktion `is_group_team_member()` geprüft (school_lead/instructor/launch_helper – bewusst weiter als `is_group_staff`, das Starthelfer ausschliesst, obwohl der Plan „Fluglehrern/Startleitern“ nennt). Wichtiger Fund beim Umsetzen: der bestehende Ankündigungs-Push-Trigger hätte bei `is_team_only`-Nachrichten unverändert alle Gruppenmitglieder benachrichtigt (inkl. Nachrichtentext in der Push-Payload) – Trigger entsprechend angepasst. Anhänge im Team-Kanal deaktiviert, da der Storage-Bucket für Chat-Anhänge nur Gruppenmitgliedschaft kennt, nicht `is_team_only`.

## 7. Terminplanung und Wetterentscheidung (Phase 2, Wetter-Matching Phase 5) ✅ 7.1/7.2 abgeschlossen, 7.3 = Phase 5 offen

### 7.1 Strukturierter Geh/Nogo-Entscheid ✅

**Ziel:** Klarer, fristgebundener Entscheid statt informeller Ankündigung.

**Akzeptanzkriterien:**

- Pro Termin optional eine Entscheid-Deadline (z. B. „Vorabend 18 Uhr“) hinterlegbar
- Status bestätigt / wetterabhängig / abgesagt, änderbar durch Fluglehrer/Schulleitung
- Statuswechsel löst automatisch eine Push-Ankündigung an alle Angemeldeten aus (Wiederverwendung des bestehenden Ankündigungs-Mechanismus, Kapitel 10)
- Erinnerung an die Deadline, falls noch kein Entscheid erfasst wurde

**Datenmodell:** neue Tabelle `event_weather_decisions` (Abschnitt 3)

**UI:** Termin-Detailansicht, neuer Status-Bereich oberhalb des Tagesprogramms

**Ist-Stand:** `EventWeatherDecision.tsx`. `event_status`-Enum (`announced`/`confirmed`/`cancelled`) bewusst nicht um „wetterabhängig“ erweitert, da app-weit für alle Gruppentypen verwendet (siehe Abschnitt 14) – stattdessen Ein-Weg-Sync bei den beiden Werten, die eine Entsprechung haben. Push nutzt die bestehende `notify-event-participants`-Edge-Function wieder (wie gefordert), feuert nur bei echtem Statuswechsel. Deadline-Erinnerung ist ein In-App-Hinweis, kein zeitgesteuerter Push (dafür fehlt serverseitige Job-Planung wie `pg_cron`, siehe Abschnitt 14). **Bekannte Grenze:** Wird der Terminstatus über das normale Bearbeitungsformular statt über den Wetterentscheid geändert, bleibt `event_weather_decisions` unverändert – die beiden Anzeigen können dann auseinanderlaufen (Sync ist bewusst nur einseitig).

### 7.2 Ersatztermin-Vorschlag bei Absage ✅

**Ziel:** Bei Absage automatisch einen Alternativtermin basierend auf Team-Verfügbarkeit (Abschnitt 6.1) vorschlagen.

**Akzeptanzkriterien:**

- Bei Status „abgesagt“ schlägt das System die nächsten 1–3 Tage mit verfügbarem Team vor
- Schulleitung kann den Vorschlag mit einem Klick als neuen Termin (Duplikat-Funktion, bereits vorhanden) übernehmen

**Datenmodell:** keine neue Tabelle, Abfrage über `instructor_availability` und bestehende `flight_events`

**UI:** Hinweis im Termin nach Statuswechsel auf „abgesagt“

**Ist-Stand:** `AlternativeDateSuggestion.tsx`. Sucht ab dem Tag nach dem Original-Termin (nicht ab heute) über bis zu drei Wochen vorwärts nach den nächsten Tagen mit tatsächlicher Verfügbarkeit – nicht zwingend die nächsten drei Kalendertage in Folge. Duplikat-Funktion um einen `date`-Parameter erweitert, der das Terminformular vorausfüllt statt das Datum leer zu lassen.

### 7.3 Fluggebiets-Wetter-Matching (Phase 5) ⬜

**Ziel:** Pro Fluggebiet anzeigen, ob die aktuelle Windrichtung passt.

**Akzeptanzkriterien:**

- `locations.optimal_wind_directions` (Abschnitt 3) wird gegen die bestehende Windy-Einbindung (Kapitel 17) abgeglichen
- Einfache Ampel-Anzeige (passend/grenzwertig/ungeeignet) auf der Orte- und Wetterseite
- Keine Speicherung von Wetterdaten in Flyary selbst – Grundsatz aus Kapitel 17 bleibt bestehen, Abgleich erfolgt zur Laufzeit

**Datenmodell:** `locations.optimal_wind_directions` (Abschnitt 3), keine neue Tabelle

## 8. Kommunikation (Phase 3) ⬜ Nicht begonnen

**Hinweis:** 8.1 (Eltern-/Erziehungsberechtigten-Verknüpfung) und 8.2 (Digitale Einverständniserklärung mit Protokollierung) wurden entfernt – das Minderjährigen-Handling ist nicht mehr Teil dieses Plans. Die Nummerierung startet bewusst bei 8.3, um Verweise aus anderen Abschnitten (u. a. 12.3) nicht zu brechen. Ein allgemeiner (nicht minderjährigenspezifischer) Bedarf an protokollierten Einwilligungen bleibt bestehen und ist jetzt unter 10.2 eigenständig beschrieben.

### 8.3 Notfall-Schnellzugriff

**Ziel:** Team kann im Ernstfall sofort auf Notfallkontakt und -daten eines Schülers zugreifen, ohne durch mehrere Menués zu navigieren.

**Akzeptanzkriterien:**

- Ein-Klick-Zugriff auf Notfalldaten direkt aus der Teilnehmerliste eines aktiven Termins
- Zugriff wird protokolliert (wer hat wann Notfalldaten eingesehen) – Datenschutz-Nachvollziehbarkeit

**Datenmodell:** keine neue Tabelle, zusätzliche RLS-Policy und Zugriffs-Log auf bestehende Notfalldatenfelder in `profiles`

**UI:** Teilnehmerliste im Tagestermin, prominenter Notfall-Button

### 8.4 Lesebestätigung sicherheitsrelevanter Ankündigungen

**Ziel:** Nachweis, dass eine Wetterabsage oder Treffpunktänderung tatsächlich angekommen ist.

**Akzeptanzkriterien:**

- Ankündigungen können als „bestätigungspflichtig“ markiert werden
- Empfänger-Übersicht zeigt gelesen/bestätigt vs. ausstehend (Erweiterung der bestehenden Mitteilungs-Übersicht aus Kapitel 22)

**Datenmodell:** neue Tabelle `announcement_read_receipts` (Abschnitt 3)

**UI:** Ankündigungs-Erstellung und -Übersicht

### 8.5 Team-Verfügbarkeitsumfrage

**Ziel:** Einfache Ja/Nein-Abfrage an das Team („Wer kann morgen als Startleiter?“), getrennt vom Termin-Chat.

**Akzeptanzkriterien:**

- Kurzumfrage mit Frage, Antwortoptionen und Schlussdatum, sichtbar im Team-Kanal (Abschnitt 6.3)
- Antwort-Übersicht pro Umfrage

**Datenmodell:** neue Tabellen `team_polls`, `team_poll_responses` (Abschnitt 3)

**UI:** Team-Kanal im Flugschul-Bereich

**Hinweis:** Die Voraussetzung „Team-Kanal“ (Abschnitt 6.3) existiert jetzt (`group_messages.is_team_only`, siehe dort) – dieses Feature ist damit direkt umsetzbar, sobald Phase 3 angegangen wird.

## 9. Material- und Ausrüstungsverwaltung (Phase 1) ✅ Abgeschlossen

### 9.1 Wartungs- und Prüffristen ✅

**Ziel:** Verhindern, dass ein überfälliges Gerät (z. B. Rettungsgerät ohne aktuelle Packung) versehentlich ausgegeben wird.

**Akzeptanzkriterien:**

- Pro Gerät im Lager (`school_equipment`) ein oder mehrere Fälligkeitsdaten mit Typ (Rettungsgerät-Neupacken, Gurtzeug-Check, Schirm-Check)
- Warnung bei der Ausgabe eines Geräts mit überfälliger Prüfung (analog zum bestehenden Unterhaltsintervall-Konzept bei privaten Schirmen, Kapitel 23)
- Übersicht „Fällig in den nächsten 30 Tagen“ für die Materialverantwortlichen

**Datenmodell:** neue Tabelle `equipment_maintenance` (Abschnitt 3)

**UI:** Material-Kachel im Flugschul-Bereich, Warnindikator pro Gerät

**Ist-Stand:** `EquipmentMaintenance.tsx`, Warnung im Ausgabe-Dialog von `SchoolEquipment.tsx` bei überfälliger Wartung (nicht blockierend, wie gefordert).

### 9.2 SHV-Konformitäts-Flag ✅

**Ziel:** Nur typengeprüftes Material für die Ausbildung markieren und darauf basierend die Materialquote (Abschnitt 4.3) berechnen.

**Akzeptanzkriterien:**

- Neues Attribut „SHV-typengeprüft“ pro Gerät, editierbar durch Schulleitung
- Filter in der Materialliste nach diesem Attribut

**Datenmodell:** `school_equipment.shv_type_approved` (Abschnitt 3, identisch mit 4.3)

**UI:** Material-Detailansicht

**Ist-Stand:** Attribut editierbar in `SchoolEquipment.tsx`; Filter in der Materialliste (alle/typengeprüft/nicht typengeprüft) bei der Phase-1-Prüfung als fehlend erkannt und nachgezogen.

## 10. Administration und Zahlung (Phase 4) ⬜ Nicht begonnen

### 10.1 Online-Zahlung bei Kursbuchung

**Ziel:** Zahlungsabwicklung direkt an die Kursanmeldung anknüpfen statt separater Rechnungsstellung im Nachgang.

**Akzeptanzkriterien:**

- Zahlungsanbindung (z. B. Stripe oder ein Schweizer TWINT-fähiger Anbieter) über Edge Function, analog zum bestehenden Muster serverseitiger Funktionen
- Zahlungsstatus pro `billing_item` sichtbar (offen/bezahlt/fehlgeschlagen)
- Kein Speichern von Kartendaten in Flyary selbst – ausschliesslich über den Zahlungsanbieter (PCI-Scope-Minimierung)

**Datenmodell:** neue Tabelle `course_payments` (Abschnitt 3), verknüpft mit bestehender `billing_items`

**UI:** Abrechnungs-Kachel im Flugschul-Bereich, Zahl-Button in der Schüler-Aufstellung

### 10.2 Digitale Vertragsunterschrift (inkl. protokollierte Einwilligungen)

**Ziel:** AGB/Haftungsausschluss/SHV-Weisungen rechtssicher genug bestätigen (siehe rechtliche Einordnung im Anforderungskatalog, Abschnitt 10). Deckt sowohl die Vertragsunterschrift als auch die SHV-Kenntnisnahme über dieselbe Tabelle ab, um Doppelspurigkeiten zu vermeiden. Ursprünglich Teil von Abschnitt 8.2 (Phase 3); da diese Version kein Minderjährigen-Handling mehr enthält, hierher verschoben und darauf reduziert.

**Akzeptanzkriterien:**

- Beim Onboarding bzw. bei der Kursbuchung werden Version des Dokuments, Zeitpunkt und bestätigendes Konto protokolliert (nicht nur ein Checkbox-Klick ohne Log)
- Historie einsehbar (welche Version wurde wann akzeptiert)

**Datenmodell:** neue Tabelle `consent_records` (Abschnitt 3)

**UI:** Onboarding-Flow bzw. Kursbuchung, zusätzlich einsehbar in den Kontoeinstellungen

### 10.3 Gutscheine und Rabatte

**Ziel:** Schnupperkurs-Gutscheine und Rabattcodes einlösbar machen.

**Akzeptanzkriterien:**

- Code-Erstellung durch Schulleitung mit Wert/Prozentsatz und Gültigkeitsdatum
- Einlösung bei der Kursbuchung, Verknüpfung mit dem einlösenden Konto zur Missbrauchsvermeidung

**Datenmodell:** neue Tabelle `vouchers` (Abschnitt 3)

**UI:** Abrechnungs-Kachel, Eingabefeld „Gutscheincode“ bei der Buchung

### 10.4 Strukturierter Rechnungsexport

**Ziel:** Übernahme der Abrechnungsdaten in die Buchhaltung der Schule erleichtern.

**Akzeptanzkriterien:**

- Export der Abrechnungspositionen als CSV in einem gängigen Format (z. B. kompatibel mit Schweizer Buchhaltungstools)
- Ergänzt die bereits bestehende PDF-Aufstellung pro Person (Kapitel 19), ersetzt sie nicht

**Datenmodell:** keine neue Tabelle, Export-Funktion über bestehende `billing_items`

## 11. Reporting und Auswertungen (Phase 5) ⬜ Nicht begonnen (4.4 bereits fertig, siehe dort)

Der SHV-Jahresbericht ist bereits unter 4.4 spezifiziert (Compliance-kritisch, Phase 1). Dieser Abschnitt ergänzt die betriebswirtschaftlichen Auswertungen für die Schulleitung. Die Voraussetzung `student_status_history` (Abschnitt 5.2) existiert jetzt bereits.

### 11.1 Auslastung und Erfolgsquote

**Ziel:** Sichtbar machen, wie ausgelastet Kursarten und Fluglehrer sind und wie viele Schüler vom Grundkurs bis zum Brevet gelangen.

**Akzeptanzkriterien:**

- Dashboard-Kachel mit: Auslastung pro Kursart und Zeitraum, Anzahl betreute Schüler pro Fluglehrer, Erfolgsquote (Anteil Grundkurs → Brevet), durchschnittliche Ausbildungsdauer
- Filterbar nach Jahr, Vorjahresvergleich wie bei den bestehenden Schulstatistiken (Kapitel 18)
- Nutzt den Schüler-Status (Abschnitt 5.2), um abgebrochene Ausbildungen korrekt aus der Erfolgsquote herauszurechnen

**Datenmodell:** aggregierende Abfragen über `student_status_history`, `training_progress`, `event_staff` – keine neue Tabelle

**UI:** Erweiterung der bestehenden Statistiken-Kachel im Flugschul-Bereich (Kapitel 18)

### 11.2 SHV-Mindestleistungs-Ampel

**Ziel:** Laufende Sichtbarkeit, ob die SHV-Mindestleistung (3 Brevetierte in 3 Jahren) erfüllt ist, statt nachträglicher Feststellung.

**Akzeptanzkriterien:**

- Ampel-Anzeige (grün/gelb/rot) in der Flugschul-Übersicht basierend auf abgeschlossenen Brevetierungen der letzten 3 Jahre

**Datenmodell:** aggregierende Abfrage über `training_progress`, keine neue Tabelle

## 12. Recht und Datenschutz – technische Umsetzung ⬜ Nicht begonnen

Die meisten rechtlichen Punkte aus Abschnitt 10 des Anforderungskatalogs sind bereits in die Features oben eingearbeitet (`consent_records`, siehe Abschnitt 10.2). Das ursprünglich hier mitgedachte Minderjährigen-Handling (`guardian_links`) ist nicht mehr Teil dieses Plans. Drei Punkte brauchen eine explizite technische Entscheidung vor der Umsetzung:

### 12.1 Aufbewahrung vs. Konto-Löschung

**Problem:** „Konto löschen entfernt alle Daten vollständig“ (Kapitel 26) kollidiert mit der SHV-Pflicht zur Nachweisführung (Kontrollblätter, Unfallmeldungen).

**Empfohlene Umsetzung:** Bei Konto-Löschung werden personenbezogene Daten gelöscht, schulseitig relevante Ausbildungsnachweise (Kontrollblatt-Fortschritt, Unfallmeldungen) jedoch anonymisiert (Personenbezug entfernt, Fallnummer bleibt) statt vollständig gelöscht. Erfordert eine Anpassung der bestehenden Lösch-Edge-Function um einen Anonymisierungsschritt für `training_progress` und `incident_reports`, bevor der eigentliche `DELETE` auf `profiles` läuft.

**Vor der Umsetzung klären:** gewünschte Aufbewahrungsdauer mit Vertical (Empfehlung: mind. so lange wie die SHV-Aufbewahrungspflicht besteht – im Workshop erfragen, siehe Anforderungskatalog Abschnitt 12).

### 12.2 Verantwortlichkeiten-Passus

**Problem:** Sobald mehrere Schulen eigene Schülerdaten bearbeiten, wird die Schule datenschutzrechtlich mitverantwortlich.

**Empfohlene Umsetzung:** Kein unmittelbarer Code-Impact, aber ein kurzer Verantwortlichkeiten-Passus (Betreiber ↔ Schule) sollte vor dem Onboarding weiterer Schulen als Textbaustein in den bestehenden AGB/Datenschutzerklärungs-Unterseiten (Kapitel 3, „Rechtliches“) ergänzt werden.

### 12.3 Zugriffsprotokollierung sensibler Daten

**Ziel:** Nachvollziehbarkeit, wer wann auf Notfall-/Gesundheitsdaten zugegriffen hat (verknüpft mit Abschnitt 8.3).

**Akzeptanzkriterien:**

- Jeder Zugriff auf Notfalldaten über den Schnellzugriff wird mit Zeitstempel und zugreifender Person protokolliert
- Protokoll ist nur für Schulleitung einsehbar, nicht für das übrige Team

**Datenmodell:** neue Tabelle `emergency_data_access_log` (`profile_id`, `accessed_by`, `accessed_at`, `context_event_id`)

## 13. Nicht-funktionale Anforderungen und Definition of Done

**Gilt für jedes Feature oben:**

- RLS-Policy pro neuer Tabelle geschrieben und getestet (Zugriff nur für Schulteam bzw. betroffene Person, nach bestehendem Muster)
- Texte in Deutsch, Französisch und Englisch vorhanden (auch Formularlabels, Fehlermeldungen, Push-Texte)
- Mobile-first umgesetzt, passt sich in den bestehenden Seitenrahmen (einheitliche Kopfzeile, Karten, Listenzeilen) ein
- Offline-Verhalten definiert: Was passiert ohne Netz – insbesondere bei Formularen wie Unfallmeldung oder Wetterentscheid, die im Feld ohne Empfang erfasst werden könnten (analog zum bestehenden Warteschlangen-Prinzip bei Flugdaten)
- Neue sicherheits- oder datenschutzrelevante Felder (Notfalldaten, Minderjährigen-Daten, Zahlungsdaten) sind explizit als solche gekennzeichnet und folgen dem bestehenden Schutzniveau
- Kein Feature erweitert Rechte über die Oberfläche – Rollen-/Funktionsprüfungen bleiben serverseitig

**Definition of Done pro Feature:**

- [ ] Migration erstellt und gegen bestehendes Schema getestet
- [ ] RLS-Policy vorhanden und mit mind. zwei Rollen (z. B. Schüler vs. Fluglehrer) verifiziert
- [ ] UI in bestehende Navigation/Kachel-Struktur integriert, nicht als Insel
- [ ] Akzeptanzkriterien aus dem jeweiligen Abschnitt erfüllt und manuell nachvollzogen
- [ ] Übersetzungen DE/FR/EN ergänzt
- [ ] Kurzer Eintrag in der App-Dokumentation (analog zum bestehenden Kapitelaufbau) ergänzt

**Ergänzung aus Phase 1/2 (Ist-Stand):** Zwei weitere Punkte haben sich in der Praxis als ebenso wichtig erwiesen und gehören ab sofort zur DoD dazu:

- [ ] Reine Geschäftslogik (Berechnungen, Datums-/Statuslogik, Sortierung) in ein `src/lib/*.ts`-Modul ausgelagert und mit Vitest-Tests abgedeckt, statt in der Komponente zu leben
- [ ] Nach Abschluss einer ganzen Phase: gezielte Akzeptanzkriterien-Prüfung aller Features dieser Phase (nicht nur des zuletzt gebauten) – hat in Phase 1 und 2 je mehrere reale Bugs in bereits als „fertig“ markierten Features aufgedeckt (siehe Abschnitt 14)

## 14. Hinweise für den Einsatz im Agentic Coding

- **Ein Feature pro Task/Prompt.** Jeder Unterabschnitt (z. B. 4.1, 5.3, 8.3) ist bewusst so geschnitten, dass er als einzelner Auftrag an den Coding-Agenten funktioniert – inklusive Ziel, Akzeptanzkriterien und betroffener Tabellen. Nicht mehrere Abschnitte gleichzeitig beauftragen, das erschwert Review und Rollback.
- **Reihenfolge innerhalb einer Phase beachten**, wo Abhängigkeiten bestehen: z. B. 5.1 (Ausrüstungscheck) vor 4.3 (Materialquoten-Check), 6.1 (Verfügbarkeit) vor 7.2 (Ersatztermin-Vorschlag).
- **Vor jedem Feature**: den Agenten das aktuelle Supabase-Schema (`supabase db dump` oder äquivalent) sowie die betroffenen bestehenden Dateien/Komponenten einsehen lassen, statt blind auf die hier vorgeschlagenen Tabellennamen zu vertrauen – dieses Dokument ist ein fachliches Zielbild, keine verbindliche DDL.
- **Migrationen einzeln committen**, mit Bezug auf die Abschnittsnummer dieses Dokuments in der Commit-Message (erleichtert später die Rückverfolgung zum Anforderungskatalog).
- **RLS zuerst testen, dann UI bauen** – falsche Berechtigungen sind in einer App mit Minderjährigen- und Gesundheitsdaten das grösste Risiko; ein Feature gilt erst als fertig, wenn ein Test mit einer nicht-berechtigten Rolle den Zugriff nachweislich verweigert.
- **Bei Unsicherheit über Vertical-spezifische Details** (z. B. genaue Kursbezeichnungen, Zahlungsanbieter-Wahl) den Fragenkatalog aus Abschnitt 12 des Anforderungskatalogs zuerst klären, statt Annahmen im Code zu fixieren.

### Erkenntnisse aus der Umsetzung von Phase 1 und Phase 2

Die folgenden Punkte haben sich erst beim tatsächlichen Bauen gezeigt und sind nicht aus dem ursprünglichen Anforderungskatalog ableitbar. Sie gelten ab sofort genauso verbindlich wie die Punkte oben.

- **Migrationsordner:** Es gibt `supabase/migrations/` (historisch, plus ein versehentliches Phase-1-Duplikat, entstanden durch parallele Arbeit auf zwei Branches ohne Kenntnis voneinander) und `drizzle/migrations/`. **Neue Migrationen ab Phase 1 der Flugschul-Erweiterungen gehören ausschliesslich in `drizzle/migrations/`**, fortlaufend nummeriert (`000N_beschreibung.sql`), inklusive Journal-/Snapshot-Eintrag unter `drizzle/migrations/meta/`. Bei Unsicherheit über den tatsächlichen DB-Zustand (kein Zugriff auf eine Migrations-Tracking-Tabelle): Migrationen so schreiben, dass sie unabhängig vom Ausgangszustand zu einem eindeutigen Ergebnis führen (`DROP POLICY IF EXISTS` + Neuanlage statt Annahmen über den bisherigen Zustand), siehe `0004_reconcile_phase1_rls.sql` als Vorlage.
- **Tabellennamen im Plan schlagen manchmal die falsche bestehende Tabelle vor.** Zweimal passiert (6.2: `flight_coach_notes` statt `student_day_notes`; das grundsätzliche Risiko besteht bei jedem Feature, das auf „bestehende X-Notizen/-Tabelle“ verweist). Vor der Umsetzung immer prüfen, ob es bereits eine naheliegendere, fachlich besser passende Struktur gibt, statt den im Plan genannten Namen blind zu übernehmen – und die Abweichung dokumentieren (README-Abschnitt pro Feature, wie in diesem Repo etabliert).
- **Clientseitig berechnete Warnungen nur so weit vertrauen, wie der Betrachter die zugrunde liegenden Daten laut RLS auch sehen darf.** Fund: Eine Zertifikats-Warnung in `EventStaff.tsx` wurde für jeden Betrachter berechnet, aber `instructor_certifications` ist nur für Staff/den Zertifikats-Inhaber lesbar – Schüler bekamen dadurch immer „kein gültiges Zertifikat“ angezeigt, weil ihre Abfrage leer zurückkam, nicht weil es stimmte. Bei jeder neuen clientseitigen Warnung/Berechnung: prüfen, wer sie sieht, und ob diese Person die Eingabedaten überhaupt lesen darf.
- **Bestehende, app-weite Enums nicht leichtfertig um schulspezifische Werte erweitern.** `flight_events.status` (`event_status`-Enum) wird von allen Gruppentypen verwendet, nicht nur Flugschulen. Für 7.1 wurde bewusst eine eigene, schmale Tabelle (`event_weather_decisions`) mit gezieltem Ein-Weg-Sync in die beiden bereits vorhandenen, 1:1 entsprechenden Werte gebaut, statt einen vierten Enum-Wert einzuführen, der jede bestehende `status === 'confirmed'`/`'cancelled'`-Prüfung im ganzen Code hätte betreffen können.
- **Unterschiedliche Berechtigungsstufen brauchen unterschiedliche Helper-Funktionen.** `is_group_admin` (nur Admin-Rolle), `is_group_staff` (Admin + Fluglehrer + Schulleitung, **ohne** Starthelfer) und die neue `is_group_team_member` (zusätzlich Starthelfer) decken unterschiedliche Zielgruppen ab. Vor dem Schreiben einer neuen RLS-Policy genau prüfen, welche der drei tatsächlich gemeint ist – der Anforderungskatalog nennt oft „Fluglehrer/Startleiter“ gemeinsam, was `is_group_staff` allein nicht abdeckt.
- **Datum/Zeit-Felder sind eine wiederkehrende Fehlerquelle.** Mehrfach gefunden und behoben: `new Date("yyyy-mm-dd")` wird als UTC-Mitternacht geparst, nicht als lokale Zeit – bei Wochenberechnungen und Datumsvergleichen führt das je nach Zeitzone zu einer Tagesverschiebung. Ebenso: ein in UTC gespeicherter `timestamptz` darf beim Zurückschreiben in ein `<input type="datetime-local">` nicht als roher String-Präfix übernommen werden, sondern muss über `new Date(iso)` und lokale Getter (`getFullYear()`, `getHours()` etc.) zurückgerechnet werden. Immer mit Testfällen absichern, die nicht von der Zeitzone der CI/Entwicklungsmaschine abhängen (Round-Trip über eine lokal konstruierte `Date` statt eines hartkodierten Offsets).
- **Seiten ohne Realtime-Abo laden Daten nur einmal beim Öffnen.** Wenn eine Kind-Komponente einen Datensatz ändert, den die Elternseite ebenfalls in ihrem lokalen State hält (Beispiel: `EventWeatherDecision` ändert `flight_events.status`, `EventDetail` zeigt `event.status` an), muss die Kind-Komponente einen Callback anbieten, über den die Elternseite ihren State aktualisiert – sonst zeigt die Seite bis zum manuellen Neuladen veraltete Daten.
- **„Kein hartes Blockieren“ heisst wörtlich keine deaktivierten Bedienelemente**, nur visuelle Hinweise (Badge, Farbe, Text). Die fachliche Entscheidungshoheit bleibt beim Team – wenn ein Akzeptanzkriterium das explizit fordert (z. B. 5.3), braucht es deshalb auch keinen separaten „Freigabe aufheben“-Mechanismus: es gibt nichts, das aufgehoben werden müsste.
- **Reine Logik konsequent in `src/lib/*.ts` auslagern und mit Vitest testen**, UI-Komponenten bleiben dünne Aufrufer. Hat sich über die gesamte Umsetzung bewährt (u. a. `instructor-availability.ts`, `weather-decision.ts`, `handoff-notes.ts`, `student-csv.ts`) und macht Regressionen bei der nächsten Akzeptanzkriterien-Prüfung sofort sichtbar, statt sie in einer grossen Komponente zu verstecken.
- **Nach jeder abgeschlossenen Phase eine eigene, gezielte Akzeptanzkriterien-Prüfung aller Features dieser Phase einplanen** (nicht nur Selbsttest des zuletzt gebauten Features). Hat in Phase 1 mehrere Fehler aufgedeckt (u. a. eine fehlende Vorfallmeldungs-Schnellzugriff-Verdrahtung, doppelte/widersprüchliche Migrationen, einen Vokabular-Mismatch im Jahresbericht) und in Phase 2 drei weitere (RLS-Sichtbarkeitslücke, Zeitzonenfehler, veraltete Statusanzeige) – jeweils in Features, die zuvor bereits als „fertig, Tests grün“ galten. Automatisierte Tests decken die reine Logik ab, nicht ob die richtigen Daten überhaupt beim richtigen Betrachter ankommen.
