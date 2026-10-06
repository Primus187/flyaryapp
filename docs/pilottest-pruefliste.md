# Prüfliste vor dem Test mit echten Schülern

Stand 6. Oktober 2026. Ein Durchgang auf dem Handy, bevor echte Schüler und die Flugschule die App
benutzen. Er dauert etwa 45 Minuten und braucht drei Konten: ein Schüler, ein Fluglehrer und ein
Starthelfer derselben Schule. Ideal sind zwei Handys nebeneinander.

Die Liste prüft vor allem, was am 6. Oktober geändert wurde: neues Design, Ausbildungsstand nach
SHV, Start-Ansage, Abschluss des Flugtags und Videos im Feed. Jeder Punkt nennt, was du tust und
was du sehen solltest. Weicht etwas ab, melde es direkt in der App über **Mehr → Feedback** mit
einem Screenshot.

## Vorbereitung

- [ ] Demodaten sind entfernt (`node scripts/seed-vertical-testdata.mjs --remove`) und ein Backup
      ist gelaufen (`npm run backup`).
- [ ] Auf jedem Handy die App einmal ganz schliessen und neu öffnen. Nach mehreren Auslieferungen
      am selben Tag kann sonst eine alte Version hängen bleiben.
- [ ] Ton einschalten, Handy nicht stumm, Lautstärke hoch.
- [ ] Einmal im hellen und einmal im dunklen Design durchgehen (**Mehr → Einstellungen → Design**).

## Als Schüler

### Start

- [ ] «Nächste Termine» zeigt die kommenden Termine der Schule. Hinweis: Ein nach links
      weggewischter Termin bleibt ausgeblendet und lässt sich nur über «Rückgängig» direkt danach
      zurückholen.
- [ ] Die Karte mit deinem Stand (zum Beispiel «Schüler · Höhenflüge») zeigt «Ziel: Pilot», den
      Anteil erfüllter Anforderungen und die nächste offene Anforderung. Antippen öffnet das
      Training.
- [ ] Die Saisonkarte zeigt Flüge, Flugzeit, Strecke und Höhenmeter; «Alle Statistiken» öffnet die
      Statistik.

### Profil und Einstellungen

- [ ] **Profil → Ausbildung und Brevets** zeigt deinen Stand. Als Schüler einer Flugschule kannst
      du die Stufe nicht selbst ändern.
- [ ] «Ich habe das Pilotenbrevet» öffnet ein Formular; Datum und Nummer sind freiwillig. Nach dem
      Speichern steht «Pilot» da. **Nur mit einem Testkonto ausprobieren:** Zurücksetzen kann das
      nur die Schule.
- [ ] Unter «Kurse und Nachweise» lässt sich ein Sicherheitstraining mit Datum erfassen und wieder
      löschen.
- [ ] SHV-Nummer ändern und das Profil speichern: Der Wert bleibt nach dem Neuladen erhalten.
- [ ] **Einstellungen → Ausbildungsstand** zeigt dieselbe Angabe und führt mit «Im Profil ändern»
      ins Profil.

### Training

- [ ] Das Kontrollblatt ist nach Stufen gegliedert (Grundausbildung, Höhenflüge, Prüfungsreif,
      Pilot). Deine Stufe ist offen und mit «Deine Stufe» markiert, die anderen sind eingeklappt.
- [ ] Sterne setzen und die Seite neu laden: Die Sterne bleiben, auch in eingeklappten Stufen.
- [ ] Die Karte «Ausbildungsstand» oben zeigt die Anforderungen für das Pilotenbrevet.

### Flug erfassen

- [ ] Das Feld «SHV Soloflug» ist vorhanden.
- [ ] Unter «Erweiterte Daten» fehlt «Tandem», solange du weder Doppelsitzer-Brevet noch
      Doppelsitzer-Ziel noch einen Tandemschirm hast.
- [ ] Flug speichern: Er erscheint unter «Flüge». Die Detailseite zeigt die Karte. Gleich wieder
      zurückgehen, während die Karte noch lädt: Es darf kein Fehler erscheinen.

### Feed

- [ ] Ein YouTube-Video antippen: Es öffnet über den ganzen Bildschirm, auf Android in der Regel
      im Querformat. Das Kreuz oben links oder die Zurück-Geste schliesst es.
- [ ] Gefällt mir und Kommentar funktionieren.

### Nach dem Flugtag

- [ ] Nach dem Tagesabschluss kommt eine Mitteilung, und im Termin zeigt der Reiter «Feedback» die
      Rückmeldungen.
- [ ] Auf Start bietet eine Karte an, die Schulflüge ins Flugbuch zu übernehmen («Ins Flugbuch
      übernehmen»).

## Als Pilot (Konto ohne Schule oder brevetiert)

- [ ] Ein neues Konto ohne Schule sieht auf Start die Frage «Bist du Schüler oder Pilot?». Nach der
      Antwort verschwindet sie.
