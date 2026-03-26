

# Flugschul-Management — Schüler-Lehrer Interaktion verbessern

## Analyse des Screenshots und der Anforderungen

Der Screenshot zeigt eine typische Telegram-Nachricht einer Flugschule mit strukturiertem Flugtag-Briefing: Status, Treffpunkt/Abfahrt mit Zeiten, Fluggebiet, Tagesthema, Briefing-Aufgaben (Meteo, Tagesthema zugewiesen an Schüler), und Flugvorbereitung (DABS, Wetter, NowCasting, Fluggebiet).

## Bestehende Infrastruktur

- `groups` mit `group_type: "school" | "pilot_group"` und Rollen `admin | member`
- `flight_events` mit Feldern für Datum, Treffpunkt, Instructor, Beschreibung
- `event_signups` für Teilnehmeranmeldung
- `training_categories/items/progress` für SHV-Trainingstracker
- `flight_training_items` für Coach-Feedback auf Flüge
- `profiles` mit `flight_school`, `exam_theory_date`, `exam_practical_date`

---

## Phase 1: Ausbildungsstufen im Training-Tracker

### DB-Migration
- Neue Tabelle `training_category_levels` mit Spalte `level` (enum: `grundkurs`, `brevetkurs`, `siku`, `weiterbildung`) als Zuordnung pro Kategorie
- Alternativ einfacher: neues Feld `training_level` auf `training_categories` (text, nullable), Werte wie "grundkurs", "brevetkurs", "siku", "pilot"
- Neues Feld `training_level` auf `profiles` — speichert aktuellen Ausbildungsstand des Users ("grundkurs", "brevetkurs", "pilot")

### UI-Änderungen
- **Training.tsx**: Filter-Tabs oben (Grundkurs / Brevetkurs / SiKu / Alle) — zeigt nur relevante Kategorien
- **Profile/Settings**: Dropdown "Aktueller Ausbildungsstand" — steuert Default-Filter im Training

---

## Phase 2: Flugtag-Planung erweitern (Briefing-Aufgaben)

### DB-Migration
- Neue Tabelle `event_briefing_tasks`:
  - `id`, `event_id` (FK), `task_type` (text: "meteo", "tagesthema", "fluggebiet", "maneuver", "custom")
  - `label` (text), `assigned_user_id` (FK nullable), `sort_order`
- Neue Felder auf `flight_events`:
  - `flight_area` (text) — Fluggebiet
  - `day_topic` (text) — Tagesthema
  - `departure_info` (text) — Treffpunkt/Abfahrt Details (mehrzeilig)
  - `flight_prep_notes` (text) — Flugvorbereitung
- Neue Tabelle `event_maneuvers`:
  - `id`, `event_id` (FK), `training_item_id` (FK), `sort_order`

### UI-Änderungen
- **EventForm.tsx** erweitern:
  - Neue Felder: Fluggebiet, Tagesthema, Abfahrt-Info (Textarea), Flugvorbereitung
  - Abschnitt "Briefing-Aufgaben": Dynamische Liste, jede Aufgabe hat Label + Zuweisung (Dropdown aus angemeldeten Schülern)
  - Abschnitt "Geplante Manöver": Multi-Select aus training_items
- **EventDetail.tsx** erweitern:
  - Briefing-Aufgaben mit Namen der zugewiesenen Schüler anzeigen
  - Geplante Manöver-Liste

---

## Phase 3: Telegram-Text Generator

### UI-Änderung
- **EventDetail.tsx**: Neuer Button "Telegram-Text kopieren" (nur für Admin/Coach)
- Generiert formatierten Text im Stil des Screenshots:

```text
Höhenflüge Sonntag 22.03.2026 finden statt, sofern kein Update bis 06:00 erfolgt.

Treffpunkt/Abfahrt Bimano
08:30 Base wer Material braucht (-> PN)
08:40 Abfahrt Bimano
...

Fluggebiet: Interlaken

Tagesthema: Effizient sein & Wunschkonzert.

Briefing:
Meteo -> Kevin
Tagesthema-> David

Flugvorbereitung:
1. DABS anschauen! https://www.skybriefing.com/dabs
2. Wetter -> von der Grosswetterlage zu lokalen 'Delikatessen'
...
```

- Text wird aus den Event-Feldern + Briefing-Aufgaben + Teilnehmernamen zusammengesetzt
- Button kopiert Text in Zwischenablage mit `navigator.clipboard.writeText()`

---

## Phase 4: Lehrer-Dashboard für Schülerflüge am Flugtag

### DB-Änderung
- Feld `event_id` (FK nullable) auf `flights` Tabelle — verknüpft einen Flug mit einem Flugtag

### UI-Änderungen
- **EventDetail.tsx**: Neuer Tab/Abschnitt "Schülerflüge" (nur für Admin)
  - Zeigt alle Flüge der Gruppenmitglieder am Event-Datum
  - Pro Flug: Schülername, Start/Landeplatz, Dauer, trainierte Manöver
  - Coach kann direkt Bewertung (Sterne + Kommentar) pro Manöver vergeben (nutzt bestehende `flight_training_items`)
- **FlightForm.tsx**: Wenn ein Flug einer Schulgruppe zugeordnet ist und ein Event am selben Tag existiert, automatisch `event_id` setzen

---

## Phase 5: Lehrer-Schnellbewertung

### UI-Änderung
- **Neue Komponente** `CoachDayView.tsx`:
  - Übersicht aller Schülerflüge eines Flugtags
  - Kompakte Karten mit Expand für schnelle Sternebewertung
  - Batch-Modus: Mehrere Manöver für einen Flug auf einmal bewerten

---

## Zusammenfassung der Dateien

**Migration (1 SQL)**:
- ALTER `training_categories` ADD `training_level` text
- ALTER `profiles` ADD `training_level` text DEFAULT 'grundkurs'
- ALTER `flight_events` ADD `flight_area`, `day_topic`, `departure_info`, `flight_prep_notes`
- ALTER `flights` ADD `event_id` uuid REFERENCES flight_events
- CREATE TABLE `event_briefing_tasks`
- CREATE TABLE `event_maneuvers`
- UPDATE training_categories mit Level-Zuordnung
- RLS Policies

**Neue Dateien**:
- `src/components/TelegramTextGenerator.tsx`
- `src/components/EventBriefingTasks.tsx`
- `src/components/EventStudentFlights.tsx`

**Geänderte Dateien**:
- `src/pages/Training.tsx` — Level-Filter
- `src/pages/Profile.tsx` oder `Settings.tsx` — Ausbildungsstand-Dropdown
- `src/pages/EventForm.tsx` — Neue Felder + Briefing-Aufgaben + Manöver
- `src/pages/EventDetail.tsx` — Briefing, Manöver, Schülerflüge, Telegram-Button
- `src/pages/FlightForm.tsx` — Event-Verknüpfung
- `src/i18n/locales/{de,en,fr}.json`

---

## Empfohlene Reihenfolge

Ich empfehle schrittweise Umsetzung: Phase 2+3 zuerst (Flugtag-Planung + Telegram-Generator, da sofort sichtbarer Nutzen), dann Phase 1 (Training-Level), dann Phase 4+5 (Lehrer-Dashboard). Soll ich mit Phase 2+3 beginnen?

