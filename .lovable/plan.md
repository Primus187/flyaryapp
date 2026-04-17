

# Was fehlt für den produktiven Erfolg

Die App hat bereits eine starke Feature-Basis (IGC, Social, Gamification, PWA, Offline). Für echten produktiven Erfolg fehlen aber **Vertrauen, Onboarding und Performance unter realen Bedingungen**. Hier meine ehrliche Analyse — sortiert nach Wirkung.

## 1. Onboarding & First-Run-Erlebnis (kritisch)

Heute: Neuer User landet auf leerem Dashboard, sieht „Keine Flüge", weiss nicht wo anfangen.

**Was fehlt:**
- **Geführter First-Run** (3–4 Schritte): Profil → erster Flug (IGC oder XLSX-Import als Shortcut) → optional Gruppe beitreten
- **Sample-Daten / Demo-Modus**: Ein Demo-Flug zum Erkunden, bevor man eigene erfasst
- **Empty-States mit Coach-Tipps**: Statt „Keine Flüge" → „So importierst du deine ersten Flüge: [Button: XLSX hochladen]"
- **XContest-Sync prominent im Onboarding** anbieten — viele Piloten haben dort schon Jahre an Daten

## 2. Vertrauen & Verlässlichkeit

Piloten investieren ihr Flugbuch nur, wenn sie sicher sind, dass nichts verloren geht.

**Was fehlt:**
- **Daten-Export** als CSV/XLSX direkt im Settings (nicht nur PDF) — „Meine Daten gehören mir"
- **Backup-Hinweis** im Profil: „Letzter Sync: vor 2 Min · 142 Flüge gespeichert"
- **Account löschen** UI (DSGVO-Pflicht, ist das implementiert?)
- **Versions-Historie / Soft-Delete** für Flüge — versehentliches Löschen rückgängig machen
- **Status-Page-Link** im More: „App-Status" zeigt Backend-Health

## 3. Performance & Wahrnehmung

**Was fehlt / zu prüfen:**
- **Bundle-Size-Audit**: Sind alle grossen Libs (MapLibre, Leaflet, recharts) wirklich lazy?
- **Image-Optimization**: Werden Avatare/Cover/Flugfotos in WebP + responsive sizes ausgeliefert?
- **Skeleton-Konsistenz**: Match zu finalem Layout auf allen Seiten (heute teils generisch)
- **Optimistic Updates** für Likes, Kommentare, Goal-Updates — sofortiges Feedback
- **Service-Worker-Strategie** prüfen: Funktioniert die App nach Flugtag im Tal mit schwachem Netz wirklich?

## 4. Mobile-Native-Feeling

Die App ist PWA + Capacitor, fühlt sich aber noch nicht 100% native an.

**Was fehlt:**
- **Pull-to-refresh** überall (heute nur Dashboard?)
- **Swipe-to-delete** in Listen (Flüge, Termine)
- **Safe-Area-Insets** für iPhone-Notch/Dynamic-Island sauber prüfen
- **Share-Sheet-Integration** (`navigator.share`) für Flüge/Profil
- **Deep-Links** für geteilte Flüge öffnen direkt in App (Capacitor)

## 5. Engagement & Retention

Damit Piloten täglich öffnen, nicht nur nach dem Flug.

**Was fehlt:**
- **Push-Notifications aktiv nutzen**: „Morgen Flugwetter in deiner Region", „Neuer Flug deines Followers", „Gruppen-Termin morgen"
- **Wochen-Wrap-up**: Sonntag-Push „Deine Woche: 3 Flüge, 8h, neuer Höhenrekord"
- **Streaks**: „5 Wochen in Folge geflogen" — Gamification-Hook
- **Wetter-Widget mit Lieblingsstandorten** auf Dashboard (heute separater Tab)

## 6. Social-Discovery

**Was fehlt:**
- **Vorschläge „Piloten in deiner Region folgen"** im Feed-Empty-State
- **Trending-Flüge** der Woche aus eigenen Gruppen
- **Hashtags / Tags** für Flüge (#bisestable, #thermik, #abendflug)
- **Kommentare auf eigene Flüge** in Push-Notifications einbinden

## 7. Pilot-spezifische Profi-Features

Was Piloten von Strava abheben würde:

**Was fehlt:**
- **Wing-Stats**: Stunden/Flüge pro Schirm — wann ist Check fällig?
- **Standort-Insights**: „Dein bester Flug vom Niederbauen: 47 km am 12.05." auf Location-Detail
- **Flugbuch-Suche mit Volltext** (heute Search-Page — aber durchsucht sie alles?)
- **Multi-Pilot-Tag** auf Flügen („Mit @anna geflogen") — verlinkt beide Logbücher

## 8. Admin & Flugschul-Tools

Wenn Schulen wirklich onboarden sollen:

**Was fehlt:**
- **Lehrer-Notizen pro Flug** des Schülers (privat sichtbar)
- **Kursverwaltung**: Schüler-Kohorten / Klassen
- **Schul-Branding** (Logo) im Schul-Dashboard
- **Bulk-Aktionen**: Schüler-Liste exportieren, Massen-Einladungen

## 9. Rechtlich & Trust

**Was zu prüfen:**
- **Cookie/Tracking-Consent** falls Analytics aktiv
- **Nutzungsbedingungen (AGB)** zusätzlich zu Datenschutz/Impressum
- **Altersbeschränkung** + Eltern-Consent unter 16
- **Lizenzhinweise** für genutzte OSS (Leaflet, MapLibre, Icons)

## 10. Quality-Checks

- **Lighthouse-Score** prüfen (PWA, Performance, A11y)
- **Real-Device-Testing** auf iPhone SE (klein) und Android-Mid-Range (langsam)
- **Crash-Reporting** (Sentry o.ä.) — heute nicht ersichtlich
- **Analytics-Funnel** (z. B. PostHog): Wo brechen User ab?

## Meine Top-3-Empfehlung für nächste Iteration

Wenn du nur 3 Dinge angehst, dann:

1. **Onboarding-Flow** (Punkt 1) — entscheidet über 80% der Conversion
2. **Daten-Export + Account-Löschen** (Punkt 2) — Vertrauen + DSGVO-Pflicht
3. **Push-Notifications aktiv nutzen** (Punkt 5) — bringt User zurück

Welchen Bereich soll ich als nächstes angehen? Oder soll ich aus 1+2+3 ein konkretes Implementierungs-Paket schnüren?

