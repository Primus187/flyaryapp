

# Dashboard-Stats anpassen & Statistik-Seite

## 1. Dashboard anpassen (`src/pages/Dashboard.tsx`)

- **Höhenmeter-Kachel ersetzen** durch zwei neue Kacheln:
  - "Startplätze": Anzahl unique `takeoff_location_id` (nicht null)
  - "Landeplätze": Anzahl unique `landing_location_id` (nicht null)
- Stats-Grid wird 2x2 → bleibt 2x2 aber mit: Flüge, Flugzeit, Startplätze, Landeplätze (Strecke entfällt auch, da 4 Kacheln)
- Alternativ 3x2 Grid mit 5 Kacheln (Flüge, Flugzeit, Strecke, Startplätze, Landeplätze) — ich schlage vor, die bisherigen 4 zu ersetzen: **Flüge, Flugzeit, Startplätze, Landeplätze**
- Zusätzliche Query auf `flights` mit `landing_location_id` um unique Counts zu berechnen
- **Neuer Button** "Stats" neben "+ Flug" (Icon: `BarChart3`), navigiert zu `/stats`

## 2. Neue Statistik-Seite (`src/pages/Stats.tsx`)

- **Zeitfilter** oben: Buttons/Tabs für "Monat" / "Jahr" / "Alle" mit Dropdown für konkreten Monat/Jahr
- **Kennzahlen-Cards**: 
  - Flüge gesamt, Gesamtflugzeit, Durchschnittliche Flugzeit, Längster Flug
  - Gesamtstrecke, Durchschnittliche Strecke, Gesamthöhenmeter
  - Häufigster Startplatz, Häufigster Schirm
- **Diagramme** (mit Recharts, bereits als Dependency vorhanden via `chart.tsx`):
  - Balkendiagramm: Flüge pro Monat
  - Balkendiagramm: Flugzeit pro Monat
- Daten werden client-seitig aus allen Flügen gefiltert (gleiche Query wie Dashboard, aber alle Felder)

## 3. Routing (`src/App.tsx`)
- Neue Route `/stats` → `Stats` Komponente innerhalb AppLayout

## Dateien
- **Edit**: `src/pages/Dashboard.tsx` — Stats anpassen, Stats-Button hinzufügen
- **Neu**: `src/pages/Stats.tsx` — Statistik-Seite mit Filter und Charts
- **Edit**: `src/App.tsx` — Route `/stats` hinzufügen

