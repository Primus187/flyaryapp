

# Fix: Flüssige Flug-Animation ohne Flimmern

## Ursache

Die Animation ruft **jeden Frame** (60x/Sekunde) `setAnimProgress()` auf → React-Re-render → `downsample()` erzeugt ein neues Array → der Haupteffekt mit `[renderPoints]` Dependency **zerstört und erstellt die gesamte Karte neu**. Das verursacht das Flimmern.

## Lösung

Drei Änderungen in `src/components/Flight3DMap.tsx`:

1. **`renderPoints` mit `useMemo` stabilisieren** — verhindert, dass bei jedem Re-render ein neues Array entsteht und den Map-Effekt triggert

2. **Progress-Bar nur alle ~10 Frames updaten** — statt `setAnimProgress` bei jedem `requestAnimationFrame` nur alle ~150ms den React-State updaten. Der Marker und die GeoJSON-Source werden weiterhin jeden Frame aktualisiert (das ist rein MapLibre-intern, kein React-Render)

3. **`minAlt`/`maxAlt` aus dem Animations-Loop entfernen** — diese werden aktuell in jedem Frame neu berechnet. Stattdessen einmal berechnen und in einem Ref speichern

### Resultat
- MapLibre-Marker-Bewegung und GeoJSON-Updates: ~60fps (rein GPU/MapLibre, kein React)
- React-Re-renders: ~7fps (nur für Progress-Bar)
- Kein Map-Neuaufbau während der Animation

