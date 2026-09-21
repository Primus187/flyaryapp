# Umsetzungsplan: Flugschul-Erweiterungen für Flyary

2026-09-21 · @Someone

Dieses Dokument übersetzt den project/ce138141-fdda-49a8-b7a9-3e338e67ef48 in eine technische Spezifikation mit priorisiertem Umsetzungsplan – direkt nutzbar als Vorgabe für Agentic Coding (z. B. Claude Code) gegen die bestehende Flyary-Codebasis (React 18, TypeScript, Vite, Tailwind, shadcn, Supabase mit Row-Level-Security, react-leaflet, MapLibre GL JS).

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

| Phase | Fokus | Enthaltene Features | Begründung | Aufwand |
| --- | --- | --- | --- | --- |
| 1 | SHV-Compliance-Basis | Unfallmeldung, Fluglehrer-Zertifikats-Tracking, Materialquote-Check, Ausrüstungscheck im Onboarding, Wartungsfristen Material | Direktes regulatorisches Risiko bei Nichteinhaltung; baut nur auf bestehenden Tabellen `school_equipment`, `training_progress`, `profiles` auf | M |
| 2 | Schüler- und Team-Prozesse | Meilenstein-Freigaben im Kontrollblatt, Pausierungs-Status, Verfügbarkeitsplanung Team, Übergabenotizen, Geh/Nogo-Workflow, Ersatztermin-Vorschlag | Kerntätigkeit des Schulbetriebs; hoher Alltagsnutzen für Vertical | L |
| 3 | Minderjährige und Kommunikation | Eltern-Zugang, digitale Einverständniserklärung mit Protokollierung, Notfall-Schnellzugriff, Lesebestätigung, Team-Verfügbarkeitsumfrage | Rechtlich sensibel (Abschnitt 10 des Anforderungskatalogs), sollte vor breiterem Rollout an Minderjährige stehen | M |
| 4 | Administration und Zahlung | Online-Zahlung bei Kursbuchung, digitale Vertragsunterschrift, Gutscheine/Rabatte, strukturierter Rechnungsexport | Unabhängiges Teilsystem, benötigt externen Zahlungsanbieter – grösster Integrationsaufwand | L |
| 5 | Reporting und Wetter-Integration | SHV-Jahresbericht-Export, Auslastungs-/Erfolgsquote-Dashboards, Fluggebiets-Wetter-Matching | Baut auf den Daten aus Phase 1–3 auf, liefert erst dann verlässliche Kennzahlen | S–M |

Empfehlung: Phase 1 und 2 vor dem nächsten Austausch mit Vertical prototypisch umsetzen – das macht den Workshop (Abschnitt 12 des Anforderungskatalogs) konkreter, weil Vertical an echten Bildschirmen statt an Konzepten Feedback geben kann.

## 3. Datenmodell-Erweiterungen

Logisches Modell als Ausgangspunkt – vor der Umsetzung gegen das tatsächliche Supabase-Schema (54 bestehende Tabellen) abgleichen und als Migration anlegen. Neue Tabellen folgen dem bestehenden Muster: eigene Tabelle pro Fachkonzept, RLS-Policy je Tabelle, keine Rollen-/Berechtigungsfelder im `profiles`-Datensatz.

