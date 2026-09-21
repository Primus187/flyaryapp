# Flyary

## Flugschule: Zertifikate und Unterrichtstage (Planung 4.2)

Unter **Sicherheit → Zertifikate** zählt die Übersicht unterschiedliche lokale
Kalendertage mit bestätigten, bereits begonnenen Terminen und Einteilung als
Fluglehrer. Der Zeitraum beginnt mit dem erfassten Ausstellungs-/Rezertifizierungsdatum,
frühestens vor drei Jahren. Mehrere Termine am selben Tag zählen einmal. Ohne
Ausstellungsdatum bleibt die Zahl unbekannt. Der Zielwert von 15 Tagen innerhalb
von drei Jahren stammt aus der Planung; die Einteilung dient als Datengrundlage,
nicht als separater Anwesenheitsnachweis.

Ablaufwarnungen berücksichtigen alle erfassten Zertifikatsarten und die nächsten
90 Kalendertage. Ein Zertifikat gilt am Ablaufdatum noch nicht als abgelaufen.
Ladefehler werden sichtbar angezeigt. Beim Speichern werden nur geänderte Einträge
geschrieben; Fehler lassen den Dialog mit den Eingaben offen. Änderungen werden pro
Zertifikat gespeichert: Bereits erfolgreiche Änderungen bleiben bei einem späteren
Fehler erhalten und werden beim Wiederholen übersprungen. Offline gibt es keine
lokale Speicherwarteschlange. Die bestehenden Datenbankrechte bleiben unverändert.

## Flugschule: Materialquote (Planung 4.3)

Grundkurs-Termine zeigen dem Schulteam eine Warnung bei weniger als zwei verfügbaren,
typengeprüften Schulschirmen pro drei Schüler (aufgerundet). Gezählt werden angemeldete
Schüler ohne Wartelistenplatz, die in dieser Schule weniger als drei unterschiedliche
Grundkurstage mit erfasster Anwesenheit vor dem Termin haben. Fehlende historische
Anwesenheiten führen vorsichtshalber dazu, dass Schüler weiter mitgezählt werden.

Als Inventareinheit dient `school_equipment.equipment_type = glider`; Zubehör zählt
nicht als zusätzliches Schirmsystem. Schirme im Service oder ausser Betrieb werden
nicht berücksichtigt. Offene Ausgaben an andere Personen werden abgezogen, Ausgaben
an die gezählten Teilnehmer werden einmal mitgezählt. Ein geplantes Rückgabedatum
allein gilt nicht als erfolgte Rückgabe; am Rückgabetag zählt das Gerät konservativ
noch als ausgegeben. Es handelt sich um eine Bestandsprüfung, keine Reservierung
oder Prüfung kompletter Ausrüstungssets.

Die Berechnung aktualisiert sich nach Änderungen der Anmeldeliste. Fehlgeschlagene
oder abgeschnittene Abfragen werden als unbekannter Status mit Wiederholen-Button
angezeigt. Eigenes Material kann die Schule weiterhin berücksichtigen; der Hinweis
blockiert keine Anmeldung. Datenbankstruktur und Zugriffsrechte bleiben unverändert.

## Flugschule: Ausrüstungscheck (Planung 5.1)

In der Schülerübersicht öffnet **Ausrüstung** die persönliche Checkliste für Helm,
Schuhwerk, Gurtzeug mit Protektor und Rettungsgerät. Änderungen werden erst nach
Bestätigung durch die Datenbank angezeigt; bei Fehlern bleibt der vorherige Stand
erhalten. Offline werden Änderungen nicht zwischengespeichert und nicht als erledigt
angezeigt. Fehlgeschlagene Abfragen lassen sich erneut laden.

