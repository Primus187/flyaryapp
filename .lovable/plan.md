

# Feed-Automatik, Dashboard-Challenges & Erweiterte Challenge-Waypoints mit IGC-Verifikation

## Übersicht
4 zusammenhängende Änderungen: Feed zeigt alle Gruppen automatisch, Challenges erscheinen auf dem Dashboard, Challenge-Goals werden zu echten Wegpunkten mit Koordinaten/Karte, und IGC-Uploads prüfen automatisch Challenge-Fortschritt.

---

## 1. Feed zeigt automatisch alle Gruppen

**Problem**: Der Feed funktioniert bereits korrekt — er lädt alle Gruppen des Users via `group_members`. Das ist schon implementiert.
**Bestätigung**: Keine Code-Änderung nötig, da `Feed.tsx` bereits alle `group_members`-Einträge (admin + member) abfragt.

---

## 2. Challenges auf dem Dashboard

**Edit**: `src/pages/Dashboard.tsx`
- Nach "Nächste Termine" einen neuen Abschnitt "Aktive Challenges" hinzufügen
- Alle Challenges laden, bei denen der User Gruppenmitglied ist und die noch aktiv sind (`end_date IS NULL OR end_date >= today`)
- Challenge-Fortschritt (eigene `challenge_progress`) mitladen
- `ChallengeCard`-Komponente wiederverwenden

---

## 3. Challenge-Goals mit Koordinaten & Kartenauswahl

### Migration
- `challenge_goals` erweitern:
  - `ADD COLUMN latitude double precision`
  - `ADD COLUMN longitude double precision`
  - `ADD COLUMN radius_meters integer DEFAULT 400` (Zylinderradius für Waypoint-Validierung)
  - `ADD COLUMN goal_type text DEFAULT 'waypoint'` (start, turnpoint, waypoint, goal)

### Edit: `src/pages/ChallengeDetail.tsx`
- Goal-Erstellung erweitern: Dropdown für `goal_type` (Start, Turnpoint, Waypoint, Goal)
- Koordinaten-Eingabe: entweder manuell (lat/lng) oder über Karte
- `LocationMapPicker`-Komponente wiederverwenden für Kartenauswahl
- Optional: bestehende Location aus der DB auswählen (via `LocationCombobox`)
- Goals auf einer Mini-Karte in der Challenge-Detailansicht anzeigen

### Neu: `src/components/ChallengeGoalForm.tsx`
- Formular für Goal-Erstellung mit:
  - Label, Punkte, Goal-Type Dropdown
  - Tab-Umschalter: "Karte" / "Koordinaten" / "Ort auswählen"
  - `LocationMapPicker` für Kartenauswahl
  - `LocationCombobox` für bestehende Orte (übernimmt Koordinaten)

### Neu: `src/components/ChallengeMap.tsx`
- Leaflet-Karte die alle Goals als Marker mit Radius-Kreisen anzeigt
- Verschiedene Farben/Icons je nach `goal_type`

---

## 4. Automatische IGC-Verifikation gegen Challenges

### Logik
Wenn ein Flug mit IGC-Datei gespeichert wird, Track-Punkte gegen alle aktiven Challenge-Goals des Users prüfen:
- Für jedes Goal: Hat der IGC-Track einen Punkt innerhalb des `radius_meters`-Zylinders um die Goal-Koordinaten?
- Haversine-Distanzberechnung zwischen Track-Punkten und Goal-Koordinaten
- Wenn ja: automatisch `challenge_progress`-Eintrag erstellen

### Neu: `src/lib/challenge-verify.ts`
- Funktion `verifyChallengeGoals(igcPoints: IGCPoint[], goals: GoalWithCoords[]): string[]`
- Gibt Array der erfüllten Goal-IDs zurück
- Haversine-Formel für Distanzberechnung

### Edit: `src/pages/FlightForm.tsx`
- Nach erfolgreichem Speichern eines Flugs mit IGC:
  1. Aktive Challenges des Users laden (via Gruppenmitgliedschaft)
  2. Goals mit Koordinaten laden
  3. Bereits abgeschlossene Goals ausfiltern
  4. `verifyChallengeGoals()` aufrufen
  5. Neue `challenge_progress`-Einträge erstellen
  6. Toast-Benachrichtigung: "X Challenge-Ziele erreicht!"

---

## i18n
Neue Keys in de/en/fr:
- `challenges.start`, `challenges.turnpoint`, `challenges.waypoint`, `challenges.goalType`
- `challenges.radius`, `challenges.selectLocation`, `challenges.coordinates`
- `challenges.autoVerified`, `challenges.goalsReached`
- `dashboard.activeChallenges`

## Dateien
- **Migration**: `challenge_goals` erweitern (latitude, longitude, radius_meters, goal_type)
- **Edit**: `src/pages/Dashboard.tsx` — Challenge-Sektion
- **Edit**: `src/pages/ChallengeDetail.tsx` — erweiterte Goal-Erstellung + Karte
- **Neu**: `src/components/ChallengeGoalForm.tsx` — Goal-Formular mit Karte
- **Neu**: `src/components/ChallengeMap.tsx` — Waypoint-Karte
- **Neu**: `src/lib/challenge-verify.ts` — IGC-Verifikationslogik
- **Edit**: `src/pages/FlightForm.tsx` — Auto-Verifikation nach IGC-Upload
- **Edit**: `src/i18n/locales/{de,en,fr}.json` — Übersetzungen

