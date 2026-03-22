

# Scroll-to-Top bei Seitenwechsel

## Problem
Beim Navigieren zu einer neuen Seite bleibt die Scroll-Position der vorherigen Seite erhalten.

## Lösung
Eine `ScrollToTop`-Komponente erstellen, die bei jedem Routenwechsel `window.scrollTo(0, 0)` aufruft. Diese wird innerhalb des `BrowserRouter` in `App.tsx` platziert.

## Dateien
- **Neu**: `src/components/ScrollToTop.tsx` — `useEffect` mit `useLocation().pathname` als Dependency, ruft `window.scrollTo(0, 0)` auf
- **Edit**: `src/App.tsx` — `<ScrollToTop />` direkt nach `<BrowserRouter>` einfügen

