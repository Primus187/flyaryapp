# Performance-Optimierungen

Stand: 21. September 2026. Phase 4 bleibt ausserhalb dieser Änderungen.

## Auslieferung

**Vor dem neuen Frontend `drizzle/migrations/0015_performance_read_models.sql` nach den bisherigen Migrationen anwenden.** Ohne diese Migration können die neue Flugliste und Schulübersicht ihre Daten nicht laden.

Die Migration ergänzt Track-Vorschauen, Indizes und die RPCs `list_flights_page` und `school_dashboard_data`. Sie wurde lokal mit PostgreSQL/PGlite getestet und beim Rollout am 22. September 2026 produktiv angewendet. Dabei wurden auch die noch fehlenden Voraussetzungen 0003–0014 nachgeholt: erst ein Transaktions-Probelauf mit Rollback, dann der erfolgreiche gemeinsame Commit einschliesslich Migrationsjournal. Alle 16 vorhandenen Tracks haben korrekte Vorschauen; Originaltracks bleiben erhalten. Ein Trigger aktualisiert Vorschauen bei Inserts und Änderungen an `track_data`.

Die RPCs verwenden `SECURITY INVOKER`, bestehende RLS-Regeln und ausschliesslich Ausführungsrechte für angemeldete Benutzer. Schulabfragen prüfen zusätzlich die Staff-Berechtigung. Der geprüfte Benutzerparameter trennt die GET-URLs im Offline-Cache. Beim Abmelden werden Query- und API-Cache geleert.

## Änderungen

- Flugbuch: 40 Flüge pro Seite, serverseitige Suche und Filter über alle eigenen Flüge. Vorschauen mit maximal 40 Koordinaten statt vollständiger IGC-Tracks. Beim erneuten Öffnen wird die Liste aktualisiert. Suchfeld und Filter bleiben während des Ladens bedienbar.
- Schule: SQL-Aggregate statt Übertragung aller Flüge, Bewertungen und Notizen. Bereiche laden ihren Programmcode und ihre Daten erst beim Öffnen. Schulzugehörigkeiten werden gemeinsam zwischengespeichert.
- Feed: Challenge-Ziele und Fortschritte werden gebündelt abgefragt. Zusätzliche Seiten verhindern abgeschnittene Ergebnisse beim API-Zeilenlimit. Fortschritt bleibt nach Challenge und Pilot getrennt.
- Start: dynamische Sprachdateien, Karten- und Diagrammcode erst bei Bedarf, kein vorsorglicher Feed-Download. Startanimation einmal pro Tab-Sitzung mit 300 ms Mindestdauer und 150 ms Ausblendung, sofern die Daten bereit sind.
- PWA: kein Analysebericht im Precache. App-Chunks bleiben für die vorhandene Offline-Funktion im Precache. `npm run build:analyze` erzeugt bei Bedarf die Treemap.

## Messung

| Messgrösse | Vorher | Nachher |
| --- | ---: | ---: |
| JavaScript aus HTML-Einstieg und Preloads, gzip | 439 539 Bytes | 214 739 Bytes |
| Analysebericht im PWA-Precache, unkomprimiert | 1 597 055 Bytes | 0 Bytes |

Das initiale HTML-JavaScript sinkt um 51,1 %. Sprachdateien und später geladene Routen kommen hinzu. Deutsch benötigt etwa 19 kB gzip; Französisch und Englisch laden zusätzlich Deutsch als Fallback. Dies ist keine mobile Ladezeitmessung. Der Browser-Smoke-Test bestätigt, dass die Anmeldeseite keine Karten- oder Diagramm-Chunks lädt. Rohdaten: `performance-before.json` und `performance-after.json`.

```sh
npm run build
node scripts/measure-build.mjs docs/performance-after.json
npm test
npx tsc --noEmit -p tsconfig.app.json
```

Browser-Prüfung: `npm run preview -- --host 127.0.0.1 --port 4173` starten, dann `node scripts/smoke-build.mjs`. Benötigt den Playwright-Browser oder die Umgebungsvariable `BROWSER_CHANNEL=msedge` für installiertes Edge. Der Test verwendet keine Anmeldung und blockiert Service Worker, um die direkten Seitenanfragen zu messen.

Lokal geprüft: 166 erfolgreiche Tests, darunter PostgreSQL-Tests für Pagination, Suche, Fremdzugriff, anonyme Zugriffe, Schulaggregate, Backfill und Track-Trigger; Regressionstests für Splash-Timer und API-Zeilenlimits; TypeScript; Produktionsbuild; Browserstart auf Deutsch, Französisch und Englisch ohne Laufzeitfehler. Die lokalen Datenbanktests verwenden ein isoliertes, reduziertes Schema mit RLS. Produktiv wurden die Flugliste (40 von 90 Flügen, ohne vollständige Tracks) sowie die Schulbereiche Übersicht, Schüler, Flugtage und Ausrüstung unter der Rolle `authenticated` mit bestehenden Benutzerzuordnungen erfolgreich abgefragt. Separate Lastmessungen stehen aus.
