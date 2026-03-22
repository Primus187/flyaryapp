

# UI-Verbesserung: Orte in Navigation, Profil aufräumen, Manöver bei Flügen

## 3 Probleme, 3 Lösungen

### 1. Orte zurück in die Navigation

**Problem**: Orte sind nur noch über Profil erreichbar, aber wichtig für den täglichen Gebrauch.

**Lösung**: BottomNav von 5 auf 5 Tabs belassen, aber "Mehr"-Sektion im Profil durch ein **"Mehr"-Tab** ersetzen, das Dashboard + Orte + Profil vereint. Alternativ besser: **Orte als Unterseite des Logbuchs** integrieren — aber das passt nicht wirklich.

**Besserer Ansatz**: BottomNav bekommt einen **"Mehr"-Tab** (Grid-Icon) statt "Profil". Dieser öffnet eine Übersichtsseite mit Kacheln: Profil, Orte/Karte, Gruppen, Import, Export, Einstellungen. So bleiben 5 Tabs, aber Orte sind nur 1 Tap entfernt.

```text
BottomNav: Dashboard | Logbuch | Training | Termine | Mehr
                                                      ↓
                                              Profil, Orte, Gruppen,
                                              Import, Export, Settings
```

### 2. Profil aufräumen

**Problem**: Profil enthält zu viel: Persönliche Daten, Schirme, Notfall-Infos, Passwort-Änderung, plus 6 Navigations-Buttons (Gruppen, Export, Import, Import-Orte, Einstellungen, Abmelden).

**Lösung**: Die Navigations-Buttons (Gruppen, Export, Import, Import-Orte, Einstellungen) wandern in die neue "Mehr"-Seite. Profil wird schlank:
- Persönliche Daten (Name, Foto, Bio, Email)
- Schirme
- Notfall-Infos
- Speichern-Button

Passwort-Änderung und Abmelden wandern in die Einstellungen-Seite.

### 3. Trainierte Manöver beim Flug erfassen

**Problem**: Beim Flug erfassen fehlt die Möglichkeit, trainierte Manöver zu dokumentieren.

**Lösung**: 
- Neue DB-Tabelle `flight_training_items` (flight_id, item_id) — Many-to-Many Verknüpfung
- Im FlightForm: Multi-Select Dropdown mit den wichtigsten Training-Items (aus `training_items` Tabelle geladen)
- Nur Anzeige der Items, keine Bewertung — die geschieht weiterhin auf der Training-Seite
- In der Flight-Detailansicht: trainierte Manöver als Badges anzeigen

## Dateien

### Migration
- **Neu**: `flight_training_items` Tabelle (flight_id uuid FK → flights, item_id uuid FK → training_items, PK auf beide)
- RLS: Eigene Flüge (via `is_owner_of_flight`)

### Neue Seite
- **Neu**: `src/pages/More.tsx` — "Mehr"-Übersichtsseite mit Kacheln (Profil, Orte, Gruppen, Import, Export, Einstellungen, Abmelden)

### Edits
- **`src/components/BottomNav.tsx`** — "Profil" → "Mehr" (/more, Grid-Icon)
- **`src/pages/Profile.tsx`** — Navigations-Buttons entfernen, Passwort-Änderung entfernen (→ Settings), Abmelden entfernen (→ Mehr-Seite)
- **`src/pages/Settings.tsx`** — Passwort-Änderung hierhin verschieben
- **`src/pages/FlightForm.tsx`** — Multi-Select für trainierte Manöver hinzufügen
- **`src/pages/FlightDetail.tsx`** — Trainierte Manöver als Badges anzeigen
- **`src/App.tsx`** — Route `/more` hinzufügen
- **`src/i18n/locales/{de,fr,en}.json`** — Neue Übersetzungen

## Technische Details

- `flight_training_items`: Composite PK `(flight_id, item_id)`, RLS via `is_owner_of_flight(flight_id)`
- Multi-Select im FlightForm: Training-Items laden, Popover mit Checkboxen, ausgewählte als Chips anzeigen
- "Mehr"-Seite: Einfaches Grid mit Icons und Labels, kein komplexes Layout

