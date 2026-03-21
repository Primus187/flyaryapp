

# Bottom-Nav: Karte → Orte & Aufnahme entfernen

## Änderungen

### 1. Bottom-Navigation (`src/components/BottomNav.tsx`)
- **"Karte"**-Tab ersetzen durch **"Orte"** (Icon: `MapPin`, Pfad: `/locations`)
- **"Aufnahme"**-Tab (der runde Button) komplett entfernen
- Verbleibende Tabs: Dashboard | Flugbuch | Orte | Profil

### 2. Orte-Seite (`src/pages/Locations.tsx`)
- Button "Kartenansicht" oben hinzufügen → navigiert zu `/map`
- "Orte verwalten"-Link auf der Profil-Seite entfernen (da jetzt direkt in der Nav)

### 3. Profil-Seite (`src/pages/Profile.tsx`)
- "Orte verwalten"-Button entfernen (redundant, da Orte jetzt eigener Tab)

### 4. Routing (`src/App.tsx`)
- `/record`-Route entfernen
- `/map`-Route beibehalten (erreichbar über Orte-Seite)
- `FlightRecorder`-Import entfernen

### 5. Aufräumen — Dateien die entfernt werden
- `src/pages/FlightRecorder.tsx`
- `src/lib/vario-audio.ts`
- `src/lib/barometer.ts`
- `src/lib/igc-writer.ts`

