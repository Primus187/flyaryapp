

# Termin duplizieren

## Änderungen

### 1. EventDetail.tsx — Duplizieren-Button
- Neben dem Bearbeiten-Button (Pencil) einen neuen "Duplizieren"-Button hinzufügen (Icon: `Copy`)
- Nur für Admins sichtbar
- Beim Klick: Navigation zu `/events/new?duplicate={id}`

### 2. EventForm.tsx — Duplizierungs-Logik
- URL-Parameter `duplicate` auslesen via `useSearchParams`
- Wenn `duplicate` vorhanden: Event-Daten laden (wie bei Edit), aber **nicht** als Edit-Modus behandeln
- Datum-Feld leer lassen (damit der User ein neues Datum wählen muss)
- Titel mit "(Kopie)" Suffix vorbelegen
- Status auf "announced" zurücksetzen
- Beim Speichern wird ein neuer Termin erstellt (INSERT, nicht UPDATE)

### Dateien
- **Edit**: `src/pages/EventDetail.tsx` — Copy-Button hinzufügen
- **Edit**: `src/pages/EventForm.tsx` — `duplicate` Query-Parameter verarbeiten

