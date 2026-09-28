# Flyary – eigenständige Landingpage

Öffentliche Website für Pilotinnen, Piloten und Flugschulen in Deutsch, Französisch und Englisch. Sie wird separat von der Flyary-App gebaut und gehostet. App-Routing, Authentifizierung, Supabase und PWA bleiben unverändert.

## Lokal ansehen

Im Repository-Hauptverzeichnis:

```powershell
npm ci --prefix website --ignore-scripts
npm run landing:build
npm run landing:preview
```

Danach `http://127.0.0.1:4188` öffnen. `/de/`, `/fr/` und `/en/` enthalten die Sprachversionen; `/` zeigt Deutsch. Der Vorschauprozess läuft weiter, bis er mit Ctrl+C beendet wird. Über `PORT` kann bei Bedarf ein anderer Port gewählt werden.

Der Ordner `website/` hat einen eigenen Build: Alternativ darin `npm ci --ignore-scripts`, `npm run build` und `npm run preview` verwenden. Er benötigt Node.js (im Projekt Node 22), den über `package-lock.json` fixierten Markdown-Parser Marked und die Dokumentquellen im benachbarten `docs/`-Ordner. Zugangsdaten sind nicht nötig. Das Ergebnis liegt unter `website/dist/` und besteht aus HTML, CSS, JavaScript, Bildern und Word-Downloads. Marked wird nur beim Build ausgeführt. Die App wird dabei weder gebaut noch gestartet.

## Inhalte und Gestaltung

- `content.mjs`: sämtliche redaktionellen Texte in DE/FR/EN, einschliesslich Metadaten, FAQ, Funktionsband (`highlights`) und Schlagworten im Einstieg (`heroChips`). Nur umgesetzte Funktionen nennen.
- `build.mjs`: semantische HTML-Seiten: Einstieg mit Nachthimmel und Flugspur, Funktionsband, Produkt-Tour mit Handy-Modell, Pilotenkarten, Flugschul-Zeitstrahl, Community, FAQ und Abschluss.
- `site.css`: responsives Design (Stand 28.09.2026) in Flyarys Blau-Grün mit Systemschriften, Glasflächen und Animationen: Farbschimmer, sich zeichnende Flugspur mit Gleitschirm, schwebende und mit der Maus kippende Handys, laufendes Funktionsband, gestaffeltes Einblenden, Lichtkegel auf Karten, Zeitstrahl beim Scrollen. Alle Animationen nur bei erlaubter Bewegung; bei «Bewegung reduzieren» ist alles statisch und sichtbar. Wird auch von den Hilfeseiten genutzt.
- `site.js`: mobile Navigation, per Tastatur bedienbare Vorschau-Tabs mit Überblendung, Glas-Kopfzeile beim Scrollen, Einblenden per IntersectionObserver, Kippen und Lichtkegel nur mit Maus. `boot.js` setzt vor dem Rendern die Klasse `js` (eigene Datei, weil die CSP in `vercel.json` keine eingebetteten Skripte erlaubt). Inhalt, FAQ und Navigation funktionieren ohne JavaScript.
- `assets/`: Kopien des bestehenden Flyary-Bildmaterials; keine externen Bild- oder Schriftanfragen.

**App-Adresse:** `https://app.flyary.ch`.
**Kontakt:** `tobias.a.bolliger@gmail.com`. Die Schulanfrage öffnet einen E-Mail-Entwurf; die Website versendet selbst keine Nachricht.