Schüler sehen bei Höhenflug-Terminen ihrer Schule vor der Anmeldung einen Hinweis
auf fehlende Bestätigungen mit den betroffenen Gegenständen. Die Anmeldung bleibt
möglich, damit Leihmaterial berücksichtigt werden kann. Die vorhandene
`equipment_checks`-Tabelle und deren RLS-Regeln bleiben unverändert (Schüler lesen
ihre eigenen Checks, das Schulteam bearbeitet sie).

## Flugschule: Wartungsfristen (Planung 9.1)

Unter **Material → Wartung** lassen sich mehrere Prüf- und Wartungsfristen pro Gerät
erfassen und erledigen. Filter zeigen überfällige Fristen oder die nächsten 30 Tage.
Am Fälligkeitstag gilt eine Prüfung noch nicht als überfällig. Im Lager und bei der
Ausgabe erscheint eine Warnung für offene überfällige Wartungen sowie für das bisherige
Feld „Nächster Check“. Die Warnung verhindert die Ausgabe nicht.

Speicherfehler beim Erledigen bleiben sichtbar; der Eintrag wird erst nach bestätigter
Speicherung als erledigt angezeigt. Ohne Verbindung wird kein lokaler Wartungsabschluss
vorgemerkt. Ladefehler werden als unbekannter Wartungsstatus angezeigt.
Voraussetzung ist die bestehende Phase-1-Tabelle `equipment_maintenance` mit ihren
RLS-Regeln. Diese Ergänzung ändert keine Datenbankrechte.

## Flugschule: Jahresbericht – Ausbildungsstand pro Jahr (Planung 4.4)

`profiles.training_level` ist ein Live-Wert ohne Zeitbezug; für vergangene Berichtsjahre
liess sich daraus weder die Kursart-Verteilung noch „abgeschlossene Brevetierungen im
Berichtsjahr" korrekt rekonstruieren – der Jahresfilter wirkte sich nur auf die
Betriebstage/Monat aus, alle anderen Zahlen zeigten immer den heutigen Stand. Neue Tabelle
`training_level_history` protokolliert ab sofort jede Änderung mit Zeitstempel (ergänzt in
`set_member_training_level`). Für das aktuelle Jahr wird ohne Historieneintrag weiterhin auf
den Live-Wert zurückgegriffen; für vergangene Jahre ohne Historieneintrag gilt der
Ausbildungsstand als unbekannt statt geraten – sichtbar als eigene Zeile „Ausbildungsstand
unbekannt" mit Hinweistext. Änderungen vor Einführung dieser Erfassung bleiben unbekannt.

„Brevetiert {{Jahr}}" zählt neu Personen mit einem Wechsel zu `training_level = licensed`
innerhalb des gewählten Jahres (Zufluss), nicht mehr den aktuellen Bestand an Brevetierten.
Zusätzlich behebt dies einen Vokabular-Mismatch: `profiles.training_level` enthält sowohl
das ältere Schema (`grundkurs`/`brevetkurs`/`siku`, siehe Migration
`20260917075246_...sql`) als auch das neuere aus [SchoolPeople.tsx](src/components/school/SchoolPeople.tsx)
(`ground`/`altitude`/`exam_ready`/`licensed`) – die Kursart-Aufschlüsselung zeigt jetzt beide
Wertebereiche mit Übersetzung statt nur die neueren Werte zu zählen und den Rest stillschweigend
als „unbekannt" zu verbuchen. Diese beiden Vokabulare selbst sind nicht vereinheitlicht;
das bleibt eine offene, separate Aufräumarbeit im Bestandscode.

Ich möchte eine PWA mobile App, welche als Tagebuch für meine Gleitschirmflüge dient. Damit sollen Flugdaten (.ics) eingelesen werden. Orte (Startplätze und Landeplätze) erfasst werden können. Diese auf einer Karte anzeigen. Zu den einzelnen Flügen, sollen alle wichtigen Daten erfasst werden können und auch Fotos angehängt und YouTube Videos verlinkt werden.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://flyaryapp.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/8c75fe1e-bceb-41c1-8ee8-2d4a58373f69).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