| Neue/erweiterte Tabelle | Gehört zu Gruppe | Zweck | Wichtige Felder | Bezug |
| --- | --- | --- | --- | --- |
| `instructor_certifications` | Flugschule | Zertifikate pro Teammitglied mit Gültigkeit | `profile_id`, `cert_type` (Fluglehrer/Startleiter/Biplace1-3/Nothelfer), `issued_at`, `valid_until`, `teaching_days_since_renewal` | 4, 6 |
| `incident_reports` | Flugschule | Unfall-/Vorfallmeldung mit SHV-Frist | `school_id`, `event_id`, `student_id`, `reported_by`, `occurred_at`, `shv_deadline` (`occurred_at` + 10 Tage), `submitted_at`, `status` | 4 |
| `equipment_maintenance` | Flugschule (ergänzt `school_equipment`) | Prüf-/Wartungsfälligkeiten pro Gerät | `equipment_id`, `maintenance_type`, `due_at`, `completed_at`, `completed_by` | 9 |
| `school_equipment` (erweitert) | Flugschule | – | + Feld `shv_type_approved: boolean` | 4, 9 |
| `student_status_history` | Ausbildung | Nachvollziehbarer Status je Schüler | `student_id`, `status` (aktiv/pausiert/abgebrochen), `reason`, `changed_at`, `changed_by` | 5 |
| `training_categories` (erweitert) | Ausbildung | Meilenstein-Gating | + Feld `unlocks_after_category_id` (self-referenzierend) | 5 |
| `instructor_availability` | Flugschule | Verfügbarkeit pro Teammitglied und Tag | `profile_id`, `school_id`, `date`, `available`, `note` | 6 |
| `event_weather_decisions` | Termine (ergänzt `flight_events`) | Strukturierter Geh/Nogo-Entscheid | `event_id`, `decision_deadline`, `status` (bestätigt/wetterabhängig/abgesagt), `decided_by`, `decided_at`, `note` | 7 |
| `guardian_links` | Piloten | Verknüpfung minderjährige Schüler – Erziehungsberechtigte | `student_profile_id`, `guardian_name`, `guardian_email`, `guardian_phone`, `relation` | 8, 12 |
| `consent_records` | Piloten | Protokollierte Einwilligungen (Beweiskraft, siehe Abschnitt 12) | `profile_id`, `consent_type` (AGB/Haftungsausschluss/Foto/Datenbearbeitung), `version`, `accepted_at`, `accepted_by` | 5, 8, 12 |
| `announcement_read_receipts` | Termine (ergänzt `event_messages`) | Lesebestätigung sicherheitsrelevanter Ankündigungen | `announcement_id`, `profile_id`, `read_at` | 8 |
| `team_polls`, `team_poll_responses` | Flugschule | Kurze Verfügbarkeitsabfragen im Team | `question`, `closes_at`; `poll_id`, `profile_id`, `response` | 8 |
| `course_payments` | Flugschule (ergänzt `billing_items`) | Online-Zahlung pro Kursbuchung | `billing_item_id`, `amount`, `provider`, `provider_ref`, `status`, `paid_at` | 10 |
| `vouchers` | Flugschule | Gutscheine/Rabattcodes | `code`, `discount_type`, `value`, `valid_until`, `redeemed_by`, `redeemed_at` | 10 |
| `locations` (erweitert) | Infrastruktur | SHV-Fluggebietsstatus, Wetter-Matching | + Felder `shv_approved: boolean`, `wind_sock: boolean`, `optimal_wind_directions: text[]`, `usage_permission_ref` | 4, 7 |

Alle neuen Tabellen erhalten RLS-Policies nach bestehendem Muster (Zugriff nur für Schulteam bzw. betroffene Person selbst); Datenschutz-relevante Tabellen (`guardian_links`, `consent_records`, Notfalldaten-Zugriff) benötigen eine eigene, engere Policy analog zu den bestehenden Notfall-/Gesundheitsdaten.

## 4. SHV-Compliance (Phase 1)

### 4.1 Unfall-/Vorfallmeldung

**Ziel:** Meldung eines Vorfalls direkt aus Termin oder Flug auslösbar, mit Frist-Tracking gemäss SHV-Vorgabe (10 Tage).

**Akzeptanzkriterien:**

- Formularfelder: Datum/Zeit, beteiligte Personen, Hergang, ergriffene Massnahmen, betroffener Termin/Flug (optional verknüpft)
- Nach dem Anlegen zeigt die Übersicht einen Countdown „noch X von 10 Tagen“ bis zur SHV-Meldefrist
- Status-Feld (offen/eingereicht) mit Datum der Einreichung
- Export als PDF in einem an das offizielle SHV-Formular angelehnten Layout
- Nur für Schulleitung und Fluglehrer sichtbar/erstellbar (RLS wie bei bestehenden Coach-Notizen)

**Datenmodell:** neue Tabelle `incident_reports` (Abschnitt 3)

**UI:** Neuer Eintrag im Flugschul-Bereich („Übersicht“-Kachel oder eigene Kachel „Sicherheit“), zusätzlich Schnellzugriff „Vorfall melden“ aus dem Termin-Kontextmenü

### 4.2 Zertifikats-Tracking Team

**Ziel:** Ablaufdaten von Fluglehrer-/Startleiter-/Biplace-Zertifikaten sichtbar machen, bevor sie zum Compliance-Problem werden.

**Akzeptanzkriterien:**

