# Flyary-Handbücher erstellen

## Aktuelle Ausgaben vom 6. Oktober 2026

- [Pilotenhandbuch v1.6, korrigierte Vorschau](../Benutzerhandbuch-Piloten-v1.6-korrigiert.docx), [Markdown](../Benutzerhandbuch-Piloten.md): Google-Anmeldung und Pilotphase, neue Home-Ansicht, Ausbildungsstufen, Kontrollblatt, Ausbildung und Brevets im Profil, Fluglehrerbestätigung, Tandem und PDF-/CSV-/Excel-/ZIP-Export.
- [Schulhandbuch v1.5](../Betriebshandbuch-Flugschulen-v1.5.docx), [Markdown](../Betriebshandbuch-Flugschulen.md): neue Schuloberfläche, Schuleinrichtung, Ausbildungsstufen und selbst deklarierte Brevets, Start-Ansage, vorgezogener Tagesabschluss und neues Kapitel 32 für persönliche Flugbestätigungen.

Alle Bildschirmansichten werden aus dem aktuellen App-Code mit fiktiven Daten neu aufgenommen. Zusätzliche Ansichten zeigen das Kontrollblatt, Ausbildung/Brevets im Profil und die Flugbestätigungen. Die Beispieldaten bleiben auf September fixiert; das Aufnahmedatum steht im Manifest. Word-Generator und Vorschauwerkzeuge verwenden Piloten v1.6 und Schule v1.5. Historische Ausgaben bleiben erhalten.

Abnahme am 6. Oktober 2026: 62 Piloten- und 59 Schulansichten wurden vollständig neu aufgenommen, ohne Laufzeitfehler. `npm run handbook:check` bestätigt den aktuellen Quellstand und die Bildprüfsummen. Die Word-Ausgaben wurden mit aktualisierten Inhaltsverzeichnissen in Word paginiert: Piloten v1.6 mit 89 Seiten, 27 Kapiteln und 59 Abbildungen; Schule v1.5 mit 71 Seiten, 32 Kapiteln und 57 Abbildungen. DOCX-Struktur und Übereinstimmung der lokalen und öffentlichen Markdown-Fassungen sind geprüft. Seitenindizes liegen unter `.handbook-preview/v1.6-pages.json` und `.handbook-preview/school/v1.5-pages.json`.

Die Veröffentlichungsvorschau wurde anschliessend in der App korrigiert: begrenzte Dialogbreite, umbrechende Inhalte, getrennt scrollbarer Inhalt und dauerhaft sichtbare Aktionsbuttons. Ein Kartenbereich wird nur mit Track oder gültigen Ortskoordinaten angezeigt. Die Termin-Vorschau verwendet dasselbe Layout. Zehn lokale Browserfälle prüfen beide Vorschauen in DE/FR/EN, bei 320/390/1280 Pixeln Breite, geringer Höhe, langen Texten, Fotos, Karte und dunkler Darstellung. Die Aufnahme von `21-publish-preview` prüft zusätzlich horizontales Überlaufen und einen leeren Kartenbereich, bevor sie das Handbuchbild speichert.

Die korrigierte Piloten-Ausgabe liegt in `Benutzerhandbuch-Piloten-v1.6-korrigiert.docx`, weil die vorherige Word-Datei beim Erstellen nicht überschrieben werden konnte. Sie wird mit `python scripts/build-handbook.py --output docs/Benutzerhandbuch-Piloten-v1.6-korrigiert.docx` und `./scripts/render-handbook.ps1 -DocumentPath docs/Benutzerhandbuch-Piloten-v1.6-korrigiert.docx` erzeugt und paginiert. Ohne diese optionalen Pfadangaben verwenden die Werkzeuge weiterhin den regulären Versionsdateinamen.

## Automatische aktuelle Screenshots

Die Bildserien werden seit dem 29. September 2026 neu aus dem aktuellen lokalen App-Code erzeugt. Die Datumsangaben weiter unten dokumentieren die früheren Ausgaben; die fiktiven Beispieldaten behalten bewusst ihre festen September-Termine.

`npm run handbook:screenshots` prüft den App-Quellstand und nimmt bei Änderungen beide Bildserien vollständig neu auf. `npm run handbook:check` prüft nur und endet bei veralteten oder veränderten Bildern mit einem Fehler. `npm run handbook:screenshots -- --force` erzwingt eine vollständige Neuaufnahme.