- [ ] **Profil → Ausbildung und Brevets:** über das Plus bei «Brevets» ein Brevet mit Datum
      erfassen; unter «Ich arbeite hin auf» ein Ziel wählen, zum Beispiel «Doppelsitzer Stufe 1».
- [ ] Danach zeigt Start «Ziel: Doppelsitzer Stufe 1», und die Statuskarte im Training öffnet auf
      diesem Ziel. Ohne Ziel fehlt die Karte auf Start.
- [ ] Im Training zeigt die Statuskarte beim Pilotenbrevet «Erlangt am …» statt einer Liste; offen
      ist der Abschnitt «Pilot» mit dem Sicherheitstraining.
- [ ] Flug erfassen: «SHV Soloflug» fehlt. Mit Doppelsitzer-Ziel erscheint «Tandem» unter
      «Erweiterte Daten».

## Als Fluglehrer am Landeplatz

Termin der Schule öffnen, Reiter «Flugtag». Am Tag des Termins öffnet er von selbst.

- [ ] Einchecken: Anwesende antippen, die Zählung «x von y da» stimmt.
- [ ] Start- und Landeplatz über «Ändern» setzen.
- [ ] Der Lautsprecher-Knopf neben «Flüge» ist eingeschaltet. Aus- und wieder einschalten: Beim
      Einschalten ertönt das Signal.
- [ ] Der Starthelfer tippt auf seinem Handy «Start»: Bei dir ertönen zwei Töne und die Ansage
      «Vorname gestartet». Der Schüler erscheint im Band «In der Luft».
- [ ] «Gelandet» öffnet das Blatt für Rückmeldung und Bewertung; nach dem Speichern steht der Flug
      beim Schüler.
- [ ] Eine «Tageszusammenfassung» für einen Schüler schreiben.
- [ ] «Tag abschliessen» führt durch den Abschluss. Danach steht oben «Abgeschlossen am …», und
      nichts lässt sich mehr ändern. «Wieder öffnen» macht den Tag wieder bearbeitbar.
- [ ] Bei einem Termin in der Zukunft fehlt «Tag abschliessen», bis der erste Flug erfasst ist.

## Als Starthelfer am Startplatz

- [ ] Du siehst im Termin den Reiter «Flugtag» mit der Liste «Starts», aber keine Rückmeldungen,
      keine Planung und kein Schülerdossier.
- [ ] «Start» bei einem Schüler: Auf deinem Handy ertönen Signal und Ansage als Bestätigung, beim
      Fluglehrer ebenfalls.
- [ ] «Abbruch» fragt nach dem Grund; der abgebrochene Start zählt nicht als Flug.
- [ ] Bei einem pausierten Schüler fragt die App nach, bevor sie den Start erfasst.
- [ ] Handy sperren und einen Start vom anderen Gerät auslösen: Es kommt **keine** Ansage. Das ist
      eine bekannte Grenze, die App muss offen und im Vordergrund sein.

## Als Schulleitung

- [ ] **Team:** Die Stufen heissen Grundausbildung, Höhenflüge, Prüfungsreif und Brevetiert. Eine
      Stufe ändern und speichern: Sie steht danach auch im Profil des Schülers.
- [ ] Hat ein Schüler das Pilotenbrevet selbst angegeben, steht bei ihm «Brevetiert · selbst
      angegeben».
- [ ] **Schülerdossier:** Der dunkle Kopf zeigt Stufe, Flugzahl und, falls vorhanden,
      Doppelsitzer-Brevets und Ziel. Der Reiter «Nachweis» öffnet die Statuskarte auf dem Ziel des
      Schülers. Im Reiter «Ausbildung» filtert die Stufenauswahl das Kontrollblatt.
- [ ] Einen Kanal nur für eine Stufe anlegen: Schüler dieser Stufe sehen ihn, andere nicht.
- [ ] Die Übersicht zeigt die SHV-Ampel. Nach dem Entfernen der Demodaten zählt sie nur echte
      Brevetierungen.

## Als Betreiber

- [ ] **Mehr → Betrieb:** Das Fehlerprotokoll zeigt nach dem Durchgang keine neuen Einträge. Der
      Kartenfehler «_leaflet_pos» sollte nicht mehr auftauchen.
- [ ] Ein Test-Feedback mit Screenshot kommt unter «Feedback» an.
- [ ] Die Backup-Anzeige nennt das Backup von heute.

## Bekannte Grenzen

- Die Start-Ansage braucht die geöffnete App im Vordergrund und ein erstes Antippen der Seite.
  Die Stimme klingt je nach Gerät anders.
- Auf dem iPhone übernimmt der YouTube-Player das Vollbild selbst; bis er startet, füllt ein
  schwarzes Fenster den Bildschirm.
- Die Benutzerhandbücher zeigen noch das alte Design und den alten Ausbildungsstand.
