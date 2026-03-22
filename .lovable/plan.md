

# Flugformular: Ort-Suche mit Filter und Inline-Erstellung

## Problem
Die Ort-Auswahl (Start/Landeplatz) im FlightForm ist ein einfaches Select-Dropdown ohne Suchfunktion. Bei vielen Orten ist das unübersichtlich. Neue Orte können nur über die Orte-Seite erstellt werden.

## Lösung

### 1. Combobox statt Select für Start- und Landeplatz
- Popover mit `Command` (cmdk) Komponente: Suchfeld filtert Orte live beim Tippen
- Zeigt passende Orte aus der jeweiligen Kategorie (takeoff/both bzw. landing/both)
- Bei Auswahl schliesst das Popover und der Ort wird gesetzt

### 2. "Neuer Ort erstellen" Option
- Am Ende der gefilterten Liste ein Button "+ Neuen Ort erstellen"
- Öffnet einen Dialog mit den wichtigsten Feldern: Name, Typ (takeoff/landing/both), Koordinaten (Map-Picker), Höhe
- Nach dem Speichern wird der neue Ort automatisch ausgewählt und die Ortliste aktualisiert

### 3. Wiederverwendbare Komponente
- Neue Komponente `src/components/LocationCombobox.tsx`
- Props: `locations`, `value`, `onChange`, `filterType` ("takeoff"|"landing"), `placeholder`, `onLocationCreated`
- Wird zweimal im FlightForm verwendet (Startplatz + Landeplatz)

## Dateien
- **Neu**: `src/components/LocationCombobox.tsx` — Combobox mit Suchfilter + Inline-Ort-Erstellung (Dialog mit Name, Typ, Map-Picker, Höhe)
- **Edit**: `src/pages/FlightForm.tsx` — Select durch LocationCombobox ersetzen, Locations-Liste nach Erstellung neu laden
- **Edit**: `src/i18n/locales/{de,en,fr}.json` — Keys: `locations.searchLocation`, `locations.createNew`, `locations.noResults`