Webseiten-Build und Word-Generator führen diese Prüfung mit automatischer Neuaufnahme aus. Auch die Startseitenbilder kommen direkt aus den aktuellen Handbuchaufnahmen. Voraussetzungen: Root-Abhängigkeiten (`npm ci`), Microsoft Edge und die lokale Vite-Konfiguration der App. Die Aufnahme startet einen eigenen lokalen Vite-Server auf einem freien Port und beendet ihn anschliessend. Externe Anfragen werden weiterhin durch fiktive Beispieldaten ersetzt oder blockiert.

`current-screenshots.json` enthält den SHA-256-Fingerabdruck von App, Aufnahme-Skripten und Handbuchquellen sowie Prüfsummen der verwendeten Bilder. Nur eine vollständige, fehlerfreie Aufnahme beider Handbücher erhält diesen Nachweis. Fehlende Bilder, Laufzeitfehler oder Änderungen während der Aufnahme verhindern den Build. Einzelaufnahmen löschen den Nachweis. Nachweis und Bilder gemeinsam versionieren. Neue Funktionen benötigen weiterhin passende Aufnahmeabläufe und Beispieldaten.

Beide aktuellen Word-Ausgaben mit `python scripts/build-handbook.py` und `python scripts/build-handbook.py --school` neu bauen, danach wie unten beschrieben in Word paginieren. Historische Word-Versionen bleiben erhalten. Eine veröffentlichte Website erhält neue Bilder erst mit einem erneuten Build und Deployment.

## Ausgaben vom 28. September 2026

- [Pilotenhandbuch als Markdown](../Benutzerhandbuch-Piloten.md) und [Word v1.5](../Benutzerhandbuch-Piloten-v1.5.docx): Android-IGC-Teilen, automatische Platzwahl, DHV-Katalog, persönliche Namen, Verknüpfen, Zusammenführen und burnair-Link; präzisierte Terminbilder.
- [Schulhandbuch als Markdown](../Betriebshandbuch-Flugschulen.md) und [Word v1.4](../Betriebshandbuch-Flugschulen-v1.4.docx): Fotoupload, inaktive Schüler für Starthelfer, offizielle Tagesplätze und Namens-/Gebietszählung im Ausbildungsnachweis.

Basis dieser historischen Ausgabe ist Commit `779a010` samt damaligem Arbeitsstand. Die bisherigen Word-Ausgaben bleiben erhalten. Damals verwendeten Generatoren und Vorschauwerkzeuge Piloten v1.5 und Schule v1.4. Die folgenden Angaben zu früheren Seitenzahlen sind historische Prüfergebnisse und gelten nicht automatisch für die aktuellen Ausgaben.

Historischer Hinweis zur damaligen Ausgabe: Die vorhandenen Screenshots vom 24./25. September wurden weiterverwendet. Neue Abläufe sind ausdrücklich als Textanleitungen ergänzt; es wurden für diese Aktualisierung keine neuen App-Screenshots aufgenommen. Wortlaut, Rechte und Abläufe wurden mit Frontend und Migrationen bis 0067 abgeglichen. Die Bilddateien sind keine Abnahme des neuen App-Stands.

Die neuen Ausgaben wurden in Word paginiert und ihre Inhaltsverzeichnisse aktualisiert: Piloten v1.5 umfasst 84 Seiten, 27 Kapitel und 58 Abbildungen; Schule v1.4 umfasst 69 Seiten, 31 Kapitel und 56 Abbildungen. Seitenindizes und Vorschauen liegen unter `.handbook-preview/v1.5-pages.json` beziehungsweise `.handbook-preview/school/v1.4-pages.json`. DOCX-Struktur und lokale Bildverweise wurden geprüft; neue Textseiten wurden in der Word-Vorschau kontrolliert.

## Frühere Ausgabe: Betriebshandbuch für Flugschulen – Version 1.2

Die Quelle ist `docs/Betriebshandbuch-Flugschulen.md`, die damalige Ausgabe `docs/Betriebshandbuch-Flugschulen-v1.2.docx`. Die bisherigen Ausgaben bleiben erhalten. Das Schulhandbuch verwendet dieselben Layoutregeln wie das Pilotenhandbuch: mobile Bilder links, nummerierte Arbeitsschritte rechts, gemeinsame Seitenbindung, Inhaltsverzeichnis und Kapitelgliederung.

Stand 25. September 2026: Kapitel 29 und 30 ergänzen Schulshop, Shop-Profil und Berechtigungen, Schulinserate, Inventar-Verknüpfung sowie Verkauf und Mitgliederabrechnung. Dafür wurden sieben neue Ansichten aufgenommen und Übersicht sowie Team-Funktionen aktualisiert.

