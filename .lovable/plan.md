

# Ausbildungsblatt UX-Redesign: Kompakte Liste + Accordion + Pausiert-Status

## Problem

Aktuell zeigt die CoachDayView alle Schüler mit allen 6 Flug-Slots + Summary gleichzeitig an. Bei 6+ Schülern wird das auf 395px extrem lang und unübersichtlich. An einem hektischen Flugtag muss der Lehrer schnell den richtigen Schüler finden und Notizen eintragen.

## Lösung

### 1. Kompakte Schüler-Liste mit Accordion

Die Schüler werden als **kompakte einzeilige Rows** angezeigt. Tap auf einen Schüler klappt dessen Flug-Slots auf. Nur ein Schüler ist gleichzeitig geöffnet.

```text
┌─────────────────────────────────────┐
│ Ausbildungsblatt (6)                │
├─────────────────────────────────────┤
│ ▸ Max Müller        2✈  ⏸         │  ← kompakt, 1 Zeile
│ ▾ Lisa Keller       3✈            │  ← geöffnet
│   ┌─────┬─────┬─────┬─────┬───┬───┐│
│   │ F1  │ F2  │ F3  │ F4  │F5 │F6 ││  ← Flug-Tabs
│   ├─────┴─────┴─────┴─────┴───┴───┤│
│   │ [Textarea für aktiven Tab]     ││
│   │ 👁 sichtbar    [Speichern]    ││
│   ├────────────────────────────────┤│
│   │ 📋 Zusammenfassung            ││
│   │ [Textarea]         [Speichern]││
│   └────────────────────────────────┘│
│ ▸ Peter Schmidt     1✈            │
│ ▸ Anna Weber        0✈  ⏸ Pause  │  ← pausiert
│ ▸ Tom Berger        2✈            │
└─────────────────────────────────────┘
```

### 2. Flug-Tabs statt horizontaler Scroll

Statt 6 nebeneinander scrollender Textareas: **6 Tab-Buttons** (F1-F6) oben, darunter ein einzelnes Textarea-Feld. Das spart Platz und der Lehrer sieht auf einen Blick welche Flüge Notizen haben (gefüllte Tabs farbig markiert).

### 3. "Pausiert"-Status pro Schüler

Neues Feature: Ein Toggle-Button in der kompakten Zeile, der den Schüler als "pausiert" (Flug ausgesetzt) markiert. Wird als `flight_number = -1` in `student_day_notes` gespeichert (kein Schema-Change nötig, nur Convention). Pausierte Schüler werden visuell abgedimmt und ans Ende der Liste sortiert.

### 4. Quick-Indicators in der kompakten Zeile

Jede Schüler-Zeile zeigt auf einen Blick:
- Name
- Fluganzahl (z.B. "3✈")
- Dots/Badges für Flüge mit Notizen (gefüllte Kreise)
- Pause-Icon falls pausiert

## Technische Umsetzung

### Dateien

| Aktion | Datei | Beschreibung |
|--------|-------|-------------|
| **Rewrite** | `src/components/CoachDayView.tsx` | Accordion-Layout, Tab-basierte Flug-Slots, Pause-Toggle |
| **Edit** | `src/i18n/locales/{de,en,fr}.json` | Labels: "paused", "flightTabs" etc. |

### Keine DB-Migration nötig
- "Pausiert" wird als `student_day_notes` mit `flight_number = -1` und `note = 'paused'` gespeichert
- Bestehende Datenstruktur bleibt kompatibel

### Key UX-Details
- **Auto-Save mit Debounce** (800ms): Kein manueller Save-Button mehr nötig. Der Lehrer tippt und die Notiz speichert sich automatisch. Visueller Indicator (kleiner Haken) bestätigt
- **Accordion**: State `expandedStudent` — nur einer offen, Tap auf anderen schliesst den vorherigen
- **Tab-Badges**: Tabs F1-F6 zeigen einen kleinen Dot wenn eine Notiz vorhanden ist
- **Pause-Toggle**: Long-press oder dedizierter kleiner Button in der kompakten Zeile