- Pro Teammitglied eine Liste der Zertifikate mit Ablaufdatum
- Automatische Berechnung der seit letzter Rezertifizierung geleisteten Unterrichtstage aus `event_staff`/`flight_events`
- Warnung in der Team-Übersicht, wenn ein Zertifikat innerhalb von 90 Tagen abläuft oder die Unterrichtstage-Quote (15 Tage/3 Jahre) nicht erreicht ist
- Warnung bei der Termin-Einteilung, wenn die eingeteilten Personen die SHV-Mindestbesetzung (Abschnitt 1 des Anforderungskatalogs) nicht erfüllen

**Datenmodell:** neue Tabelle `instructor_certifications`

**UI:** Team-Kachel im Flugschul-Bereich, Detailansicht pro Person

### 4.3 Materialquoten-Check

**Ziel:** Automatische Prüfung, ob für einen Kurstermin genügend Schulmaterial vorhanden ist (SHV: 2 Systeme pro 3 Schüler in den ersten 3 Kurstagen).

**Akzeptanzkriterien:**

- Bei der Termin-Einteilung wird die Anzahl Anmeldungen gegen die Anzahl verfügbarer, `shv_type_approved`-markierter Schirmsysteme im Lager geprüft
- Bei Unterschreitung erscheint ein Hinweis (kein Blocker, da Schüler auch eigenes Material mitbringen können)

**Datenmodell:** `school_equipment.shv_type_approved` (neues Feld, Abschnitt 3), Abgleich mit `equipment_assignments` und `event_signups`

**UI:** Hinweis in der Tagesorganisation des Termins

### 4.4 Jahresbericht-Export

**Ziel:** Die vom SHV bis 28. Februar verlangten Kennzahlen auf Knopfdruck erzeugen.

**Akzeptanzkriterien:**

- Export (PDF oder CSV) mit: Anzahl Schüler nach Kursart, abgeschlossene Brevetierungen im Berichtsjahr, Betriebstage pro Monat, Team-Zusammensetzung mit Zertifikatsstatus
- Filterbar nach Kalenderjahr
- Erinnerung/Badge im Flugschul-Bereich ab Januar, solange der Bericht des Vorjahres nicht als „eingereicht“ markiert ist

**Datenmodell:** aggregierende Abfrage über bestehende Tabellen (`flight_events`, `training_progress`, `instructor_certifications`), keine neue Tabelle nötig; optional `annual_report_submissions` (Jahr, `submitted_at`) zur Nachverfolgung

**UI:** Statistik-Kachel des Flugschul-Bereichs, neuer Abschnitt „Jahresbericht“

## 5. Schülerverwaltung (Phase 1–2)

### 5.1 Ausrüstungscheck im Onboarding (Phase 1)

**Ziel:** Nur Schüler mit vollständiger, konformer Ausrüstung zum Höhenflug zulassen (SHV-Pflicht).

**Akzeptanzkriterien:**

- Checkliste im Schüler-Onboarding: Helm, Schuhwerk, Gurtzeug mit Protektor/Airbag, Rettungsgerät – je als vorhanden/fehlt markierbar durch Fluglehrer
- Solange nicht vollständig abgehakt, erscheint ein Hinweis bei der Anmeldung zu einem Höhenflug-Termin (kein hartes Blockieren, da Leihmaterial möglich ist)

**Datenmodell:** neues Feld an bestehender Schülerfunktion oder eigene Tabelle `equipment_checks` (`student_id`, `item`, `checked_at`, `checked_by`)

**UI:** Ausbildungsplatz-Ansicht (Kapitel 13 der App-Doku), neuer Reiter „Ausrüstung“

### 5.2 Pausierungs-Status (Phase 2)

**Ziel:** Wiedereinstieg sauber vom Neueinstieg unterscheiden, Auswertungen (Abschnitt 11) nicht verfälschen.

**Akzeptanzkriterien:**

- Status pro Schüler: aktiv / pausiert / abgebrochen, mit Grund und Datum
- Statuswechsel durch Schulleitung/Fluglehrer, sichtbar in der Personenübersicht
- Pausierte/abgebrochene Schüler erscheinen nicht mehr in aktiven Terminlisten, bleiben aber im Flugbuch/Kontrollblatt erhalten

**Datenmodell:** neue Tabelle `student_status_history` (Abschnitt 3)

**UI:** Personenübersicht des Flugschul-Bereichs

### 5.3 Meilenstein-Freigaben im Kontrollblatt (Phase 2)

**Ziel:** Verhindern, dass ein Schüler zu einer Übung zugelassen wird, bevor die Voraussetzung erfüllt ist (z. B. Höhenflug erst nach abgeschlossenem Grundkurs).

