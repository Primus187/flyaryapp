# Einstellungen, Dark Mode & Mehrsprachigkeit (i18n)

## Übersicht

Neue Einstellungen-Seite erreichbar vom Profil, mit Dark/Light-Mode Toggle und Sprachwahl (DE/FR/EN). Die gesamte App wird internationalisiert.

## Ansatz

### 1. i18n-System: `react-i18next`

- Dependency: `i18next`, `react-i18next`
- Übersetzungsdateien: `src/i18n/lorgggggcales/de.json`, `fr.json`, `en.json`
- Initialisierung in `src/i18n/index.ts`, importiert in `main.tsx`
- Jede Datei enthält alle Strings der App, gruppiert nach Seite (dashboard, flights, events, profile, settings, etc.)
- ~300 Strings pro Sprache

### 2. Dark Mode

- CSS-Variablen für `.dark` existieren bereits in `index.css`
- Neuer Context `src/contexts/ThemeContext.tsx`: liest/speichert Präferenz in `localStorage`, setzt `dark` Klasse auf `<html>`
- In `App.tsx` einbinden

### 3. Einstellungen-Seite (`src/pages/Settings.tsx`)

- Dark/Light/System Toggle (3 Optionen mit Icons)
- Sprachwahl: Dropdown mit DE/FR/EN
- Einstellungen werden in `localStorage` persistiert
- Route `/settings` im AppLayout

### 4. Profil-Seite anpassen

- Neuer Button "Einstellungen" (Icon: `Settings`) vor dem Abmelden-Button
- Navigiert zu `/settings`

### 5. Alle Seiten internationalisieren

Jede Seite/Komponente wird umgestellt: hardcodierte Strings → `t("key")`. Betrifft:

- `BottomNav.tsx` (5 Labels)
- `Dashboard.tsx` (Überschriften, Statistik-Labels, Termine, Flüge)
- `Flights.tsx`, `FlightForm.tsx`, `FlightDetail.tsx`
- `Events.tsx`, `EventDetail.tsx`, `EventForm.tsx`
- `Locations.tsx`, `LocationDetail.tsx`
- `Groups.tsx`, `GroupDetail.tsx`
- `Profile.tsx`, `Auth.tsx`, `ResetPassword.tsx`
- `ImportFlights.tsx`, `ImportLocations.tsx`
- `Stats.tsx`, `MapView.tsx`, `SplashScreen.tsx`
- Toast-Meldungen, Platzhalter, Bestätigungsdialoge

### 6. Datums-/Zahlenformatierung

- `toLocaleDateString` Locale dynamisch basierend auf gewählter Sprache (de-CH / fr-CH / en-GB)

## Dateien

- **Neu**: `src/i18n/index.ts` — i18next Setup
- **Neu**: `src/i18n/locales/de.json` — Deutsche Übersetzungen (~300 Keys)
- **Neu**: `src/i18n/locales/fr.json` — Französische Übersetzungen
- **Neu**: `src/i18n/locales/en.json` — Englische Übersetzungen
- **Neu**: `src/contexts/ThemeContext.tsx` — Dark Mode Context
- **Neu**: `src/pages/Settings.tsx` — Einstellungen-Seite
- **Edit**: `src/main.tsx` — i18n Import
- **Edit**: `src/App.tsx` — ThemeProvider, Settings-Route
- **Edit**: Alle ~18 Seiten + BottomNav — `t()` Aufrufe statt hardcodierter Strings

## Technische Details

- Sprache & Theme werden nur in `localStorage` gespeichert (kein DB nötig)
- Fallback-Sprache: Deutsch
- i18next `interpolation.escapeValue = false` (React escaped bereits)
- Dark Mode: `tailwind.config.ts` braucht `darkMode: "class"`