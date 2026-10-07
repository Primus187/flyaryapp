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

Der Ordner `website/` hat einen eigenen Build: Alternativ darin `npm ci --ignore-scripts`, `npm run build` und `npm run preview` verwenden. Er benötigt Node.js (im Projekt Node 22), den über `package-lock.json` fixierten Markdown-Parser Marked und die Handbuchbilder im benachbarten `docs/`-Ordner. Das Ergebnis liegt unter `website/dist/` und besteht aus HTML, CSS, JavaScript, Bildern, lokaler Schrift und dem bestehenden Markenfilm. Marked wird nur beim Build ausgeführt. Bei geändertem App-Quellstand startet der Build die lokale App mit Playwright und nimmt beide Handbuch-Bildserien neu auf. Dafür werden zusätzlich die Root-Abhängigkeiten, Microsoft Edge und die lokale Vite-Konfiguration benötigt. Bei aktuellem Bildnachweis entfällt die Neuaufnahme.

## Inhalte und Gestaltung

- `content.mjs`: sämtliche redaktionellen Texte in DE/FR/EN, einschliesslich Metadaten, Claim (`claim`) und FAQ. Nur umgesetzte Funktionen nennen. Einige Schlüssel der früheren Startseite (`hero`, `highlights`, `heroChips`, `pilotFeatures`) werden nicht mehr ausgegeben.
- `build.mjs`: semantische HTML-Seiten. Die Startseite (Stand 07.10.2026) ist ein Flug vom Gipfel zur Landewiese: Einstieg mit «Flyary» hinter dem Schneegrat, App-Ansichten mit vier Reitern, Flugschulen, Film und Fragen, Abschluss. Dahinter steht eine Bühne aus vier gemalten Szenen in Tiefenebenen.
- `site.css`: was alle Seiten teilen (Schrift Plus Jakarta Sans, Kopfzeile, Knöpfe, Anmeldeseiten, Fusszeile). Die variable Schrift und ihr Lizenztext liegen lokal in `assets/`; es gibt keine externe Schriftanfrage. Wird auch von den Hilfeseiten genutzt.
- `home.css`: nur die Startseite, in drei Fassungen (`boot.js` wählt). Ohne Klasse: kein Skript nötig, jede Szene steht als Bild still, das nächste Kapitel schiebt sich mit gemalter Wolken-, Tannen- oder Wiesenkante darüber (ohne JavaScript, «Bewegung reduzieren»). `.touch-on` (Touch-Geräte): dieselbe Seite, dahinter die Bühne mit den hinteren Ebenen jeder Szene; Text, Untergrund und Kante bleiben normaler Seiteninhalt, weil ein Skript beim schnellen Wischen nicht mit dem Scrollen Schritt hält. `.stage-on` (Maus und Trackpad): alles wird von `stage.js` bewegt.
- `stage.js`: bewegt die Ebenen der vier Szenen und den Gleitschirm passend zur Scrollposition (nur `transform`/`opacity`; Folgeszenen liegen vorab fertig bereit). Auf Touch-Geräten bewegt es nur die hinteren Ebenen und den Schirm und tauscht eine Szene erst, wenn ein Kapitel den Bildschirm ganz bedeckt. Die Zahlen am Dateianfang (Zeilen im Bild, Flugbahn, Landepunkt) gehören zu den Bildern in `landscape-work`.
- `soundscape.js`: optionale Klanglandschaft mit lokalisierten Ton-Schaltern. Erst ein Klick lädt die fünf lokalen MP3s aus `assets/audio/` und aktiviert Web Audio; keine Speicherung der Tonwahl. Nach Aktivierung bleibt nur ein kleines Lautsprechersymbol mit zugänglicher Beschriftung sichtbar. Alle Klänge folgen der geglätteten Scrollgeschwindigkeit und klingen beim Lesen innerhalb weniger Sekunden bis zur Stille ab. Flugwind ist der Hauptklang, Gipfelwind bleibt leise. Open Horizon begleitet ihn als leise Hintergrundmusik; ihr Mischpegel wird anhand von RMS und Spitzenpegel begrenzt, der Schleifenübergang über fünf Sekunden überblendet. Naturatmosphäre erklingt nur als leiser Akzent von etwa 1,2 Sekunden pro Szene; der Adler höchstens einmal und maximal 0,65 Sekunden mit kurzem Ausklang. Die Szenenwerte kommen aus `stage.js`, bei reduzierter Bewegung aus den Kapitelpositionen. Atmosphärenschleifen überblenden Ende und Anfang im Audiopuffer. Bei Landung klingt Flugwind ab, bei Filmwiedergabe oder verborgenem Tab pausiert der Audiokontext. Originaldateinamen stehen in `assets/audio/SOURCES.md`. Die CSP erlaubt dafür ausschliesslich Verbindungen zur eigenen Website.
- `landscape-work/`: Werkstatt der Landschaft. `layers/web/` enthält die ausgelieferten WebP-Ebenen in zwei Breiten (der Build kopiert sie nach `dist/assets/landscape`), `layers/*.py` die Skripte, die eine gemalte Szene in Ebenen zerlegen (`split.py`), exportieren (`export.py`, `extras.py`), den Windsack freistellen und auf die Landewiese setzen (`windsock.py`, nach `split.py` und vor dem Export) und den Schirm freistellen (`cutout.py`; brauchen Python mit numpy, scipy, Pillow). Die Originalszenen in `layers/src/` sind nicht im Repository. Dort liegen auch `app-screens.py` (WebP-Kopien der App-Ansichten nach `assets/screens/`; der Build nimmt eine Kopie nur, solange sie zum aktuellen Handbuch-Screenshot passt, sonst das PNG) und `og-image.mjs` (Link-Vorschaubilder `assets/og-*.jpg` aus dem gebauten Hero).
- `site.js`: mobile Navigation, per Tastatur bedienbare Vorschau-Tabs, Kopfzeile (Glas beim Scrollen; auf der Startseite weicht sie beim Hinunterscrollen und kommt beim Hochscrollen zurück), Einblenden auf den Anmeldeseiten, Film-Startknopf. `boot.js` setzt vor dem Rendern die Klasse `js` und schaltet auf der Startseite die bewegte Fassung ein (eigene Datei, weil die CSP in `vercel.json` keine eingebetteten Skripte erlaubt). Inhalt, FAQ und Navigation funktionieren ohne JavaScript.
- `assets/`: Kopien des bestehenden Flyary-Bildmaterials; keine externen Bild- oder Schriftanfragen.

