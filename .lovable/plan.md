

# Dark Mode Fixen

## Probleme
1. **AppLayout.tsx**: Hardcodierter heller Gradient (`hsl(210 20% 98%)` → `hsl(199 30% 96%)`) — bleibt weiss im Dark Mode
2. **Dark-Mode CSS-Variablen**: Card/Background zu ähnlich, muted-foreground zu blass, Farben passen nicht zum Flyary-Branding (Blau/Grün)
3. **Dashboard**: `bg-card/80` Cards mit weissem Durchscheinen
4. **BottomNav**: `bg-card/90` bleibt hell im Dark Mode (card variable fix reicht)

## Änderungen

### 1. `src/index.css` — Dark-Mode Variablen überarbeiten
- Background: tiefes Dunkelblau (`215 28% 8%`)
- Card: leicht heller als Background (`215 25% 12%`)
- Muted: sichtbarer Kontrast (`215 20% 18%`)
- Muted-foreground: heller für Lesbarkeit (`200 15% 65%`)
- Primary/Secondary: leicht gesättigt für Flyary-Branding
- Border/Input: subtiler, passend zum dunklen Hintergrund (`215 20% 16%`)
- Sidebar-Variablen analog anpassen

### 2. `src/components/AppLayout.tsx` — Dynamischer Gradient
- CSS-Klassen statt inline style verwenden
- Im Dark Mode: dunkler Gradient passend zu `--background`
- Lösung: `useTheme` Hook nutzen und Gradient conditional setzen, oder besser: CSS-Variable/Tailwind `dark:` Klasse

### 3. Prüfung der Status-Badge-Farben und Icon-Farben
- Hardcodierte `text-green-600`, `bg-green-100` etc. brauchen `dark:` Varianten (teilweise schon vorhanden laut Code)

## Dateien
- **Edit**: `src/index.css` — Dark-Palette verfeinern
- **Edit**: `src/components/AppLayout.tsx` — Dark-Mode-fähiger Gradient

