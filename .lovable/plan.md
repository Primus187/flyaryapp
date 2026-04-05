

# Fix: Synchronisation Flugspur ↔ Höhenprofil

## Problem
`Flight3DMap` downsampelt den Track auf 800 Punkte (`renderPoints`) und meldet den Index `idx` innerhalb dieses 800er-Arrays. `FlightAltitudeProfile` interpretiert diesen Index aber als Index des **Original-Arrays** (volle Länge) und rechnet ihn auf sein eigenes 300er-Downsampling um. Die beiden Indizes zeigen dadurch auf unterschiedliche Stellen im Flug.

## Lösung
Den gemeldeten Index in `Flight3DMap` zurück auf die Original-Punkte-Skala umrechnen, bevor er nach aussen gegeben wird.

### Änderung in `Flight3DMap.tsx`
Zeile 406: Statt `onAnimIndexRef.current?.(idx)` den Index auf die Original-Länge hochrechnen:

```typescript
const originalIdx = Math.round(idx / (renderPoints.length - 1) * (points.length - 1));
onAnimIndexRef.current?.(originalIdx);
```

So erhält `FlightAltitudeProfile` einen Index relativ zur Original-Punkteanzahl, was seine bestehende Downsampling-Logik korrekt auflöst.

Eine Datei, eine Zeile.