**App-Adresse:** `https://app.flyary.ch`.
**Kontakt:** `info@flyary.ch`. Die Schulanfrage öffnet einen E-Mail-Entwurf. Das Testpilotenformular übermittelt Anmeldungen an den vorhandenen Anmeldedienst; lokale Browserprüfungen ersetzen diese Anfrage durch eine Testantwort.

Die Gestaltung orientiert sich an [Framers Landingpage-Empfehlungen](https://www.framer.com/blog/landing-page-best-practices/): ein verständlicher Einstieg, sichtbares Produkt, ein klarer Hauptaufruf und konkrete Antworten vor der Anmeldung. Flyarys Blau, eine klare typografische Hierarchie und ein ruhiges Raster verbinden die Website mit der App. Der dunkle Flugschulbereich hat einen eigenen Kontaktaufruf.

Die Bildschirmansichten sind echte App-Aufnahmen aus den deutschen Handbüchern (`docs/handbook/`) mit fiktiven Beispieldaten. Jede Ansicht passt zu ihrem Abschnitt: Einstieg `logbook.png` (mobile/06-flightbook) und `stats.png` (mobile/12-stats); Produkt-Tour `memories.png` (mobile/59-flight-memories), `training.png` (mobile/10-training), `school-flight.png` (mobile/20-flight-notes) und `feed.png` (mobile/22-feed); Flugschulen `cockpit.png` (school-mobile/34-coaching). Diese Bilder werden beim Build direkt aus den geprüften aktuellen Handbuch-Aufnahmen übernommen. Der Flyary-Markenfilm bleibt in der Über-uns-Sektion erhalten.

Es gibt keine erfundenen Kundenstimmen, Nutzerzahlen oder Preisversprechen. Die Texte beschreiben implementierte Funktionen. Anmeldung erfolgt entsprechend dem aktuellen App-Stand mit Google. Die Website setzt keine Cookies, nutzt kein LocalStorage und bindet weder Analytics noch externe Schriftanbieter ein. Ein Hostinganbieter kann unabhängig davon Zugriffsprotokolle führen.

## Wissen & Hilfe

Veröffentlicht werden nur die zwei Benutzerhandbücher; die technische Dokumentation bleibt bewusst intern (Entscheid 28.09.2026). Navigation und Footer verlinken `/de/docs/`, `/fr/docs/` beziehungsweise `/en/docs/`. Diese Einstiegsseiten haben übersetzte Bedienelemente und weisen auf die deutsche Sprache der Dokumente hin. Die Dokumenttexte werden nicht automatisch übersetzt.

- `/de/docs/pilots/`: Pilotenhandbuch v1.6, 27 einzeln aufrufbare Kapitel.
- `/de/docs/schools/`: Schulhandbuch v1.5, 32 einzeln aufrufbare Kapitel.

`build-docs.mjs` liest die freigegebenen öffentlichen Fassungen aus `website/documents/` (Liste in `publication.mjs`, mit Prüfung gegen interne Inhalte) bei jedem Build; die Handbuchbilder kommen aus `docs/handbook/`. Kapitel entstehen aus Überschriften der zweiten Ebene; deren Titel bestimmen den URL-Pfad. Bestehende Kapiteltitel bleiben bei dieser Aktualisierung erhalten; Kapitel 32 kommt neu hinzu. Interne Dokumentlinks und Abschnittsanker werden auf die Webziele umgeschrieben. Rohes HTML aus Markdown wird als Text ausgegeben. Nur referenzierte Handbuchbilder werden kopiert. Die Word-Ausgaben werden lokal aus denselben Texten erzeugt und gehören derzeit nicht zum Website-Build.

Die Seiten bieten Kapitelnavigation, Vor-/Zurück-Links, Abschnittsübersichten, vergrösserbare Bilder, Tabellen mit eigenem horizontalem Scrollbereich und Drucken/PDF über den Browser. Die lokale Volltextsuche in `docs.js` durchsucht Titel und Inhalte, gewichtet Titeltreffer höher und zeigt bis zu 20 Ergebnisse. Sie benötigt keinen Suchdienst und sendet keine Suchbegriffe. Ohne JavaScript bleiben alle Dokumente und Kapitel zugänglich.

Handbücher weiterhin in `docs/` pflegen und für eine Veröffentlichung nach `website/documents/pilots.md` bzw. `schools.md` kopieren (öffentliche Fassung, bewusst getrennt), anschliessend `npm run landing:build` ausführen. Änderungen an Kapiteltiteln ändern deren Webadressen; bei bereits veröffentlichten Seiten entsprechende Weiterleitungen ergänzen. `docs-content.mjs` enthält die dreisprachigen Einstiegstexte, `docs.css` die Lesedarstellung.

## Separat veröffentlichen

Die Website ist laut Betreiber bereits veröffentlicht. Lokale Änderungen werden mit dem Build vorbereitet; sie erscheinen auf der veröffentlichten Website erst nach deren Deployment. Für ein separates Vercel-Projekt dasselbe Repository verbinden, **Root Directory `website`** wählen, **Framework Preset Other**, Build-Befehl **`node build.mjs`**, Ausgabeverzeichnis **`dist`**. Die Konfiguration dieses Ordners gehört nur zum Website-Projekt; die vorhandene `vercel.json` im App-Hauptverzeichnis bleibt unverändert.

Der Build benötigt Zugriff auf `../docs/`: im Vercel-Projekt die Bereitstellung von Dateien ausserhalb des Root Directory für den Build aktivieren, siehe [Vercel: gemeinsame Quelldateien](https://vercel.com/docs/monorepos/monorepo-faq). Die Installation erfolgt mit `npm ci --ignore-scripts` gemäss `website/vercel.json`. Ein alleiniger Upload des Quellordners `website/` reicht deshalb nicht; ein Upload des fertig gebauten `website/dist/` ist vollständig.

Für die endgültige Landingpage-Domain `SITE_URL` im Website-Projekt setzen, beispielsweise `https://<eure-landingpage-domain>`. Mit dieser Umgebungsvariable erzeugt der Build absolute Canonical-/Open-Graph-URLs, hreflang-Verweise und die Sitemap. Ohne bekannte Domain werden keine Domainwerte erfunden und keine Sitemap-Einträge erzeugt. `SITE_URL` ist öffentlich, kein Secret.

Alternativ den Inhalt von `dist/` auf einem statischen Webhost veröffentlichen, der Verzeichnis-Indizes wie `/fr/index.html` ausliefert. Kein SPA-Fallback auf die Flyary-App einrichten. Die Website benötigt keinen Supabase-Zugang und keine eigenen Auth-Callbacks.

Die Footer-Links zu Datenschutz/Impressum und Nutzungsbedingungen führen zu den öffentlich erreichbaren App-Seiten. Der Website-Build verwendet für absolute SEO-Links weiterhin die konfigurierte Domain `SITE_URL`.

## Prüfung

Nach einem Build im Repository-Hauptverzeichnis:

```powershell
npm run landing:check
```

`node website/check-sound.mjs` prüft zusätzlich mit den echten MP3s die Audio-Aktivierung per Tastatur, verzögertes Laden, die produktive CSP, Desktop/Touch/reduzierte Bewegung, scrollabhängigen Wind, Landung, Filmpause, Stummschalten und Wiederaktivierung ohne doppelte Schleifen.

Verwendet das vorhandene Playwright, unter Windows Microsoft Edge, auf anderen Systemen Chromium. Prüft die drei Sprachen bei 1440, 900, 390 und 320 Pixeln, horizontales Überlaufen, Bildproportionen im Einstieg, Tabs und Tastatursteuerung, FAQ, mobiles Menü, Sprachwechsel, Linkziele sowie den Betrieb ohne JavaScript. Externe Anfragen werden blockiert; es wird keine App-Sitzung angelegt und keine E-Mail versandt. Vorschauen liegen unter `website/.preview/` (ignoriert). Der Test startet und beendet seinen eigenen lokalen Server auf Port 4186.

`check-docs.mjs` ergänzt die Prüfung sämtlicher generierter Dokumentseiten auf lokale Linkziele, Abschnittsanker, Bilder, eindeutige Überschriften-IDs und übrig gebliebene Druckdirektiven. Browserprüfungen decken Suche in allen Einstiegssprachen, Kapitelwechsel, Desktop/Mobil und Zugang ohne JavaScript ab.

Abnahme am 6. Oktober 2026: alle zwölf Sprach-/Breitenkombinationen bestanden, einschliesslich Tastaturbedienung, Sprachwechsel, Testpilotenformular und No-JavaScript-Fallback. Die 64 Online-Dokumentseiten und 116 referenzierten Handbuchbilder wurden auf Links, Anker, Suche und Darstellung geprüft. Der Build verwendet die vollständig neu aufgenommenen App-Ansichten sowie die aktualisierten Handbücher. Mobilansichten wurden zusätzlich visuell geprüft. Der Browserlauf erfolgte wegen `spawn EPERM` ausserhalb der Sandbox. Kein Hosting-Deployment ausgeführt.
