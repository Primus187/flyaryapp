

# Fix: Profilbild blinkt im Feed (Render-Loop)

## Problem
`fetchFeed` hat `groupIds` als Dependency im `useCallback`. Innerhalb von `fetchFeed` wird `setGroupIds(gIds)` aufgerufen, was den State ändert → `fetchFeed` bekommt eine neue Referenz → `useEffect(() => { fetchFeed(); }, [fetchFeed])` feuert erneut → endlose Schleife. Bei jedem Durchlauf werden neue signierte Avatar-URLs generiert, die das Bild neu laden lassen.

Zusätzlich wird `FeedStoryBar` mit `groupIds` als Prop übergeben — bei jedem Re-Render ein neues Array → StoryBar fetcht auch neu und deren Avatare blinken ebenfalls.

## Lösung

**`src/pages/Feed.tsx`:**
1. `groupIds` aus der `useCallback`-Dependency von `fetchFeed` entfernen — stattdessen über `useRef` zugreifen (`groupIdsRef`)
2. `setGroupIds` nur aufrufen wenn sich die IDs tatsächlich geändert haben (Vergleich mit vorherigem Wert)
3. `FeedStoryBar` mit `useMemo`-stabilisierten `groupIds` übergeben
4. `fetchFeed` aus der `useEffect`-Dependency entfernen — stattdessen einmalig beim Mount und wenn `user` sich ändert aufrufen

Eine Datei, vier kleine Änderungen.