**Akzeptanzkriterien:**

- Ausbildungskategorien können eine Voraussetzungs-Kategorie referenzieren
- Im Kontrollblatt wird eine gesperrte Kategorie visuell markiert, bis die Voraussetzung zu 100 % erfüllt ist
- Freigabe bleibt manuell durch den Fluglehrer aufhebbar (kein hartes Blockieren, Fluglehrer behält fachliche Entscheidungshoheit)

**Datenmodell:** `training_categories.unlocks_after_category_id` (Abschnitt 3)

**UI:** Bestehende Kontrollblatt-Ansicht (Kapitel 13), ergänzt um Sperr-/Freigabe-Indikator

### 5.4 Digitale Einverständniserklärung und Eltern-Verknüpfung (Phase 3)

Siehe Abschnitt 8 (Kommunikation) und Abschnitt 12 (Recht) – technisch eng verknüpft mit `guardian_links` und `consent_records`.

## 6. Team- und Fluglehrerorganisation (Phase 2)

### 6.1 Verfügbarkeitsplanung

**Ziel:** Team trägt Verfügbarkeit im Voraus ein, statt nur reaktiv pro Termin eingeteilt zu werden.

**Akzeptanzkriterien:**

- Kalenderansicht pro Teammitglied: verfügbar / nicht verfügbar / unsicher, optional mit Notiz
- Bei der Termin-Einteilung werden nur als verfügbar markierte Personen vorgeschlagen
- Kombiniert mit dem Zertifikats-Tracking (Abschnitt 4.2): Warnung, wenn für einen Termin keine Person mit gültigem Fluglehrer-Zertifikat verfügbar ist

**Datenmodell:** neue Tabelle `instructor_availability` (Abschnitt 3)

**UI:** Team-Kachel im Flugschul-Bereich, neue Wochen-/Monatsansicht

### 6.2 Übergabenotizen zwischen Fluglehrern

**Ziel:** Strukturierte „nächste Schritte“ pro Schüler, sichtbar für das ganze Team, nicht nur für den zuletzt unterrichtenden Fluglehrer.

**Akzeptanzkriterien:**

- Bestehende Coach-Notizen (`flight_coach_notes`) erhalten ein Flag „nächster Schritt“, das in der Schüler-Übersicht prominent angezeigt wird
- Historie bleibt erhalten (keine Überschreibung früherer Notizen)

**Datenmodell:** Ergänzung `flight_coach_notes.is_next_step: boolean`, kein neues Tabellenobjekt nötig

**UI:** Schüler-Detailansicht im Ausbildungsplatz

### 6.3 Interner Team-Kanal

**Ziel:** Kommunikation zwischen Fluglehrern/Startleitern trennen vom Termin-Chat mit Schülern.

**Akzeptanzkriterien:**

- Eigener Chat-Kanal pro Schule (nicht pro Termin), sichtbar nur für Teamfunktionen
- Gleiche Push-Mechanik wie bestehender Termin-Chat

**Datenmodell:** Wiederverwendung des bestehenden `group_messages`-Musters mit einer dedizierten „Team“-Gruppe pro Schule statt neuer Tabelle

## 7. Terminplanung und Wetterentscheidung (Phase 2, Wetter-Matching Phase 5)

### 7.1 Strukturierter Geh/Nogo-Entscheid

**Ziel:** Klarer, fristgebundener Entscheid statt informeller Ankündigung.

**Akzeptanzkriterien:**

- Pro Termin optional eine Entscheid-Deadline (z. B. „Vorabend 18 Uhr“) hinterlegbar
- Status bestätigt / wetterabhängig / abgesagt, änderbar durch Fluglehrer/Schulleitung
- Statuswechsel löst automatisch eine Push-Ankündigung an alle Angemeldeten aus (Wiederverwendung des bestehenden Ankündigungs-Mechanismus, Kapitel 10)
- Erinnerung an die Deadline, falls noch kein Entscheid erfasst wurde

**Datenmodell:** neue Tabelle `event_weather_decisions` (Abschnitt 3)

**UI:** Termin-Detailansicht, neuer Status-Bereich oberhalb des Tagesprogramms

### 7.2 Ersatztermin-Vorschlag bei Absage

**Ziel:** Bei Absage automatisch einen Alternativtermin basierend auf Team-Verfügbarkeit (Abschnitt 6.1) vorschlagen.

**Akzeptanzkriterien:**

