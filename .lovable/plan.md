

# Optimierungen für den Launch von Flyary

## 1. Onboarding-Flow für neue User (hoch)
Neue User landen auf einem leeren Dashboard ohne Orientierung. Ein kurzer Onboarding-Flow würde helfen:
- **Welcome-Screen** nach dem ersten Login: kurze Erklärung was Flyary ist, 3 Schritte (Profil ausfüllen, ersten Ort anlegen, ersten Flug erfassen)
- **Empty States** auf allen Listen (Flugbuch, Orte, Termine): statt leerer Seite ein hilfreicher Hinweis mit CTA-Button ("Erfasse deinen ersten Flug")
- Prüfung ob Profil ausgefüllt ist, wenn nicht: dezenter Hinweis auf Dashboard

## 2. Loading States & Skeleton Screens (hoch)
Aktuell zeigen die meisten Seiten nichts, bis die Daten geladen sind. Das wirkt langsam.
- Skeleton-Loader auf Dashboard, Flugbuch, Orte, Termine
- Konsistente Loading-Experience über die ganze App

## 3. Pull-to-Refresh (mittel)
Als mobile-first PWA erwarten User, dass sie durch Herunterziehen die Daten aktualisieren können. Aktuell muss man die Seite neu laden.

## 4. Error Handling & Offline-Feedback (mittel)
- Wenn Netzwerk fehlt: Banner "Du bist offline" statt stille Fehler
- Retry-Buttons bei fehlgeschlagenen Ladevorgängen
- Bessere Fehlermeldungen bei API-Fehlern (nicht nur den technischen Error-Text)

## 5. Datenschutz & Impressum (hoch für Launch)
Für eine öffentlich zugängliche App (besonders in CH/DE/AT) brauchst du:
- Impressum-Seite
- Datenschutzerklärung
- Link zu beiden im Footer oder in den Einstellungen

## Empfohlene Reihenfolge
Für den Launch würde ich mit **Empty States + Onboarding** und **Impressum/Datenschutz** beginnen, da diese den grössten Unterschied für neue User machen.

## Dateien (bei Umsetzung)
- **Neu**: `src/components/EmptyState.tsx` — Wiederverwendbare Komponente
- **Neu**: `src/components/OnboardingDialog.tsx` — Welcome-Flow
- **Neu**: `src/pages/Legal.tsx` — Impressum/Datenschutz
- **Edit**: `src/pages/Dashboard.tsx`, `src/pages/Flights.tsx`, `src/pages/Locations.tsx`, `src/pages/Events.tsx` — Empty States + Skeletons
- **Edit**: `src/components/AppLayout.tsx` — Offline-Banner
- **Edit**: `src/i18n/locales/{de,en,fr}.json` — Übersetzungen

