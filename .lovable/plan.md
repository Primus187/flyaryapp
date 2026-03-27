

# Digitales Ausbildungsblatt — Flugtag-Bewertungstabelle

## Konzept

Das aktuelle CoachDayView wird durch ein tabellenartiges "Ausbildungsblatt" ersetzt, das dem handschriftlichen Formular des Fluglehrers entspricht:

```text
┌──────────┬─────────┬─────────┬─────────┬───┬─────────┬──────────────┐
│ Schüler  │ Flug 1  │ Flug 2  │ Flug 3  │...│ Flug 6  │ Zusammen-    │
│          │         │         │         │   │         │ fassung      │
├──────────┼─────────┼─────────┼─────────┼───┼─────────┼──────────────┤
│ Max M.   │ 🔒 gut  │ 👁 Ohren│         │   │         │ Bereit für   │
│          │ gestartet│ geübt   │         │   │         │ Brevetkurs   │
├──────────┼─────────┼─────────┼─────────┼───┼─────────┼──────────────┤
│ Lisa K.  │ 👁 Start│         │         │   │         │ Muss Nicken  │
│          │ unsauber│         │         │   │         │ verbessern   │
└──────────┴─────────┴─────────┴─────────┴───┴─────────┴──────────────┘

🔒 = nur Fluglehrer sichtbar   👁 = Schüler sichtbar
```

## Datenbank

Neue Tabelle `student_day_notes`:

| Spalte | Typ | Beschreibung |
|--------|-----|-------------|
| id | uuid PK | |
| event_id | uuid | Flugtag-Referenz |
| student_user_id | uuid | Schüler |
| flight_number | int (1-6) | NULL = Zusammenfassung |
| note | text | Freitext-Feedback |
| visible_to_student | boolean | Default false (nur Lehrer) |
| instructor_id | uuid | Wer hat geschrieben |
| created_at / updated_at | timestamptz | |

- `flight_number = NULL` → Zusammenfassungs-Spalte
- Die Zusammenfassung wird beim Erstellen eines neuen Events automatisch vom letzten Event der gleichen Gruppe kopiert (Client-Logik)

### RLS-Policies
- SELECT: Lehrer (group admin) sehen alles; Schüler sehen nur eigene Zeilen mit `visible_to_student = true`
- INSERT/UPDATE/DELETE: Nur group admins

## UI-Redesign: CoachDayView

### Mobile-optimiertes Layout (395px)
Da eine 8-spaltige Tabelle auf 395px nicht funktioniert, wird ein **Schüler-Karten-Layout** mit horizontalem Scroll für die Flüge verwendet:

1. **Schüler-Karte** (pro Schüler eine Card)
   - Header: Pilotname + Zusammenfassungs-Badge
   - Horizontaler Scroll-Container mit 6 Flug-Slots
   - Jeder Slot: Tap zum Bearbeiten, Sichtbarkeits-Toggle (Auge/Schloss-Icon)

2. **Zusammenfassungs-Sektion** am Ende jeder Karte
   - Textarea, vorausgefüllt vom letzten Flugtag
   - Toggle: Schüler darf sehen (ja/nein)

3. **Sichtbarkeits-Toggle**: Kleines Auge- oder Schloss-Icon pro Notiz
   - Tap wechselt zwischen `visible_to_student: true/false`
   - Visuell: Auge-Icon = sichtbar, Schloss = nur Lehrer

### Schüler-Ansicht
- Auf der Event-Detail-Seite sieht der Schüler nur seine eigenen Feedbacks mit `visible_to_student = true`
- Dargestellt als einfache Liste: "Flug 1: ...", "Flug 2: ...", "Zusammenfassung: ..."

## Umsetzung

### Migration
- Tabelle `student_day_notes` erstellen
- RLS: Security-Definer-Funktion für Schüler-Sicht

### Dateien
- **Neu**: Migration für `student_day_notes`
- **Rewrite**: `src/components/CoachDayView.tsx` — Komplettes Redesign mit Karten + horizontalem Scroll
- **Neu**: `src/components/StudentDayFeedback.tsx` — Schüler-Ansicht der freigegebenen Notizen
- **Edit**: `src/pages/EventDetail.tsx` — StudentDayFeedback für Nicht-Admins einbinden
- **Edit**: `src/i18n/locales/{de,en,fr}.json` — Neue Labels

### Zusammenfassungs-Übernahme
Beim Laden der CoachDayView wird geprüft, ob für diesen Event bereits Zusammenfassungen existieren. Falls nicht, wird die letzte Zusammenfassung des Schülers aus dem vorherigen Event der gleichen Gruppe geladen und als Vorschlag angezeigt (noch nicht gespeichert, bis der Lehrer bestätigt).

