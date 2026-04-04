

# Fluglinie progressiv aufbauen + Drop-Fläche dezenter

## Änderungen in `src/components/Flight3DMap.tsx`

### 1. Track progressiv aufbauen statt komplett anzeigen

Der statische 3D-Track (`track-3d` Layer) wird initial **versteckt** (`visibility: "none"`). Im Animations-Loop wird ein neuer/bestehender Layer `track-progress` mit nur den **bereits geflogenen Segmenten** (0 bis `idx`) aktualisiert. Wenn die Animation endet (progress = 1) oder noch nie gestartet wurde, wird der volle Track angezeigt.

- Neue Source `track-progress` (geojson, initial leer) + fill-extrusion Layer mit gleichen Paint-Properties wie `track-3d`
- Bei Play: `track-3d` unsichtbar setzen, `track-progress` zeigt Segmente 0..idx
- Im Animations-Loop: Jeder Frame updatet `track-progress` mit Features von 0 bis aktuellem Index (gleiche Extrusion-Features wie beim statischen Track, gecached in einem Ref)
- Bei Stop/Ende: `track-3d` wieder sichtbar, `track-progress` leeren
- Performance: Die statischen Features werden einmalig in einem `extrusionFeaturesRef` gespeichert, der Loop schneidet nur mit `slice(0, idx)`

### 2. Blaue Drop-Fläche transparenter und kürzer

- `TRAIL_LENGTH`: Von `50` auf `25` reduzieren (kürzerer Fade)
- Alpha-Berechnung: Max-Alpha von `0.6` auf `0.3` senken, Min von `0.05` auf `0.02`
- Ergebnis: Deutlich dezentere, kürzere blaue Fläche

```text
Vorher: alpha = max(0.05, 0.6 * (1 - age/50))  → 0.6 bis 0.05 über 50 Segmente
Nachher: alpha = max(0.02, 0.3 * (1 - age/25)) → 0.3 bis 0.02 über 25 Segmente
```

### 3. Zusammenfassung der Edits

Nur eine Datei: `src/components/Flight3DMap.tsx`
- `TRAIL_LENGTH` → `25`
- Alpha-Werte anpassen (0.3 max, 0.02 min)
- `extrusionFeaturesRef` speichert vorberechnete Features
- Neue Source/Layer `track-progress` für progressiven Aufbau
- `track-3d` Layer bei Animation verstecken
- Im `animate()` Loop: `track-progress` Source mit `features.slice(0, idx)` updaten
- Bei Reset/Ende: `track-3d` wieder einblenden