- Bei Status „abgesagt“ schlägt das System die nächsten 1–3 Tage mit verfügbarem Team vor
- Schulleitung kann den Vorschlag mit einem Klick als neuen Termin (Duplikat-Funktion, bereits vorhanden) übernehmen

**Datenmodell:** keine neue Tabelle, Abfrage über `instructor_availability` und bestehende `flight_events`

**UI:** Hinweis im Termin nach Statuswechsel auf „abgesagt“

### 7.3 Fluggebiets-Wetter-Matching (Phase 5)

**Ziel:** Pro Fluggebiet anzeigen, ob die aktuelle Windrichtung passt.

**Akzeptanzkriterien:**

- `locations.optimal_wind_directions` (Abschnitt 3) wird gegen die bestehende Windy-Einbindung (Kapitel 17) abgeglichen
- Einfache Ampel-Anzeige (passend/grenzwertig/ungeeignet) auf der Orte- und Wetterseite
- Keine Speicherung von Wetterdaten in Flyary selbst – Grundsatz aus Kapitel 17 bleibt bestehen, Abgleich erfolgt zur Laufzeit

**Datenmodell:** `locations.optimal_wind_directions` (Abschnitt 3), keine neue Tabelle

## 8. Kommunikation (Phase 2–3)

### 8.1 Eltern-/Erziehungsberechtigten-Verknüpfung (Phase 3)

**Ziel:** Bei minderjährigen Schülern Termin-Infos und Wetterentscheide zusätzlich an Erziehungsberechtigte kommunizieren, ohne ihnen vollen App-Zugang zu geben.

**Akzeptanzkriterien:**

- Erziehungsberechtigte werden als Kontakt zu einem minderjährigen Schülerprofil erfasst (Name, E-Mail/Telefon, Beziehung)
- Push-/E-Mail-Kopie von sicherheitsrelevanten Ankündigungen (Wetterentscheid, Treffpunktänderung) an hinterlegte Erziehungsberechtigte, ohne eigenes Login
- Umsetzung als E-Mail-Fallback (Edge Function) reicht für den Start; ein eigener Leseblick später optional

**Datenmodell:** neue Tabelle `guardian_links` (Abschnitt 3)

**UI:** Schülerprofil-Ergänzung im Onboarding (Abschnitt 5.1)

### 8.2 Digitale Einverständniserklärung mit Protokollierung (Phase 3)

**Ziel:** Nachweisbare Kenntnisnahme von SHV-Weisungen, AGB und Haftungsausschluss (SHV-Pflicht, siehe Anforderungskatalog Abschnitt 1 und 10).

**Akzeptanzkriterien:**

- Beim Onboarding werden Version des Dokuments, Zeitpunkt und bestätigendes Konto protokolliert (nicht nur ein Checkbox-Klick ohne Log)
- Bei Minderjährigen erfolgt die Bestätigung durch das verknüpfte Erziehungsberechtigten-Konto bzw. wird als „im Namen von“ protokolliert
- Historie einsehbar (welche Version wurde wann akzeptiert)

**Datenmodell:** neue Tabelle `consent_records` (Abschnitt 3)

**UI:** Onboarding-Flow, zusätzlich einsehbar in den Kontoeinstellungen

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

## 9. Material- und Ausrüstungsverwaltung (Phase 1)

### 9.1 Wartungs- und Prüffristen

**Ziel:** Verhindern, dass ein überfälliges Gerät (z. B. Rettungsgerät ohne aktuelle Packung) versehentlich ausgegeben wird.

**Akzeptanzkriterien:**

- Pro Gerät im Lager (`school_equipment`) ein oder mehrere Fälligkeitsdaten mit Typ (Rettungsgerät-Neupacken, Gurtzeug-Check, Schirm-Check)
- Warnung bei der Ausgabe eines Geräts mit überfälliger Prüfung (analog zum bestehenden Unterhaltsintervall-Konzept bei privaten Schirmen, Kapitel 23)
- Übersicht „Fällig in den nächsten 30 Tagen“ für die Materialverantwortlichen

**Datenmodell:** neue Tabelle `equipment_maintenance` (Abschnitt 3)

**UI:** Material-Kachel im Flugschul-Bereich, Warnindikator pro Gerät

### 9.2 SHV-Konformitäts-Flag

**Ziel:** Nur typengeprüftes Material für die Ausbildung markieren und darauf basierend die Materialquote (Abschnitt 4.3) berechnen.

**Akzeptanzkriterien:**