Die Flugtag-Reiter, das Aktionsmenü und die direkte Statuswahl ersetzen die bisherigen Abläufe. Das Kommunikationskapitel beschreibt die neue Kanalübersicht, Empfängerkreise, Erwähnungen, Antworten, Bearbeiten, Reaktionen, Nachrichtensuche und Push-Einstellungen. Die aktuelle Ausgabe enthält 58 Bilder aus der echten Oberfläche.

Kurze abschliessende Hinweise eines Schulkapitels werden direkt unter den Arbeitsschritten in der rechten Spalte gesetzt. So bleiben sie bei der zugehörigen Anleitung und erzeugen keine fast leeren Folgeseiten. Die Markdown-Quelle bewahrt die durchgehende Lesereihenfolge.

Die in Word geprüfte Ausgabe umfasst 65 Seiten, 30 Kapitel und 58 aktuelle Bildschirmansichten. Behandelt werden Schul- und Starthelferansicht, Rollen, Einladungen, Team und Verfügbarkeit, Schülerstatus und Dossiers, Termine, Statuswahl, Anwesenheit, Coaching, Inventar und Ausleihe, Ansätze, Wartung, Zertifikate, Ausrüstungscheck, Vorfälle, Abrechnung, Guthaben, Kommunikationskanäle, Direktnachrichten, Nachrichtenaktionen, Benachrichtigungen, Umfragen, Statistiken und Jahresbericht. Beschrieben ist die Flyary-Bedienung, kein regulatorisches Betriebshandbuch der einzelnen Flugschule.

```powershell
# Lokaler Vite-Server wie unten beschrieben auf Port 4175
node scripts/capture-school-handbook.mjs
# Einzelne Bilder aktualisieren (auch mehrere mit Komma):
node scripts/capture-school-handbook.mjs --screen=25-billing-form,34-coaching
python scripts/build-handbook.py --school
./scripts/render-handbook.ps1 -School
python scripts/preview-school-handbook.py
python scripts/preview-school-handbook.py --pages
```

Die Schulaufnahmen verwenden fiktive Schul-, Personen-, Termin- und Buchungsdaten mit abgefangenen externen Anfragen. Auch die eingeschränkte Starthelferansicht wird mit der echten App dargestellt. Unter `school-mobile/` liegen Screenshots, sichtbare Seitentexte zur Nachprüfung und ein Manifest. Die Aufnahme liest den Auth-Speicherschlüssel aus der lokalen Vite-Konfiguration, fixiert die Beispielzeit auf den 24. September 2026 und blockiert auch externe WebSockets. Die Vorschau verwendet nur Bilder des aktuellen Manifests; ältere, nicht mehr verwendete Aufnahmen bleiben unberücksichtigt. Bei gezielter Neuaufnahme enthält dessen Fehlerliste die Ergebnisse dieses Aufnahmeprozesses; die Bildliste bleibt erhalten. Unter `.handbook-preview/school/` werden Word-Seitenbilder und Kontaktbögen erzeugt. EMF-Seiten werden für die Vorschau ausdrücklich im A4-Seitenverhältnis gerendert.

## Benutzerhandbuch für Piloten

Die redaktionelle Quelle ist `docs/Benutzerhandbuch-Piloten.md`. Die aktuelle Ausgabe ist oben verlinkt; v1.3 und alle anderen bisherigen Ausgaben einschliesslich der Datei ohne Versionsnummer bleiben als historische Stände erhalten.

## Frühere Piloten-Ausgabe 1.3

Stand 25. September 2026: 79 in Word geprüfte Seiten, 26 Kapitel und 58 mobile Bildschirmansichten. Kapitel 26 beschreibt den Marktplatz: Suche und Filter, Anbieter und Kontakt, Favoriten und gespeicherte Suchen, Inserate erstellen und verwalten, Verkauf, Bewertungen und Meldungen. Dafür wurden 14 neue Ansichten aufgenommen und das Mehr-Menü aktualisiert.

### Änderungen der Vorversion 1.2

Stand 24. September 2026: 65 in Word geprüfte Seiten, 25 Kapitel und 44 neu aufgenommene mobile Bildschirmansichten. Aktualisiert sind die Termin-Reiter, Anmeldung und Terminchat, die Trennung von Feed-Aktivitäten und Chat-Eingang, fehlende Gruppenzuordnung beim Veröffentlichen, das Ausblenden von Home-Terminen, Video-Wischgesten und die manuelle App-Aktualisierung. Das neue Kapitel 25 erklärt Kanäle, Direktnachrichten, Antworten, Bearbeiten, Reaktionen, Erwähnungen, Suche und Benachrichtigungseinstellungen.

