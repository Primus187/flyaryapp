

# Fix: Follow-Modus blockiert Benutzer-Gesten

## Ursache

`easeTo()` wird **jeden Frame** mit `duration: 600` aufgerufen. Jeder `easeTo`-Aufruf startet eine interne MapLibre-Animation, die alle User-Interaktionen (Pinch, Drag, Rotate) sofort überschreibt. Der Benutzer kann die Karte nicht bedienen, weil seine Gesten ständig von der nächsten `easeTo`-Animation unterbrochen werden.

## Lösung

Statt `easeTo` die Methode **`jumpTo`** verwenden, die die Kamera **sofort ohne Animation** repositioniert. Das blockiert keine Gesten. MapLibre verarbeitet User-Gesten zwischen den Frames normal, und beim nächsten Frame wird nur das Center neu gesetzt.

### Änderung in `Flight3DMap.tsx`

Zeilen 446-450: `easeTo` durch `jumpTo` ersetzen:

```typescript
if (followRef.current) {
  mapRef.current.jumpTo({
    center: [p.lng, p.lat],
  });
}
```

- Kein `duration`, kein `easing` — sofortige Positionierung
- Pitch, Bearing, Zoom bleiben unangetastet → User kann frei steuern
- Kein Konflikt mit Gesten, da keine interne Animation läuft

Eine Zeile geändert, eine Datei.