- Neues Attribut „SHV-typengeprüft“ pro Gerät, editierbar durch Schulleitung
- Filter in der Materialliste nach diesem Attribut

**Datenmodell:** `school_equipment.shv_type_approved` (Abschnitt 3, identisch mit 4.3)

**UI:** Material-Detailansicht

## 10. Administration und Zahlung (Phase 4)

### 10.1 Online-Zahlung bei Kursbuchung

**Ziel:** Zahlungsabwicklung direkt an die Kursanmeldung anknüpfen statt separater Rechnungsstellung im Nachgang.

**Akzeptanzkriterien:**

- Zahlungsanbindung (z. B. Stripe oder ein Schweizer TWINT-fähiger Anbieter) über Edge Function, analog zum bestehenden Muster serverseitiger Funktionen
- Zahlungsstatus pro `billing_item` sichtbar (offen/bezahlt/fehlgeschlagen)
- Kein Speichern von Kartendaten in Flyary selbst – ausschliesslich über den Zahlungsanbieter (PCI-Scope-Minimierung)

**Datenmodell:** neue Tabelle `course_payments` (Abschnitt 3), verknüpft mit bestehender `billing_items`

**UI:** Abrechnungs-Kachel im Flugschul-Bereich, Zahl-Button in der Schüler-Aufstellung

### 10.2 Digitale Vertragsunterschrift

**Ziel:** AGB/Haftungsausschluss rechtssicher genug bestätigen (siehe rechtliche Einordnung im Anforderungskatalog, Abschnitt 10).

**Akzeptanzkriterien:** siehe Abschnitt 8.2 – dieselbe `consent_records`-Tabelle deckt Vertragsdokumente und SHV-Kenntnisnahme gemeinsam ab, um Doppelspurigkeiten zu vermeiden

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

## 11. Reporting und Auswertungen (Phase 5)

Der SHV-Jahresbericht ist bereits unter 4.4 spezifiziert (Compliance-kritisch, Phase 1). Dieser Abschnitt ergänzt die betriebswirtschaftlichen Auswertungen für die Schulleitung.

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

## 12. Recht und Datenschutz – technische Umsetzung

Die meisten rechtlichen Punkte aus Abschnitt 10 des Anforderungskatalogs sind bereits in die Features oben eingearbeitet (`consent_records`, `guardian_links`). Drei Punkte brauchen eine explizite technische Entscheidung vor der Umsetzung:

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

## 14. Hinweise für den Einsatz im Agentic Coding

- **Ein Feature pro Task/Prompt.** Jeder Unterabschnitt (z. B. 4.1, 5.3, 8.2) ist bewusst so geschnitten, dass er als einzelner Auftrag an den Coding-Agenten funktioniert – inklusive Ziel, Akzeptanzkriterien und betroffener Tabellen. Nicht mehrere Abschnitte gleichzeitig beauftragen, das erschwert Review und Rollback.
- **Reihenfolge innerhalb einer Phase beachten**, wo Abhängigkeiten bestehen: z. B. 5.1 (Ausrüstungscheck) vor 4.3 (Materialquoten-Check), 6.1 (Verfügbarkeit) vor 7.2 (Ersatztermin-Vorschlag), 8.2 (Consent-Tabelle) vor 10.2 (Vertragsunterschrift).
- **Vor jedem Feature**: den Agenten das aktuelle Supabase-Schema (`supabase db dump` oder äquivalent) sowie die betroffenen bestehenden Dateien/Komponenten einsehen lassen, statt blind auf die hier vorgeschlagenen Tabellennamen zu vertrauen – dieses Dokument ist ein fachliches Zielbild, keine verbindliche DDL.
- **Migrationen einzeln committen**, mit Bezug auf die Abschnittsnummer dieses Dokuments in der Commit-Message (erleichtert später die Rückverfolgung zum Anforderungskatalog).
- **RLS zuerst testen, dann UI bauen** – falsche Berechtigungen sind in einer App mit Minderjährigen- und Gesundheitsdaten das grösste Risiko; ein Feature gilt erst als fertig, wenn ein Test mit einer nicht-berechtigten Rolle den Zugriff nachweislich verweigert.
- **Bei Unsicherheit über Vertical-spezifische Details** (z. B. genaue Kursbezeichnungen, Zahlungsanbieter-Wahl) den Fragenkatalog aus Abschnitt 12 des Anforderungskatalogs zuerst klären, statt Annahmen im Code zu fixieren.