Die Screenshots werden direkt an ihrer Position im Ablauf mit nummerierten Schritten gesetzt. Ein Block beginnt in der Markdown-Quelle mit `::: schritte Titel`, enthält eine Bildreferenz, optional eine Bildnotiz mit `>`, nummerierte Schritte und endet mit `:::`. Der Word-Generator setzt Bild und Anleitung nebeneinander und hält die Tabellenzeile auf derselben Seite. Keine Bildsammlung am Kapitelende.

## Mobile Bildschirmansichten

`scripts/capture-handbook.mjs` öffnet die echte lokale Flyary-Oberfläche in Microsoft Edge mit Playwright. Alle externen Anfragen werden abgefangen: Supabase-Antworten kommen aus fiktiven Beispieldaten, andere externe Anfragen und WebSockets werden blockiert. Der Auth-Speicherschlüssel wird aus der lokalen Vite-Konfiguration ermittelt; die Beispielzeit ist auf den 24. September 2026 fixiert. Es werden keine produktiven Konten oder Daten verändert.

Die Ansichten verwenden 390 × 844 CSS-Pixel bei zweifacher Pixeldichte (780 × 1688 Bildpixel). Sie zeigen jeweils einen mobilen Bildschirmausschnitt. `mobile/manifest.json` dokumentiert Aufnahmen, Routen und Laufzeitfehler; neben den Bildern liegen die sichtbaren Seitentexte zur Prüfung.

```powershell
npm run dev -- --host 127.0.0.1 --port 4175
# In einem zweiten Terminal:
node scripts/capture-handbook.mjs
# Nur die zusätzlichen Ansichten ab Nr. 19 neu aufnehmen:
node scripts/capture-handbook.mjs --additional
# Nur die Formulare und Vorschau ab Nr. 30:
node scripts/capture-handbook.mjs --forms
# Einzelne Ansichten aktualisieren, auch mehrere mit Komma:
node scripts/capture-handbook.mjs --screen=08-event-detail,41-event-chat
```

Für neue Funktionen müssen Beispieldaten, Bildausschnitte und erklärender Text gemeinsam angepasst werden. Die Bilder sind keine vollständigen Funktionstests.

## Word und Layoutprüfung

```powershell
python -m pip install --target .handbook-tools python-docx Pillow PyMuPDF
python scripts/build-handbook.py
./scripts/render-handbook.ps1
python scripts/preview-handbook.py
python scripts/preview-handbook.py --pages
```

Der letzte Schritt benötigt Microsoft Word unter Windows. Er aktualisiert das Inhaltsverzeichnis und die Seitenzahlen, speichert die DOCX-Datei und erzeugt Seitenvorschauen als EMF unter `.handbook-preview/`. Word läuft dabei unsichtbar. Die Vorschauen lassen sich unter Windows mit Pillow öffnen. `preview-handbook.py` erzeugt Kontaktbögen und A4-Seitenbilder unter `.handbook-preview/pilot-review/` und verwendet nur die im aktuellen Manifest beziehungsweise Seitenindex aufgeführten Dateien.

Optional erzeugt `./scripts/render-handbook.ps1 -ExportPdf` zusätzlich eine PDF-Datei. Auf dem Rechner der Erstellung blockierte der direkte Word-PDF-Export auch bei einem leeren Testdokument. Die Layoutprüfung erfolgte deshalb anhand der direkt aus Word ausgelesenen Seitenbilder; ausgeliefert wird das DOCX.

Vor einer Veröffentlichung die fertigen Seiten prüfen: Inhaltsverzeichnis, Umbrüche, vollständige Tabellen, lesbare Abbildungen und Übereinstimmung der Bildunterschriften mit dem sichtbaren Inhalt.

## Marktplatz-Aufnahmen

`scripts/handbook-market-fixtures.mjs` stellt gemeinsame fiktive Marktplatzdaten und Aufnahmeabläufe für beide Handbücher bereit. Die Marktplatz-Beispielzeit ist der 25. September 2026. Die Beispielangebote enthalten bewusst keine Produktfotos; die Handbücher erklären, dass beim Veröffentlichen mindestens ein echtes Foto erforderlich ist. Die Aufnahme löst keine Veröffentlichung, Verkäufe oder Buchungen aus.