Die Gestaltung orientiert sich an [Framers Landingpage-Empfehlungen](https://www.framer.com/blog/landing-page-best-practices/): ein verständlicher Einstieg, sichtbares Produkt, ein klarer Hauptaufruf und konkrete Antworten vor der Anmeldung. Flyarys Blau, eine klare typografische Hierarchie und ein ruhiges Raster verbinden die Website mit der App. Der dunkle Flugschulbereich hat einen eigenen Kontaktaufruf.

Die Bildschirmansichten sind echte App-Aufnahmen aus den deutschen Handbüchern (`docs/handbook/`) mit fiktiven Beispieldaten; der Hinweis steht einmal im Einstieg und in der Fusszeile. Jede Aufnahme erscheint nur einmal und passt zur Aussage ihres Abschnitts: Einstieg `logbook.png` (mobile/06-flightbook) und `stats.png` (mobile/12-stats); Produkt-Tour `overview.png` (mobile/01-home), `flight-detail.png` (mobile/19-flight-view), `training.png` (mobile/10-training), `school.png` (school-mobile/01-overview); Flugschulen `cockpit.png` (school-mobile/34-coaching); Community `feed.png` (mobile/22-feed). Für aktuellere Ansichten die Dateien in `assets/` aus neuen Handbuch-Aufnahmen ersetzen.

Es gibt keine erfundenen Kundenstimmen, Nutzerzahlen oder Preisversprechen. Die Texte beschreiben implementierte Funktionen. Anmeldung erfolgt entsprechend dem aktuellen App-Stand mit Google. Die Website setzt keine Cookies, nutzt kein LocalStorage und bindet weder Analytics noch externe Schriftanbieter ein. Ein Hostinganbieter kann unabhängig davon Zugriffsprotokolle führen.

## Wissen & Hilfe

Veröffentlicht werden nur die zwei Benutzerhandbücher; die technische Dokumentation bleibt bewusst intern (Entscheid 28.09.2026). Navigation und Footer verlinken `/de/docs/`, `/fr/docs/` beziehungsweise `/en/docs/`. Diese Einstiegsseiten haben übersetzte Bedienelemente und weisen auf die deutsche Sprache der Dokumente hin. Die Dokumenttexte werden nicht automatisch übersetzt.

- `/de/docs/pilots/`: Pilotenhandbuch, 27 einzeln aufrufbare Kapitel, Word-Download v1.5.
- `/de/docs/schools/`: Schulhandbuch, 31 einzeln aufrufbare Kapitel, Word-Download v1.4.

`build-docs.mjs` liest die freigegebenen öffentlichen Fassungen aus `website/documents/` (Liste in `publication.mjs`, mit Prüfung gegen interne Inhalte) bei jedem Build; die Handbuchbilder kommen aus `docs/handbook/`. Kapitel entstehen aus Überschriften der zweiten Ebene; deren Titel bestimmen den URL-Pfad. Interne Dokumentlinks und Abschnittsanker werden auf die Webziele umgeschrieben. Verweise auf Quellcode ausserhalb der Dokumentation bleiben als gekennzeichneter Text mit Repository-Pfad erhalten; die Website veröffentlicht diese Quelldateien nicht. Rohes HTML aus Markdown wird als Text ausgegeben. Nur referenzierte Handbuchbilder und die beiden ausgewählten Word-Versionen werden kopiert.

Die Seiten bieten Kapitelnavigation, Vor-/Zurück-Links, Abschnittsübersichten, vergrösserbare Bilder, Tabellen mit eigenem horizontalem Scrollbereich und Drucken/PDF über den Browser. Die lokale Volltextsuche in `docs.js` durchsucht Titel und Inhalte, gewichtet Titeltreffer höher und zeigt bis zu 20 Ergebnisse. Sie benötigt keinen Suchdienst und sendet keine Suchbegriffe. Ohne JavaScript bleiben alle Dokumente und Kapitel zugänglich.

Handbücher weiterhin in `docs/` pflegen und für eine Veröffentlichung nach `website/documents/pilots.md` bzw. `schools.md` kopieren (öffentliche Fassung, bewusst getrennt), anschliessend `npm run landing:build` ausführen. Bei einer neuen Word-Version die beiden Download-Dateinamen am Anfang von `build-docs.mjs` aktualisieren. Änderungen an Kapiteltiteln ändern deren Webadressen; bei bereits veröffentlichten Seiten entsprechende Weiterleitungen ergänzen. `docs-content.mjs` enthält die dreisprachigen Einstiegstexte, `docs.css` die Lesedarstellung.

## Separat veröffentlichen

Noch nicht veröffentlicht. Für ein separates Vercel-Projekt dasselbe Repository verbinden, **Root Directory `website`** wählen, **Framework Preset Other**, Build-Befehl **`node build.mjs`**, Ausgabeverzeichnis **`dist`**. Die Konfiguration dieses Ordners gehört nur zum Website-Projekt; die vorhandene `vercel.json` im App-Hauptverzeichnis bleibt unverändert.

Der Build benötigt Zugriff auf `../docs/`: im Vercel-Projekt die Bereitstellung von Dateien ausserhalb des Root Directory für den Build aktivieren, siehe [Vercel: gemeinsame Quelldateien](https://vercel.com/docs/monorepos/monorepo-faq). Die Installation erfolgt mit `npm ci --ignore-scripts` gemäss `website/vercel.json`. Ein alleiniger Upload des Quellordners `website/` reicht deshalb nicht; ein Upload des fertig gebauten `website/dist/` ist vollständig.

Für die endgültige Landingpage-Domain `SITE_URL` im Website-Projekt setzen, beispielsweise `https://<eure-landingpage-domain>`. Mit dieser Umgebungsvariable erzeugt der Build absolute Canonical-/Open-Graph-URLs, hreflang-Verweise und die Sitemap. Ohne bekannte Domain werden keine Domainwerte erfunden und keine Sitemap-Einträge erzeugt. `SITE_URL` ist öffentlich, kein Secret.

Alternativ den Inhalt von `dist/` auf einem statischen Webhost veröffentlichen, der Verzeichnis-Indizes wie `/fr/index.html` ausliefert. Kein SPA-Fallback auf die Flyary-App einrichten. Die Website benötigt keinen Supabase-Zugang und keine eigenen Auth-Callbacks.

Vor einer Veröffentlichung: endgültige Domain setzen, Bildnutzungsrechte bestätigen und die rechtlichen Footer-Ziele prüfen. Aktuell führen Datenschutz/Impressum und Nutzungsbedingungen zu den entsprechenden App-Seiten; diese sind im aktuellen App-Router hinter der Anmeldung. Für eine öffentliche Veröffentlichung sind öffentlich erreichbare, zum gewählten Website-Hosting passende Rechtstexte erforderlich. Diese Umsetzung ändert weder die App-Zugriffsregeln noch erfindet sie Angaben zu einem noch nicht gewählten Hostinganbieter.

## Prüfung

Nach einem Build im Repository-Hauptverzeichnis:

```powershell
npm run landing:check
```

Verwendet das vorhandene Playwright, unter Windows Microsoft Edge, auf anderen Systemen Chromium. Prüft die drei Sprachen bei 1440, 900, 390 und 320 Pixeln, horizontales Überlaufen, Bildproportionen im Einstieg, Tabs und Tastatursteuerung, FAQ, mobiles Menü, Sprachwechsel, Linkziele sowie den Betrieb ohne JavaScript. Externe Anfragen werden blockiert; es wird keine App-Sitzung angelegt und keine E-Mail versandt. Vorschauen liegen unter `website/.preview/` (ignoriert). Der Test startet und beendet seinen eigenen lokalen Server auf Port 4186.

`check-docs.mjs` ergänzt die Prüfung sämtlicher generierter Dokumentseiten auf lokale Linkziele, Abschnittsanker, Bilder, eindeutige Überschriften-IDs und übrig gebliebene Druckdirektiven. Browserprüfungen decken Suche in allen Einstiegssprachen, Word-Dateien und MIME-Typen, Kapitelwechsel, Desktop/Mobil und Zugang ohne JavaScript ab.

Abnahme am 28. September 2026: alle zwölf Sprach-/Breitenkombinationen bestanden, einschliesslich Tastaturbedienung, Sprachwechsel und No-JavaScript-Fallback. Desktop- und Mobilansichten wurden zusätzlich visuell geprüft. Der erste Sandboxlauf scheiterte an `spawn EPERM`; der erfolgreiche Browserlauf erfolgte ausserhalb der Sandbox. Kein Hosting-Deployment ausgeführt.
