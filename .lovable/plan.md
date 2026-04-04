

# 3D-Flugvisualisierung mit Terrain und Höhenprofil

## Konzept

Eine neue 3D-Kartenansicht für Flüge mit IGC-Track, inspiriert von Burnair: 3D-Terrain mit Satellitenbildern, der Flugtrack als farbige Linie im 3D-Raum, und ein Höhenprofil-Diagramm darunter.

## Technologie

**MapLibre GL JS** mit 3D-Terrain-Support:
- Leichtgewichtig (~200KB vs CesiumJS ~30MB)
- Native 3D-Terrain-Unterstützung via `terrain`-Property
- Satelliten-/Topo-Tiles + Open Terrain Tiles
- Flugtrack als `GeoJSON LineString` mit Höhendaten

**Höhenprofil**: Recharts (bereits installiert) — Area-Chart mit Zeit/Höhe, interaktiver Cursor der Position auf der 3D-Karte synchronisiert.

## UI-Design

```text
┌─────────────────────────────┐
│  ← 3D Ansicht    [2D] [3D] │  ← Toggle zwischen bestehender 2D und neuer 3D
├─────────────────────────────┤
│                             │
│     [3D Terrain Map]        │  ← MapLibre GL mit Terrain, ~60% Höhe
│     Flugtrack farbcodiert   │
│     nach Höhe (blau→rot)    │
│                             │
├─────────────────────────────┤
│  1800 ─────────────────     │
│  1200 ────/\────────────    │  ← Recharts Höhenprofil
│   600 ──/    \──────────    │
│     0 ──────────────────    │
│   12:30    13:00    13:30   │
└─────────────────────────────┘
```

## Umsetzung

### Neue Dependency
- `maplibre-gl` — 3D-Karten-Engine

### Dateien

| Aktion | Datei | Beschreibung |
|--------|-------|-------------|
| **Neu** | `src/components/Flight3DMap.tsx` | MapLibre GL 3D-Terrain-Karte mit Track |
| **Neu** | `src/components/FlightAltitudeProfile.tsx` | Recharts Höhenprofil-Chart |
| **Edit** | `src/pages/FlightDetail.tsx` | 3D-Button hinzufügen, der die 3D-Ansicht öffnet |

### Flight3DMap Kernlogik
- MapLibre GL Map mit `terrain: { source: 'terrain-tiles', exaggeration: 1.5 }`
- Terrain-Tiles: `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png` (Open Terrain)
- Satellitenbilder: MapTiler oder ESRI World Imagery (frei für nicht-kommerzielle Nutzung)
- Track als `fill-extrusion` oder `line` Layer mit `line-z-offset` basierend auf IGC-Altitude
- Kamera wird automatisch auf Track-Bounds mit 60° Pitch positioniert
- Track-Farbe kodiert nach Höhe (Gradient blau → gelb → rot)

### Altitude Profile
- Recharts AreaChart mit Zeit (X) und Höhe (Y)
- Hover zeigt Tooltip mit exakter Zeit + Höhe
- Optional: Hover-Position synchronisiert Marker auf 3D-Karte

### Integration in FlightDetail
- Neben der bestehenden 2D-Karte ein "3D"-Button
- Öffnet entweder als Fullscreen-Dialog oder ersetzt die 2D-Karte
- Nur sichtbar wenn IGC-Track vorhanden

