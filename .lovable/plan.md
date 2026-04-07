

# Fix: Lightbox-Navigation & Zurück-Geste

## Problem
1. **Kein sichtbarer Schliessen-Button** — der X-Button ist da, aber leicht zu übersehen (klein, oben rechts, weiss auf schwarz)
2. **Swipe zwischen Fotos funktioniert nicht zuverlässig** — der Embla-Carousel im Lightbox hat kein `touch-action` und das Dialog-Overlay fängt Touch-Events ab
3. **Back-Gesture schliesst nicht die Lightbox** — Radix Dialog pusht keinen History-Entry, daher navigiert der Browser zurück statt die Lightbox zu schliessen

## Lösung

**`src/components/FeedCard.tsx`** — drei Änderungen:

1. **History-basiertes Schliessen**: Beim Öffnen der Lightbox `window.history.pushState` aufrufen. Einen `popstate`-Listener registrieren der `setLightboxOpen(false)` aufruft. Beim manuellen Schliessen (X-Button) `history.back()` statt direkt `setLightboxOpen(false)`. So schliesst die Back-Gesture die Lightbox statt den Feed zu verlassen.

2. **Grösserer, deutlicherer Schliessen-Button**: X-Button grösser machen (z.B. `h-10 w-10` mit Background-Pill `bg-black/50 rounded-full p-2`) und zusätzlich ein Tap-anywhere-to-close auf den Hintergrund (nicht auf das Bild).

3. **Swipe-Navigation verbessern**: `dragFree: false` explizit setzen, `touch-action: pan-y` auf dem Container entfernen (damit horizontales Swipen funktioniert), und Pfeil-Buttons (< >) an den Seiten für Desktop-User hinzufügen.

### Technisch
- `useEffect` mit `popstate`-Listener, Cleanup bei unmount oder wenn Lightbox schliesst
- `onOpenChange` des Dialogs muss `history.back()` aufrufen statt direkt zu schliessen
- Embla-Container bekommt `touch-action: manipulation` für zuverlässiges Swiping

Eine Datei, keine DB-Änderungen.

