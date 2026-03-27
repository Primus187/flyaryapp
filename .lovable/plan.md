

# Flugschul-Management Hub — Zentrales Schulungscockpit

## Analyse des aktuellen Zustands

Das **Ausbildungsblatt** (CoachDayView) ist aktuell nur innerhalb eines einzelnen Events sichtbar (EventDetail → ganz unten, nur für Admins). Es ist schwer zu finden und nicht als eigenständiges Management-Tool zugänglich. Die Flugschul-Funktionen sind über mehrere Seiten verstreut:

- **Events** → Flugtag-Planung, Briefing, Telegram-Generator
- **EventDetail** → Ausbildungsblatt (CoachDayView), Schüler-Feedback
- **Groups** → Mitglieder, Einladungen
- **Training** → SHV-Prüfungsmanöver (persönlicher Fortschritt)

Es fehlt ein **zentraler Ort** für Fluglehrer, um alle schulrelevanten Daten zu überblicken.

---

## Lösung: Flugschul-Dashboard (`/school`)

Eine neue Seite, die nur für Admins von Flugschul-Gruppen (`group_type = 'flight_school'`) sichtbar ist. Sie bündelt alle Schulungsfunktionen in einem Tab-Layout:

```text
┌─────────────────────────────────────────────┐
│  🎓 Flugschule [Gruppenname]           [▼]  │  ← Gruppen-Switcher (falls mehrere)
├──────┬───────────┬──────────┬───────────────┤
│Über- │ Schüler   │ Flugtage │  Alumni       │
│sicht │           │          │               │
├──────┴───────────┴──────────┴───────────────┤
│                                             │
│  [Tab-Inhalt]                               │
│                                             │
└─────────────────────────────────────────────┘
```

### Tab 1: Übersicht
- Aktive Schüleranzahl, nächster Flugtag, offene Bewertungen
- Quick-Actions: "Neuen Flugtag erstellen", "Telegram senden"
- Letzte Aktivität (neue Flüge, abgeschlossene Manöver)

### Tab 2: Schüler
- Liste aller aktiven Schüler mit:
  - Ausbildungsstufe (Grundkurs/Brevetkurs/SiKu)
  - Fluganzahl, letzte Zusammenfassung
  - Fortschrittsbalken (Prüfungsmanöver)
- Tap → Schüler-Detailansicht (Profil, alle Bewertungen, Flughistorie)

### Tab 3: Flugtage
- Chronologische Liste aller Events der Flugschule
- Jeder Eintrag zeigt: Datum, Teilnehmer, Bewertungsstatus
- Tap → öffnet EventDetail (mit Ausbildungsblatt)
- **Direkt-Link zum Ausbildungsblatt** als primäre Aktion

### Tab 4: Alumni
- Ehemalige Schüler (manuell markiert oder nach Brevet-Abschluss)
- Archiv vergangener Ausbildungszyklen

---

## Navigation

- Neuer Tile im **Mehr-Hub**: "Flugschule" (🎓 GraduationCap)
- Nur sichtbar wenn User Admin einer Flugschul-Gruppe ist
- Für **Schüler**: Kein Zugriff auf `/school`, aber StudentDayFeedback bleibt im EventDetail

---

## Technische Umsetzung

### Keine DB-Änderungen nötig
Alle Daten existieren bereits: `groups`, `group_members`, `flight_events`, `flights`, `student_day_notes`, `training_progress`, `profiles`. Es werden nur neue Queries zusammengestellt.

### Dateien

| Aktion | Datei | Beschreibung |
|--------|-------|-------------|
| **Neu** | `src/pages/SchoolDashboard.tsx` | Hauptseite mit Tabs (Übersicht, Schüler, Flugtage, Alumni) |
| **Neu** | `src/components/school/SchoolOverview.tsx` | KPI-Cards + Quick-Actions |
| **Neu** | `src/components/school/SchoolStudents.tsx` | Schüler-Liste mit Fortschritt |
| **Neu** | `src/components/school/SchoolDays.tsx` | Flugtage-Liste mit Bewertungsstatus |
| **Edit** | `src/pages/More.tsx` | Neuer Tile "Flugschule" (conditional) |
| **Edit** | `src/App.tsx` | Route `/school` hinzufügen |
| **Edit** | `src/i18n/locales/{de,en,fr}.json` | Labels für School-Dashboard |

### Schüler-Detailansicht
Beim Tap auf einen Schüler in der Liste wird ein Sheet/Page geöffnet mit:
- Alle `student_day_notes` des Schülers (chronologisch)
- Trainingsfortschritt (Prüfungsmanöver-Completion)
- Flughistorie in der Gruppe

### Ausbildungsblatt-Zugang
Das Ausbildungsblatt (CoachDayView) bleibt im EventDetail, wird aber zusätzlich aus der Flugtage-Liste im School-Dashboard direkt erreichbar — ein Button "Ausbildungsblatt" führt zum EventDetail und scrollt automatisch zur CoachDayView-Sektion.

---

## UX-Prinzipien

- **Mobile-first**: Alle Tabs als vertikale Listen mit Cards
- **Keine Redundanz**: School-Dashboard aggregiert, verlinkt aber auf bestehende Detail-Seiten
- **Progressive Disclosure**: Übersicht zeigt KPIs, Details nur bei Tap
- **Rollenbasiert**: Nur Flugschul-Admins sehen den Tile und die Seite

