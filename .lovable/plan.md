

# Gruppen-Zuordnung bei Flügen + Export-Filter

## Übersicht
1. Neue Spalte `group_id` (optional) auf `flights`
2. Gruppen-Dropdown im FlightForm
3. Export-Dialog in Settings mit Gruppen-Auswahl

## Migration
- `ALTER TABLE flights ADD COLUMN group_id uuid REFERENCES groups(id) ON DELETE SET NULL`
- Nullable, da bestehende Flüge keiner Gruppe zugeordnet sind

## Änderungen

### `src/pages/FlightForm.tsx`
- Gruppen des Users laden (via `group_members` → `groups`)
- Optionales Dropdown "Gruppe" im Formular
- `group_id` beim Speichern/Updaten mitgeben
- Beim Editieren bestehende `group_id` laden

### `src/pages/Settings.tsx`
- Export-Button öffnet jetzt einen Dialog statt direkt zu exportieren
- Dialog zeigt Checkboxen: eine pro Gruppe des Users + "Ohne Gruppe"
- Standardmässig alle angehakt
- Ausgewählte Group-IDs als Query-Parameter an die Edge Function senden

### `supabase/functions/export-flightbook-pdf/index.ts`
- Neue Query-Parameter `group_ids` (kommaseparierte UUIDs) und `include_no_group` (boolean)
- Flüge filtern: nur solche mit `group_id IN (...)` oder `group_id IS NULL` (wenn "Ohne Gruppe" gewählt)
- Ohne Parameter: alle Flüge (Rückwärtskompatibilität)

### `src/pages/FlightDetail.tsx`
- Gruppennamen anzeigen, falls `group_id` gesetzt

### i18n
- Neue Keys: `flights.group`, `settings.exportFilter`, `settings.noGroup`, `settings.selectGroups`

## Dateien
- **Migration**: `group_id` Spalte auf `flights`
- **Edit**: `src/pages/FlightForm.tsx` — Gruppen-Dropdown
- **Edit**: `src/pages/FlightDetail.tsx` — Gruppenname anzeigen
- **Edit**: `src/pages/Settings.tsx` — Export-Dialog mit Gruppenfilter
- **Edit**: `supabase/functions/export-flightbook-pdf/index.ts` — Filter-Logik
- **Edit**: `src/i18n/locales/{de,en,fr}.json` — Übersetzungen

