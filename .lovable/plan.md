

# XLSX-Flugimport

## Übersicht
Neue Import-Funktion auf der Profil-Seite, die eine `.xlsx`-Datei im Format der bestehenden App einliest und alle Flüge inklusive Orte in die Datenbank importiert.

## Spalten-Mapping (Excel → Datenbank)

| Excel-Spalte | DB-Feld | Logik |
|---|---|---|
| Datum | `flights.date` | DD.MM.YYYY → YYYY-MM-DD |
| Start | `locations.name` (type=takeoff) | Ort anlegen falls nicht vorhanden, dann `takeoff_location_id` setzen |
| Start Land | — | Wird in Location-Beschreibung gespeichert |
| Landung | `locations.name` (type=landing) | Ort anlegen falls nicht vorhanden, dann `landing_location_id` setzen |
| Landung Land | — | Wird in Location-Beschreibung gespeichert |
| Flugdauer | `flights.duration_minutes` | HH:MM:SS → Minuten |
| Km | `flights.distance_km` | Direkt übernehmen |
| Beschreibung | `flights.comments` | Direkt übernehmen |
| Gleitschirm | `flights.glider` | Direkt übernehmen |
| Preis | — | Ignoriert (kein Feld vorhanden) |
| Tandem | — | Ignoriert |
| IGC-Datei | — | Nur Dateiname, kein Import möglich |

## Implementierung

### 1. Neue Seite: `/import` (oder Abschnitt auf Profil-Seite)
- Datei-Upload-Button für `.xlsx`
- Client-seitiges Parsing mit `xlsx` (SheetJS) Library
- Vorschau-Tabelle: zeigt erkannte Flüge mit Datum, Start, Landung, Dauer
- Anzeige: "153 Flüge erkannt, 28 Orte werden erstellt"
- Import-Button startet den Vorgang

### 2. Import-Logik
1. **Orte deduplizieren**: Alle einzigartigen Start-/Landeplatz-Namen sammeln
2. **Existierende Orte prüfen**: Gegen die DB abgleichen (Name + User)
3. **Fehlende Orte erstellen**: Neue Locations mit Dummy-Koordinaten (0,0) anlegen — User kann sie später auf der Karte positionieren
4. **Flüge einfügen**: Batch-Insert aller Flüge mit den korrekten Location-IDs
5. **Duplikat-Erkennung**: Gleicher User + gleiches Datum + gleicher Startplatz = Warnung

### 3. Dateien
- **Neue Datei**: `src/pages/ImportFlights.tsx` — Import-Seite mit Upload, Vorschau, Fortschritt
- **Neue Datei**: `src/lib/xlsx-import.ts` — Parsing-Logik (Excel → strukturierte Daten)
- **Edit**: `src/App.tsx` — Route `/import` hinzufügen
- **Edit**: `src/pages/Profile.tsx` — Link zum Import hinzufügen
- **Dependency**: `xlsx` (SheetJS) NPM-Paket

### 4. UX-Flow
1. User geht auf Profil → "Flüge importieren"
2. Wählt `.xlsx`-Datei aus
3. Sieht Vorschau mit Anzahl Flüge und neuen Orten
4. Klickt "Importieren"
5. Fortschrittsbalken während des Imports
6. Erfolgsmeldung: "153 Flüge und 28 Orte importiert"

