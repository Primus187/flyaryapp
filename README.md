# Flyary

## Flugtag-Cockpit: Ablösung des Ausbildungsblatts, Freigabe für Schüler (4.5)

Migration `0054_flight_day_feedback_release.sql`, Oberfläche `src/components/flightday/DaySummaryEditor.tsx`,
`LegacyCoachNotes.tsx`, `src/components/StudentDayFeedback.tsx`; entfernt: `CoachDayView.tsx`,
`EventStudentFlights.tsx`. Tests in `FlightBoard.test.tsx`, `StudentDayFeedback.test.tsx` und
`src/test/school-flights-database.test.ts`.

- **Tageszusammenfassung in der Flugliste:** Die aufgeklappte Schülerzeile enthält die Zusammenfassung mit
  «Als nächsten Lernschritt markieren» (`student_day_notes`, `flight_number IS NULL`, automatisch gespeichert mit
  Status und «Wiederholen»). Der letzte Lernschritt früherer Tage steht darüber nur zum Lesen; kein automatisches
  Vorausfüllen mehr, «Letzten Lernschritt als Vorlage übernehmen» kopiert ihn bewusst. Kein Augen-Symbol mehr.
- **Ausbildungsblatt F1–F6 und «Schülerflüge» entfallen.** Alte F1–F6-Notizen erscheinen eingeklappt als
  «Ausbildungsblatt (bisher)», nur zum Lesen (E5). Flüge, die Schüler selbst im Flugbuch mit diesem Termin erfasst
  haben, werden als Zahl angezeigt (Grundlage für 6.1).
- **Freigabe für Schüler (E8)** in der Datenbank: `flight_day_feedback_released(event)` ist wahr, sobald der Tag
  freigegeben ist (`feedback_released_at`, ab 5.1) oder spätestens am Folgetag um 06:00 Schweizer Zeit (bei
  mehrtägigen Terminen nach dem letzten Tag). Gilt für `my_school_flights` und neu auch für die Policy «Students can
  view own visible notes». Frühere Termine sind damit automatisch freigegeben; es braucht keinen geplanten Job.
- **Schüleransicht «Feedback»:** zeigt jetzt die Schulflüge mit Zeiten, Plätzen, bewerteten Manövern und
  Rückmeldung, dazu frühere F-Notizen und die Zusammenfassung. Vor der Freigabe steht ein Hinweis, wann sie kommt.

**Abweichungen vom Plan:** (1) Die Freigabe-Regel mit dem 06:00-Rückfall ist schon hier umgesetzt (geplant für 5.2),
weil die Zusammenfassung sonst sofort für Schüler sichtbar gewesen wäre. (2) Die Anzeige der Schulflüge für Schüler
ist aus 5.2 vorgezogen; die Push-Mitteilung folgt mit 5.2. (3) Der letzte Lernschritt stammt aus dem letzten früheren
Termin mit einem markierten Lernschritt; Notizen gibt es nur an Tagen, an denen der Schüler betreut wurde. (4) Das
Betriebshandbuch (Kapitel 14, 15, 27) ist noch nicht nachgeführt.

## Flugtag-Cockpit: Startplatz, «In der Luft» und Landehinweis (4.4)

Migration `0053_flight_day_landing_hint.sql`, Oberfläche `src/components/flightday/TakeoffBoard.tsx`,
`InAirBar.tsx`, `FlightDayStations.tsx`, Hook `src/hooks/use-flight-day-live.ts`, Tests in
`TakeoffBoard.test.tsx`, `FlightBoard.test.tsx`, `src/lib/school-flights.test.ts` und
`src/test/school-flights-database.test.ts`.

- **Startplatz-Ansicht** für Starthelfer: pro Schüler **Start** bzw. **Abbruch** (mit Grund, nur Team), im Menü die
  Startnotiz zum letzten Flug. Keine Rückmeldungen, keine internen Notizen, kein Dossier. Pausierte Schüler lassen
  sich nach einer Rückfrage trotzdem starten (kein hartes Blockieren). Oben der Startplatz des Tages.
- **Fluglehrer** schalten zwischen **Landeplatz** und **Startplatz** um (pro Gerät gemerkt). Auf der Landeplatz-
  Ansicht gibt es neben «+ Flug» ein **Start**, wenn der Starthelfer einen Start nur per Funk meldet (Ergänzung im
  Plan vom 2026-09-25).
- **Leiste «In der Luft»** in beiden Ansichten: wer gerade fliegt, mit laufender Zeit, am längsten Fliegende zuerst.
  Auf dem Landeplatz öffnet ein Tipp direkt die Landung.
- **Landehinweis pro Flugtag** (`flight_events.landing_hint_minutes`, RPC `set_flight_day_landing_hint`, nur
  Fluglehrer): aus (Standard) oder nach 15/30/45/60/90 min. Dann wird der Eintrag orange mit «Landung erfassen?» –
  nur ein Hinweis, keine Alarmierung. Einstellbar in der Karte «Plätze des Tages».
- **Live-Abgleich** über einen gemeinsamen Hook (`useFlightDayLive`): Änderungen an Flügen und Pausen kommen über
  Realtime; nach dem Zurückkehren in die App wird neu geladen; die Zeiten ticken alle 30 s.

## Flugtag-Cockpit: Flüge am Landeplatz erfassen (4.3)

Migration `0052_school_flight_items.sql`, Oberfläche `src/components/flightday/FlightBoard.tsx`,
`RecordFlightSheet.tsx` und `DaySitesCard.tsx`, Logik in `src/lib/school-flights.ts`, Tests in
`src/test/school-flights-database.test.ts`, `src/lib/school-flights.test.ts` und
`src/components/flightday/FlightBoard.test.tsx`.

- **Flugliste im Reiter «Flugtag»** (Fluglehrer): eine Zeile pro anwesendem oder noch offenem Schüler mit Anzahl
  Flüge, einem Punkt pro Flug (gefüllt = Rückmeldung vorhanden), «in der Luft · n min» und Pausengrund. Eine grosse
  Hauptaktion pro Zeile: **Gelandet**, wenn der Schüler in der Luft ist, sonst **+ Flug**; beim Grundkurs **+1**
  (Flug sofort erfasst, 5 s «Rückgängig»). Ohne Text ist ein Flug so in drei Tipps erfasst.
- **Bottom-Sheet:** die geplanten Manöver des Termins mit «Nochmals / Geht / Sitzt» (nochmals tippen hebt auf),
  Textbausteine, «Rückmeldung an Schüler» und eingeklappt «Intern (nur Team)». Landung, Rückmeldung und
  Bewertungen werden in einem Aufruf gespeichert; ungespeicherte Änderungen fragen vor dem Schliessen nach.
- **Aufgeklappte Zeile:** die Flüge des Tages mit Nummer, Zeiten, Dauer und Rückmeldung (antippen = bearbeiten
  oder löschen), Startabbrüche mit Startnotiz, darunter der letzte nächste Lernschritt früherer Tage zum Lesen.
- **Plätze des Tages:** Karte zum Setzen von Standard-Start- und Landeplatz aus den eigenen Orten
  (`LocationCombobox`, auch neue Orte).
- Die Check-in-Kacheln klappen ein, sobald niemand mehr offen ist («Check-in anzeigen» öffnet sie wieder).
- **Datenbank:** `event_school_flight_items` (Bewertung 1–3 pro Flug und Manöver, nur für Fluglehrer lesbar);
  `school_flight_land` und `school_flight_add` nehmen die Bewertungen mit, `school_flight_set_items` ersetzt sie,
  `my_school_flights` liefert sie dem Schüler nach der Freigabe mit.
- **Orte des Flugtags lesbar:** Orte gehören einer Person. Neue Policy «Sites of flying days are readable»: Wer am
  Flugtag eine Rolle hat, liest die Namen der Standardplätze und der Plätze der Schulflüge dieses Tages (sonst sähen
  zweiter Fluglehrer und Starthelfer nur «?»).

**Abweichungen vom Plan:** (1) Der Landeplatz wird nicht im Sheet pro Flug gewählt, sondern einmal als Platz des
Tages; das spart am Landeplatz einen Schritt. Korrekturen pro Flug sind über `school_flight_update` möglich (UI
folgt bei Bedarf). (2) Das bisherige Ausbildungsblatt F1–F6 und die Schülerflüge bleiben bis 4.5 unter der
Flugliste. (3) Die Bewertungen fliessen noch nicht in den Ausbildungsstand des Schülers (6.3).

## Flugtag-Cockpit: Check-in und Tagesstatus (4.2)

Migration `0051_flight_day_presence.sql`, Logik in `src/lib/flight-day.ts`, Oberfläche
`src/components/flightday/DayCheckIn.tsx`, Tests in `src/test/flight-day-presence-database.test.ts`,
`src/lib/flight-day.test.ts` und `src/components/flightday/DayCheckIn.test.tsx`.

- **Neuer Reiter «Flugtag»** im Termin für das Team des Tages (Rolle aus `flight_day_role`, also auch Starthelfer
  und nur im Termin eingeteilte Personen). Er ersetzt «Coaching» und öffnet sich am Tag des Termins von selbst;
  `?tab=coaching` und `#coaching` aus dem Dossier führen dorthin.
- **Check-in als Kacheln:** Antippen setzt «da», nochmals antippen macht es rückgängig; über das Menü «Fehlt»,
  «Zurücksetzen» und «Heute pausieren». Oben der Zähler (da / fehlt / offen / pausiert) und «Alle anwesend» für die
  angezeigten, noch offenen Personen. Änderungen vom anderen Handy (Start- und Landeplatz) kommen über Realtime;
  nach dem Zurückkehren in die App wird neu geladen.
- **Anwesenheit** heisst jetzt `event_signups.presence` (`expected`/`present`/`absent`) mit `checked_in_at`.
  `attended` bleibt als generierte Spalte (`presence = 'present'`) für bestehende Leser. Der erste erfasste
  Schulflug checkt den Schüler automatisch ein (Trigger auf `event_school_flights`).
- **Pausieren** mit Grund (Material, Müdigkeit, Verletzung, Wetter, Anderes) und optionaler Notiz in
  `event_day_pauses`, nur für das Team lesbar. Die bisherigen Pausen-Notizen (`student_day_notes.flight_number = -1`)
  sind dorthin übernommen; das Ausbildungsblatt pausiert nicht mehr selbst.
- **Schreiben nur über RPCs:** `set_signup_presence`, `set_signups_present`, `set_day_pause` (Team inkl.
  Starthelfer) und `set_signup_confirmed` (Fluglehrer, für «Bestätigen» in der Teilnehmerliste).
- Die Teilnehmerliste zeigt dem Team «Da» bzw. «Fehlt» als Badge. Die Tagesbuchung (Guthaben & Posten) steht bis
  zum Tagesabschluss (5.1) unten im Reiter «Flugtag», ohne eigene Häkchenliste.
- Der Smoke-Rundgang (`npm run smoke`) öffnet zusätzlich einen Schul-Flugtag von heute (24 Seiten).

**Fund beim Umsetzen:** Auf `event_signups` gab es nur die Policy «Users can update own signup». Die Häkchen der
Anwesenheit und «Bestätigen» des Schulteams bei anderen Personen wurden darum still ignoriert (0 Zeilen, kein Fehler),
während ein Schüler bei sich selbst `attended` und `confirmed_by_school` setzen konnte. Beides läuft jetzt über die
RPCs; ein Trigger (`protect_signup_school_fields`) lässt Anwesenheit, Check-in-Zeit und Schulbestätigung
unverändert, wenn jemand ausserhalb des Tagesteams eine Anmeldung bearbeitet. An- und Abmelden funktioniert wie
bisher.

**Abweichungen vom Plan:** (1) Der Pausengrund liegt in einer eigenen Tabelle statt in `event_signups.paused_reason`,
weil alle Gruppenmitglieder die Anmeldungen lesen können und ein Grund wie «Verletzung» nur das Team etwas angeht.
(2) Nicht angehakte Anmeldungen vergangener Tage bleiben `expected` («nicht erfasst») statt `absent`, weil die
meisten früheren Tage nie abgehakt wurden. (3) Auch Starthelfer dürfen pausieren. (4) Ausbildungsblatt F1–F6,
Schülerflüge und Tagesbuchung erscheinen weiterhin nur für Admin, Fluglehrer und Schulleitung, weil ihre Tabellen
über `is_group_staff` lesen; sie werden in 4.3–5.1 abgelöst.

## Flugtag-Cockpit: Schulflüge erfassen – Datenmodell und Rechte (4.1)

Migration `0050_event_school_flights.sql`, Logik in `src/lib/school-flights.ts`, Datenbanktests in
`src/test/school-flights-database.test.ts`. Noch ohne Oberfläche (folgt mit 4.2–4.4).

- **Schulnachweis statt privates Flugbuch:** `event_school_flights` hält pro Flug Termin, Schüler, laufende Nummer
  `seq`, Status (`in_air`/`landed`/`aborted`), Start- und Landezeit, Start- und Landeplatz und die Startnotiz des
  Starthelfers. Kein Fremdschlüssel auf das Konto (wie `student_day_notes`): Der Nachweis bleibt bei der Schule.
- **Rollen des Tages** (`flight_day_role`): «instructor» = Admin, Fluglehrer, Schulleitung oder im Termin als
  Fluglehrer eingeteilt; «helper» = Starthelfer der Schule oder im Termin als Starthelfer eingeteilt. Nur bei
  Schulgruppen.
- **Schreiben nur über RPCs**, keine direkten INSERT/UPDATE/DELETE: `school_flight_start` (Starthelfer oder
  Fluglehrer), `school_flight_land`, `school_flight_add` (Flug ohne erfassten Start), `school_flight_abort`
  (Startabbruch mit Grund, Starthelfer oder Fluglehrer), `school_flight_update` (Korrekturen; Starthelfer nur
  Startplatz und Startnotiz), `school_flight_set_notes`, `school_flight_delete` (nur Fluglehrer) und
  `set_flight_day_locations` (Standard-Start- und Landeplatz des Tages). Alle lehnen ab, sobald der Tag abgeschlossen
  ist (`flight_events.day_closed_at`).
- **Regeln in der Datenbank:** nur Schüler mit bestätigtem Platz (nicht Warteliste); höchstens ein Flug pro Schüler
  gleichzeitig in der Luft (Prüfung plus eindeutiger Teilindex); `seq` wird unter Sperre der Anmeldezeile vergeben
  und nach einem Löschen nicht neu nummeriert. Die Anzeige zählt fortlaufend und ohne Startabbrüche
  (`flightNumbers`).
- **Standardorte:** ohne Angabe der zuletzt an diesem Tag verwendete Start- bzw. Landeplatz, sonst der Standard des
  Termins.
- **Lesen:** Das Team des Tages (inkl. Starthelfer) liest `event_school_flights`, auch über Realtime.
  Rückmeldung und interne Notiz liegen in `event_school_flight_notes` und sind nur für Fluglehrer lesbar. Schüler
  lesen keine der beiden Tabellen, sondern `my_school_flights(event)`: nur eigene gelandete Flüge mit Rückmeldung
  und erst ab `flight_events.feedback_released_at`; Startabbrüche, Startnotizen und interne Notizen nie.

**Abweichungen vom Plan:** (1) Die Rückmeldung an den Schüler liegt nicht in `event_school_flights`, sondern
zusammen mit der internen Notiz in `event_school_flight_notes`. Sonst hätten Starthelfer sie über SELECT und
Realtime erhalten; eine spaltenweise Sperre wirkt bei bestehendem Tabellen-Grant nicht. (2) `flight_events` erhält
schon jetzt `default_takeoff_location_id`/`default_landing_location_id` (der Termin kennt das Fluggebiet bisher nur
als Text) sowie `day_closed_at`, `day_closed_by` und `feedback_released_at`, damit die Sperre nach dem Abschluss und
die Freigabe für Schüler von Anfang an durchgesetzt sind; die Oberfläche dazu folgt in 5.1. (3) Die Bewertung der
Manöver (`event_school_flight_items`) kommt wie geplant erst mit 4.3.

## Betrieb: Fehlerprotokoll

Migration `0049_client_errors.sql`, Logik in `src/lib/error-reporting.ts`, Seite `src/pages/AdminErrors.tsx`
(`/admin/errors`, unter «Mehr» nur für Flyary-Admins sichtbar).

- Die App meldet abgefangene Fehler still an `report_client_error()`: Seiten, die nicht rendern (Fehler-Auffang
  `PageErrorBoundary`, mit Komponenten-Stack), nicht abgefangene Fehler und abgelehnte Promises (`main.tsx`) sowie
  fehlende Seitendateien nach einem Deploy («Veraltete Version»). Mitgeschickt werden Pfad, App-Version und Browser.
- Kein Rauschen: Browser-Erweiterungen, ResizeObserver-Warnungen, «Script error.» und Netzwerkfehler im Offline-Modus
  werden verworfen; pro Seitenaufruf jeder Fehler einmal, höchstens 10.
- Die Datenbank fasst gleiche Fehler (Art, Meldung, Version) zu einer Zeile mit Zähler und betroffenen Personen zusammen,
  begrenzt auf 30 Meldungen pro Person und Stunde (abgemeldet: 200 insgesamt) und löscht Einträge nach 90 Tagen ohne
  Wiederholung. Ein erledigter Fehler, der wiederkommt, erscheint neu. Lesen und erledigen nur Admins (RLS).

## Betrieb: Datenbank-Typen, Typprüfung und Backup

- **Rundgang vor dem Push:** `npm run smoke` baut die App, startet sie lokal und ruft 23 Hauptseiten mit einer
  Test-Sitzung auf (alle Supabase-Anfragen lokal mit leeren Daten beantwortet, kein Zugriff aufs echte Projekt).
  Rot bei Laufzeitfehler, Fehler-Hinweis, leerer Seite oder fehlender Navigation. Findet Abstürze im Code, nicht
  Fehler mit echten Daten – dafür gibt es das Fehlerprotokoll.
- **Typprüfung:** `npm run typecheck` (= `tsc --noEmit -p tsconfig.app.json`). Ein blosses `npx tsc --noEmit` prüft
  nichts, weil `tsconfig.json` nur auf andere Konfigurationen verweist (`"files": []`).
- **Datenbank-Typen:** `npm run gen-types` erzeugt `src/integrations/supabase/types.ts` aus dem Live-Schema (nur lesend,
  Management API). Nach jeder angewendeten Migration ausführen – statt `"tabelle" as any`.
- **Backup:** `npm run backup` (`scripts/db-backup.mjs`, nur lesend) schreibt nach `%USERPROFILE%FlyaryBackups`
  (änderbar mit `FLYARY_BACKUP_DIR`, bewusst ausserhalb von OneDrive und Repo):
  `data/<Zeitstempel>/` mit allen Tabellen aus `public` plus `auth.users`/`auth.identities` als JSON und einem
  `manifest.json` (Commit, Migrationen, Zeilenzahlen, Dateiliste); `files/<bucket>/` spiegelt den Storage
  inkrementell. Die neuesten 8 Stände bleiben (`FLYARY_BACKUP_KEEP`). Enthält Personendaten und Passwort-Hashes.
  Wöchentlich per Windows-Aufgabenplanung, z.B.:
  `schtasks /Create /TN "Flyary Backup" /SC WEEKLY /D SUN /ST 20:00 /TR "cmd /c cd /d <Repo-Pfad> && npm run backup >> %USERPROFILE%FlyaryBackupsackup.log 2>&1"`
- **Wiederherstellen:** `node scripts/db-restore.mjs <Snapshot-Ordner> --ref <Ziel-Projekt>` prüft nur;
  mit `--yes` spielt es ein. Voraussetzung: Schema per `db-migrate --apply` im Ziel, Tabellen leer. Konten zuerst,
  dann die App-Tabellen in Fremdschlüssel-Reihenfolge mit abgeschalteten Triggern (keine Mitteilungen oder XP beim
  Einspielen), Sequenzen nachgeführt, danach die Dateien. Die SQL-Bausteine (`src/lib/backup-sql.ts`) sind getestet
  und gegen PGlite geprüft; ein vollständiger Probelauf in ein zweites Supabase-Projekt steht noch aus.

## Marktplatz: Bewertungen nach dem Verkauf (8.1)

Migration `0048_marketplace_reviews.sql`, Logik in `src/lib/marketplace-reviews.ts`, Dialoge
`src/components/market/MarkSoldDialog.tsx`, `ReviewDialog.tsx`, `ReviewsSheet.tsx`.

- **«Als verkauft markieren»** fragt, an wen verkauft wurde: zur Auswahl stehen die Personen, die im Anzeigen-Chat
  geschrieben haben (`marketplace_chat_buyers`), oder «Jemand anderes (ohne Bewertung)». Die Datenbank speichert den
  Käufer in `marketplace_listings.sold_to` – bei Neuware mit mehreren Stück erst beim letzten. Der Verkauf auf die
  Abrechnung (7.2) setzt den Käufer ebenfalls.
- **Gegenseitig bewerten:** Käufer und verkaufende Seite bewerten sich je einmal (1–5 Sterne, freiwillig bis 500 Zeichen
  Kommentar, nicht änderbar). Die Aufforderung steht auf der verkauften Anzeige; der Käufer erhält eine Mitteilung und
  sieht die gekaufte Anzeige weiterhin. Bei Schul-Anzeigen bewertet der Käufer die Schule.
- **Anbieter-Karte:** Durchschnitt und Anzahl (als Anbieter und als Käufer); ein Tipp öffnet die Liste mit Vorname des
  Bewertenden, Rolle, Monat und Anzeigentitel.
- **Melden:** jede Bewertung lässt sich melden; Flyary-Admins und -Moderation entfernen oder behalten sie unter
  «Moderation». Entfernte Bewertungen zählen nicht mehr.
- Schreiben nur über RPCs (`marketplace_review`, Fehler `cannot_review`, `invalid_rating`, `buyer_not_in_chat`).

**Auslieferung:** zuerst `node scripts/db-migrate.mjs --apply` (0048), danach das Frontend.

## Marktplatz: Öffentlicher Teilen-Link (8.4)

Migration `0047_marketplace_public_share.sql`, Edge Function `supabase/functions/get-shared-listing`, Seite
`src/pages/SharedListing.tsx` (`/shared/market/:token`).

- «Teilen» auf einer aktiven oder reservierten Anzeige, die für alle sichtbar ist, teilt einen öffentlichen Link. Er
  zeigt Fotos, Preis, Details und Sicherheitshinweise auch ohne Flyary-Konto – ohne Namen privater Verkäufer, bei
  Schulen mit den Angaben des Shops. Kontakt nur in Flyary; nach der Anmeldung geht es direkt zur Anzeige.
- Messenger (WhatsApp & Co.) erhalten eine Vorschau mit Titel, Preis und erstem Foto.
- Verkaufte, abgelaufene oder entfernte Anzeigen zeigen «nicht mehr verfügbar».

## Marktplatz: Verkauf auf die Abrechnung (7.2) und Abnahme M3

Migration `0046_marketplace_sale_to_billing.sql`, Dialog `src/components/market/SellToMemberDialog.tsx`, Logik in
`src/lib/marketplace-billing.ts`.

- **Schul-Shop → Anzeige → «An Mitglied verkaufen (Abrechnung)»**: Person der Schule wählen (Namenssuche), Preis
  übernehmen oder anpassen. Die Datenbank legt eine Abrechnungsposition an (Art «Kauf», Beschreibung «Marktplatz: …»,
  Betrag in CHF, verknüpft über `billing_items.listing_id`) und markiert die Anzeige als verkauft – bei Neuware mit
  mehreren Stück eines weniger. Die Position erscheint in der Schul-Abrechnung, im Schülerdossier und bei der Person selbst.
- Nur für Schul-Anzeigen, nur durch Admin, Schulleitung oder Shop, nur an Mitglieder der Schule
  (`marketplace:school_only`, `marketplace:buyer_not_member`).
- **Abnahmeprüfung M3** ohne Befund: Verkauf auf die Abrechnung sondert verknüpftes Material aus (7.1) und benachrichtigt
  Merkende (6.1); Regeln-Bestätigung (4.10) gilt auch beim Weg über den Materialbestand; Abrechnungsart «Kauf» gab es schon.

**Auslieferung:** zuerst `node scripts/db-migrate.mjs --apply` (0046), danach das Frontend.

## Marktplatz: Occasion aus dem Materialbestand (7.1)

Migration `0045_marketplace_school_equipment.sql`, Zuordnung in `src/lib/marketplace-equipment.ts`.

- **Materialbestand → «Als Occasion verkaufen»** (für Admins und Schulleitung, die den Shop führen): öffnet das Formular
  als Schul-Anzeige, vorausgefüllt aus dem Material – Kategorie (Schirm, Gurtzeug, Retter, Helm; Funk/Vario als
  Instrument, Rest «Sonstiges»), Bezeichnung als Titel, Grösse, Zustand «Gebraucht», Kaufjahr als Baujahr und beim
  Schirm der letzte Check als «letzte Nachprüfung». Preis, Fotos und Ort ergänzt die Schule.
- Die Anzeige merkt sich das Material (`school_equipment_id`); pro Stück höchstens eine laufende Anzeige, nur Material
  der verkaufenden Schule (sonst `marketplace:equipment_other_school`). Im Materialbestand steht dann «Im Marktplatz»
  mit Link zur Anzeige.
- **Verkauft → ausgesondert:** Wird die Anzeige als verkauft markiert, setzt die Datenbank das Material auf
  «ausgesondert» mit Grund «Verkauft (Marktplatz)».

**Auslieferung:** zuerst `node scripts/db-migrate.mjs --apply` (0045), danach das Frontend.

## Betrieb: Veraltete App-Version auf Geräten (Hotfix)

Nach mehreren Deploys kurz hintereinander hielt ein Handy eine alte Startseite im Service-Worker-Cache, deren CSS/JS es
auf dem Server nicht mehr gab (kein Styling, weisse Seite bei «Mehr»). `src/main.tsx` erkennt fehlende `/assets/`-Dateien
jetzt (Ladefehler von CSS/JS, Stylesheets ohne Inhalt nach dem Laden, fehlgeschlagene Lazy-Imports) und löscht Service
Worker und Caches (`forceAppUpdate`), höchstens einmal pro Minute. Hängt ein Gerät noch auf einem alten Stand ohne diese
Reparatur: Chrome → Website-Einstellungen → `flyaryapp.vercel.app` → «Löschen und zurücksetzen». Die Adresse hat kein
«www.» (`www.flyaryapp.vercel.app` hat kein gültiges Zertifikat und scheitert an HSTS).

## Marktplatz M2: Nachtrag Abnahmeprüfung

Prüfung von 6.1–6.4 an den Übergängen. Ein Fund, behoben: Das Herz erschien in der Übersicht auch auf den eigenen
Anzeigen; die Datenbank lehnt das Merken eigener Anzeigen ab, und es erschien nur «Etwas ist schiefgelaufen». Die Suche
liefert jetzt pro Treffer `mine` (in Migration 0044), das Herz fehlt dort. Ohne Befund: gespeicherte Suchen mit Umkreis
(Position wird beim Speichern ermittelt, Mitteilungen nutzen dieselbe Filterregel), gemerkte Anzeigen nach Moderation,
versteckte Merkmale in Formular und Detailseite, Gewichtsfilter auch in gespeicherten Suchen.

## Marktplatz: Umkreissuche und Startgewicht (6.4)

Migration `0044_marketplace_radius_weight.sql`, Logik in `src/lib/geo-ch.ts`.

- **Position:** Beim Speichern einer Anzeige ermittelt die App über den öffentlichen Dienst von geo.admin.ch die Position
  der (Schweizer) PLZ und speichert sie auf 2 Nachkommastellen gerundet (etwa 1 km) in `lat`/`lng`. Ausländische PLZ
  bleiben ohne Position. Bestehende Anzeigen erhalten die Position beim nächsten Speichern.
- **Umkreis:** Im Filterblatt «Umkreis um PLZ» mit 10/25/50/100 km. Anzeigen ohne Position fallen bei aktivem Umkreis
  weg. Unbekannte PLZ: Hinweis, Suche ohne Umkreis.
- **Startgewicht:** Filter in kg; blendet Schirme aus, deren Gewichtsbereich nicht passt (Schirme ohne Angabe und andere
  Kategorien bleiben). Das zuletzt verwendete Gewicht merkt sich der Browser; die Detailseite eines Schirms zeigt dann
  «Passt zu deinem Startgewicht» bzw. «Ausserhalb deines Startgewichts». Abweichung vom Plan: Das Profil hat kein
  Gewichtsfeld, darum stammt der Wert aus dem Filter statt aus dem Profil.
- Beide Filter sind Teil von `market_listing_matches` und gelten damit auch für gespeicherte Suchen und deren Mitteilungen.

**Auslieferung:** zuerst `node scripts/db-migrate.mjs --apply` (0044), danach das Frontend.

## Marktplatz: Vorausfüllen aus dem eigenen Material (6.3)

Logik in `src/lib/marketplace-prefill.ts`, keine Migration.

- Beim Inserieren (privat) gibt es in Schritt 2 «Aus meinem Material»: Auswahl eines eigenen Schirms aus dem Profil
  (`pilot_gliders`). Übernommen werden Kategorie Schirm, Hersteller, Modell, Grösse und – falls noch leer – der Titel.
- **Flugstunden aus dem Flugbuch:** Summe der eigenen Flüge mit diesem Schirm, auf ganze Stunden gerundet. Ein Flug zählt,
  wenn Hersteller und Modell im Schirmtext des Flugs vorkommen; nennen beide eine Grösse in Klammern, muss sie
  übereinstimmen (zwei Grössen desselben Modells sind verschiedene Schirme).
- Solche Stunden tragen das versteckte Merkmal `hours_from_logbook`; die Detailseite zeigt «… h (laut Flyary-Flugbuch)».
  Ändert die verkaufende Person die Stunden von Hand, fällt der Hinweis weg.
- Abweichung vom Plan: `flights.glider` bleibt Freitext (wie ihn Flugformular und IGC-Import schreiben); eine feste
  Verknüpfung Flug → Schirm wäre ein eigener Umbau. Der Abgleich ist deshalb ungefähr und als Vorschlag gekennzeichnet.
- Test-Infrastruktur: Die Vorbereitung des Chat-Datenbanktests lädt inzwischen alle Chat- und Marktplatz-Migrationen und
  hat dafür 60 statt 10 Sekunden Zeit (sie lief im vollen Lauf gelegentlich ins Zeitlimit).

## Marktplatz: Gespeicherte Suchen (6.2)

Migration `0043_marketplace_saved_searches.sql`, Liste `src/components/market/SavedSearchesSheet.tsx`, Logik in
`src/lib/marketplace-saved-searches.ts`.

- **Suche speichern:** In der Übersicht erscheint ein Lesezeichen-Knopf, sobald Suchtext oder Filter gesetzt sind (die
  Sortierung allein zählt nicht). Name vorgeschlagen aus Suchtext oder Kategorien. Höchstens 5 Suchen pro Person.
- **Gespeicherte Suchen** (Lesezeichen-Knopf mit Anzahl neuer Treffer): öffnen, Mitteilung ein/aus, löschen. «Neu» zählt
  Treffer, die seit dem letzten Öffnen der Suche online gingen.
- **Mitteilung** (Glocke + Push «Neu im Marktplatz: …»), wenn eine passende Anzeige online geht (veröffentlicht oder
  nach Ablauf verlängert) und die Person sie sehen darf; höchstens eine pro Suche und Tag, nie für eigene Anzeigen.
  Tippen öffnet `/market?saved=<id>` mit den Filtern der Suche.
- **Eine Filterregel für beides:** `market_listing_matches(listing, filters)` enthält die Filter der Suche aus 4.5;
  `marketplace_search` verwendet sie jetzt ebenfalls. Eine gespeicherte Suche findet damit genau, was die Suche zeigt.
- Gespeichert werden die Filter im Format der Suche (für den Abgleich) und die URL der Übersicht (zum Öffnen).

**Auslieferung:** zuerst `node scripts/db-migrate.mjs --apply` (0043), danach das Frontend.

## Marktplatz: Merkliste (6.1)

Migration `0042_marketplace_favorites.sql`, Herz `src/components/market/FavoriteButton.tsx`, Liste
`src/components/market/FavoritesList.tsx`, Logik in `src/lib/marketplace-favorites.ts`.

- **Herz** auf jeder Kachel der Übersicht und auf der Detailseite fremder Anzeigen (sofortige Anzeige, bei Fehler
  zurückgesetzt). Merken lassen sich nur Anzeigen, die man sehen darf, und nicht die eigenen.
- **«Meine Anzeigen» → Reiter «Gemerkt»** (`/market/mine?tab=favorites`): gemerkte Anzeigen mit Preis und Status;
  verfügbare zuerst. Verkaufte, ausgeblendete oder abgelaufene bleiben mit dem Grund in der Liste
  (`marketplace_my_favorites`, Fotos nur solange die Anzeige sichtbar ist).
- **Mitteilung** (Glocke + Push, Absender «Marktplatz») an alle, die eine Anzeige gemerkt haben, wenn sie günstiger,
  reserviert oder verkauft wird (Trigger auf `marketplace_listings`); nicht bei Preiserhöhungen, nie an die verkaufende
  Seite.

**Auslieferung:** zuerst `node scripts/db-migrate.mjs --apply` (0042), danach das Frontend.

## Marktplatz M1: Nachtrag Abnahmeprüfung

Prüfung aller M1-Aufträge (4.1–4.10) nach Abschluss der Stufe, gezielt an den Übergängen zwischen den Aufträgen.
Zwei Funde, beide behoben:

- **Glocke (seit 4.8):** Marktplatz-Mitteilungen haben keinen Absender (`actor_id` leer). Die Glocke fragte die Profile
  trotzdem mit dieser leeren ID ab; die Abfrage schlug fehl, und bei *allen* Mitteilungen stand «Pilot» statt des
  Namens. Leere IDs werden jetzt vor der Abfrage herausgefiltert.
- **«Verlängern» bei Neuware von Schulen:** Diese Anzeigen laufen nicht ab, trotzdem bot die Liste «Verlängern» an
  (ohne Wirkung). Angeboten wird es jetzt nur bei Anzeigen mit Ablaufdatum (Test ergänzt).

Ohne Befund geprüft: Sichtbarkeit von Schul-Anzeigen bei inaktivem Shop auch nach Moderation und Aufräumen, Pflicht
zur Bestätigung der Regeln auch für Schul-Anzeigen, Chat-Rechte des Shop-Teams, Aufräumen ausgeblendeter Anzeigen,
Kachel «Shop» im Menü «Mehr». Schon während der Umsetzung gefunden und behoben: PL/pgSQL-Syntax in 0034, Fehlercode bei
nicht-`Error`-Objekten von Supabase (4.3), blockierte Konto-Löschung durch das Moderationsprotokoll (4.8).

## Marktplatz: Regeln und Nutzungsbedingungen (4.10)

Migration `0041_marketplace_terms.sql`, Dialog `src/components/market/MarketTermsDialog.tsx`, Logik in
`src/lib/marketplace-terms.ts`, Abschnitt «Marktplatz» in `src/pages/LegalTerms.tsx` (Texte unter `market.terms.*`).

- **Einmalige Bestätigung** vor der ersten Anzeige: wahrheitsgemässe Angaben, nicht flugtaugliches Material als
  «Für Teile» kennzeichnen, Flyary vermittelt nur, Moderation und Sperren. Gespeichert wird die bestätigte Version mit
  Zeitpunkt (`marketplace_terms_acceptances`); ohne Bestätigung der aktuellen Version lässt die Datenbank keine neue
  Anzeige zu. Ändern sich die Regeln, wird die Version in Migration und `MARKET_TERMS_VERSION` erhöht, und alle
  bestätigen vor der nächsten Anzeige neu.
- **Nutzungsbedingungen:** neuer Abschnitt «Marktplatz» mit Rolle von Flyary, Verantwortung für Angaben und
  Lufttüchtigkeit, verbotenen Inhalten, Moderation und Sperren, Pflichten der Flugschulen und dem Umgang mit Daten
  (automatisches Löschen von Fotos und Entwürfen, Konto-Löschung).
- **Privatverkauf:** Bei privaten Angeboten fügt ein Link im Formular den Vorschlag «Privatverkauf: … jede Gewährleistung
  wird wegbedungen, soweit gesetzlich zulässig» in die Beschreibung ein. Nicht erzwungen.
- Die Texte sind ein Vorschlag und noch nicht juristisch geprüft (offener Punkt im Umsetzungsplan, Abschnitt 10).

**Auslieferung:** zuerst `node scripts/db-migrate.mjs --apply` (0041), danach das Frontend.

## Marktplatz: Aufräumen, Speicherüberwachung, Konto-Löschung (4.9)

Migrationen `0039_marketplace_cleanup.sql` und `0040_marketplace_cleanup_schedule.sql`, Edge Function
`supabase/functions/marketplace-cleanup`, Speicheranzeige in `src/lib/storage-usage.ts`.

- **Täglich um 03:15 UTC** ruft `pg_cron` (0040) die Edge Function `marketplace-cleanup` auf (mit `x-push-secret`, wie
  `send-push`). Sie führt `marketplace_daily_cleanup()` aus (nur Service-Rolle):
  1. aktive/reservierte Anzeigen nach Ablauf → «abgelaufen»
  2. 3 Tage vor Ablauf eine Erinnerung (Glocke + Push «läuft bald ab»), einmal pro Laufzeit; nach dem Verlängern wieder
  3. Fotos von Anzeigen, die vor über 14 Tagen verkauft oder von der Moderation ausgeblendet wurden oder seit über
     30 Tagen abgelaufen sind: Einträge weg, Dateien werden gelöscht
  4. Entwürfe, die 30 Tage nicht bearbeitet wurden, samt Fotos
  5. verwaiste Dateien (Anzeige gelöscht, oder Datei ohne Eintrag seit einem Tag), höchstens 1000 pro Lauf
  Die Datenbank liefert nur die Pfade; gelöscht wird über die Storage-API in der Edge Function (Dateien in
  `storage.objects` lassen sich nicht per SQL entfernen). Was nicht gelöscht werden konnte, taucht beim nächsten Lauf
  als verwaist wieder auf.
- **Speicheranzeige** für Flyary-Admins oben auf der Moderationsseite: belegter Speicher gesamt und pro Bucket, Anteil
  am Free-Plan (1 GB), Hinweis ab 700 MB, auf Supabase Pro zu wechseln (`marketplace_storage_usage`).
- **Konto löschen:** `delete-account` entfernt jetzt auch die Marktplatz-Fotos der eigenen Anzeigen (sie liegen unter der
  Anzeigen-ID, nicht unter der Benutzer-ID). Schul-Anzeigen bleiben bei der Schule. Chats bleiben für die Gegenseite
  lesbar wie bisher.

**Auslieferung:** `node scripts/db-migrate.mjs --apply` (0039, 0040 – 0040 schaltet `pg_cron` ein), dann die Edge Functions
deployen: `npx supabase@latest functions deploy marketplace-cleanup delete-account --use-api --project-ref <ref>`.

## Marktplatz: Melden und Moderation (4.8)

Migration `0038_marketplace_moderation.sql`, Seite `src/pages/MarketModeration.tsx` (`/market/moderation`), Dialog
`src/components/market/ReportListingDialog.tsx`, Logik in `src/lib/marketplace-moderation.ts`.

- **Melden:** Fahne auf jeder fremden Anzeige. Gründe: Betrug, gefährliches Material ohne Kennzeichnung, falsche
  Kategorie, anstössiger Inhalt, anderes; dazu eine optionale Notiz. Eine Meldung pro Person und Anzeige.
- **Wer moderiert (Entscheid E5):** Flyary-Admins und -Moderatoren (`app_role`) alles; Schul-Moderatoren (Funktion
  «Marktplatz-Moderation» in einer Schule mit aktivem Shop) nur Privatanzeigen anderer. Meldungen zu Schul-Anzeigen sehen
  nur Flyary-Admins und -Moderatoren. Schul-Moderatoren sehen gemeldete Privatanzeigen auch dann, wenn sie ausgeblendet sind.
- **Moderationsseite:** offene Meldungen pro Anzeige (Anzahl, Gründe, Notizen, Alter), Aktionen «Ausblenden» (Grund
  Pflicht, sieht die verkaufende Person), «Wieder freigeben», «Meldung abweisen». Nur Admins: «Sperren» (Tage oder bis zur
  Aufhebung) und «Löschen». Einstieg über das Schild-Symbol in der Marktplatz-Übersicht, sichtbar nur für Moderierende,
  mit Anzahl offener Fälle.
- **Automatisch ausgeblendet** ab 3 offenen Meldungen verschiedener Personen, bis jemand entscheidet.
- **Verkaufende** erhalten beim Ausblenden eine Glocken-Mitteilung (Absender «Marktplatz») und einen Push; «Meine
  Anzeigen» und die Detailseite zeigen den Grund. Bei Schul-Anzeigen geht die Mitteilung an die Person, die sie erfasst hat.
- **Moderierende** erhalten bei neuen Meldungen einen Push, höchstens einmal pro Stunde.
- **Protokoll** (`marketplace_moderation_log`): jedes Ausblenden, Freigeben, Abweisen, Sperren, Aufheben und das Löschen
  fremder Anzeigen durch Admins. Es verweist ohne Fremdschlüssel auf die betroffene Person, damit ein Protokolleintrag
  nie eine Konto-Löschung blockiert (Fund aus den Tests: das Löschen eines Kontos hätte sonst abgebrochen).
- Die globale Rolle Admin/Moderator wird in `user_roles` vergeben (noch ohne Oberfläche).

**Auslieferung:** zuerst `node scripts/db-migrate.mjs --apply` (0038), danach das Frontend.

## Marktplatz: Schul-Shop mit Neuware (4.7)

Migration `0037_school_shop.sql`, Kachel «Shop» im Flugschul-Bereich (`src/components/school/SchoolShop.tsx`), Logik in
`src/lib/school-shop.ts`. Die Verwaltungsliste aus «Meine Anzeigen» ist jetzt die Komponente
`src/components/market/ManagedListings.tsx` und dient auch dem Shop.

- **Shop-Profil** (`school_shop_profiles`): Firma, Adresse, UID (Format `CHE-123.456.789`, Pflicht bei MWST-Pflicht),
  MWST-pflichtig, E-Mail, Telefon, Gewährleistungstext, «aktiv». Aktiv geht nur mit vollständigen Angaben (CHECK in der
  Datenbank, dieselbe Prüfung zeigt das Formular vorher an). Bearbeiten: Admins und Schulleitung; das Shop-Team liest mit.
  Aktive Profile sind für alle Angemeldeten lesbar, weil jede Schul-Anzeige die Anbieterangaben zeigt.
- **Ohne aktiven Shop** lassen sich Schul-Anzeigen nicht veröffentlichen oder verlängern (`marketplace:shop_not_ready`),
  und bereits veröffentlichte sind für andere unsichtbar (`market_listing_visible`), bis der Shop wieder aktiv ist.
- **Neue Funktionen** im Personen-Dialog: «Shop» (inseriert für die Schule, beantwortet die Anfragen) und
  «Marktplatz-Moderation» (wird in 4.8 genutzt). Wer «Shop» hat, erhält den Flugschul-Bereich mit der Kachel «Shop»;
  Instruktoren sehen die Kachel nicht (`canOpenSchoolSection(…, canShop)`).
- **Inserieren:** Wer für eine Schule verkaufen darf, wählt im Formular «Verkaufen als» (ich privat oder die Schule;
  `marketplace_my_shops`). Schul-Anzeigen haben zusätzlich «Sichtbar für» (alle / nur unsere Schüler) und «Anzahl Stück».
  Neuware von Schulen läuft nicht ab und zählt beim Verkauf herunter (seit 4.4).
- **Detailseite:** Bei Schul-Anzeigen die Anbieterangaben (Firma, Adresse, UID, Kontakt, Gewährleistung) und «inkl. MWST»
  beim Preis, wenn die Schule MWST-pflichtig ist.
- Abweichungen vom Plan: Funktionen vergeben weiterhin nur Admins (die bestehende Regel für `group_member_functions`),
  nicht zusätzlich die Schulleitung. Wer nur «Shop» hat, sieht im Flugschul-Bereich neben dem Shop dieselben Kacheln wie
  Starthelfer (Flugtage, Kommunikation, Verfügbarkeit).

**Auslieferung:** zuerst `node scripts/db-migrate.mjs --apply` (0037), danach das Frontend.

## Marktplatz: Chat zur Anzeige (4.6)

Migration `0036_marketplace_listing_chat.sql`, Logik in `src/lib/marketplace-chat.ts`, Anzeigenkarte
`src/components/market/ListingChatCard.tsx`; Tests in `src/test/chat-channels-database.test.ts` (Abschnitt «listing chats»).

- **Neue Kanalart `listing`:** ein Chat pro Anzeige und Käufer, eröffnet über «Nachricht senden» auf der Detailseite
  (`marketplace_open_chat`). Direktnachrichten verlangen weiterhin eine gemeinsame Gruppe; ein Anzeige-Chat braucht das
  nicht, weil er nur aus einer Anzeige entsteht, welche die Person sehen darf. Nicht für eigene, nicht veröffentlichte oder
  abgelaufene Anzeigen und nicht für Gesperrte.
- **Wer liest mit:** Käufer und (bei Privatanzeigen) Verkäufer als Kanalmitglieder. Bei Schul-Anzeigen steht die Schule im
  Kanal (`group_id`), und alle, die ihre Anzeigen verwalten (Admin, Schulleitung, Funktion `shop`), lesen und antworten;
  neue Shop-Mitarbeitende sehen bestehende Chats sofort. Instruktoren und Schüler sehen die Chats nicht (die
  Abkürzung «Schulteam sieht alle Kanäle der Gruppe» aus 0026 gilt jetzt nur noch für Gruppen- und Terminkanäle).
- **Bestehende Chat-Oberfläche** mit Antworten, Reaktionen, Anhängen und Bearbeiten. Oben eine Karte der Anzeige
  (Titelbild, Titel, Preis, Status, Link zur Anzeige) und der feste Hinweis «Nie im Voraus an Unbekannte überweisen …».
  Ein neuer Chat startet mit dem Vorschlag «Hallo, ist «Titel» noch verfügbar?» im Eingabefeld.
- **Zahlungshinweis:** Enthält eine gesendete Nachricht eine IBAN, einen Zahlungslink (PayPal.me, Revolut, Wise, Stripe,
  SumUp) oder «Western Union/MoneyGram», erscheint ein Warnhinweis. Die Nachricht wird trotzdem gesendet.
- **Posteingang:** Anzeige-Chats erscheinen, sobald die erste Nachricht geschrieben ist, mit eigenem Filter «Marktplatz»,
  dem Namen der Gegenseite und ohne @-Erwähnungen. Push wie bei Direktnachrichten (jede Nachricht, gebündelt).
  Autorennamen stehen nur in Schul-Chats über den Nachrichten (dort antworten mehrere Personen).
- Namen und Anzeigenkarte kommen aus `marketplace_chat_info` (SECURITY DEFINER), weil Profile Fremder per RLS nicht lesbar
  sind; nur für Personen, die den Kanal lesen dürfen.
- Der Chat bleibt lesbar, wenn die Anzeige verkauft oder gelöscht wird (dann «Anzeige nicht mehr online», Titel aus dem
  Kanal).

**Auslieferung:** zuerst `node scripts/db-migrate.mjs --apply` (0036), danach das Frontend.

## Marktplatz: Übersicht, Suche und Detailseite (4.5)

Migration `0035_marketplace_search.sql`, Seiten `src/pages/Market.tsx` (`/market`) und
`src/pages/MarketListingDetail.tsx` (`/market/:id`), Logik in `src/lib/marketplace-search.ts`.

- **Übersicht:** Kachelraster mit Titelbild, Preis, Titel, Ort und Alter der Anzeige; Abzeichen «Gesucht»,
  «Reserviert», «Flugschule». Suchfeld (verzögert), Kategorie-Chips und ein Filterblatt mit Sortierung (neueste, Preis
  auf-/absteigend), Angebot/Gesuch, Preis von/bis, Zustand, EN/LTF-Klasse (nur wenn Schirme dabei sein können), Grösse,
  Kanton und «Nur Flugschulen». Die Filter stehen in der URL, damit «Zurück» von einer Anzeige sie wiederherstellt.
  «Mehr laden» holt die nächsten 24 Anzeigen (Keyset-Paginierung, ohne Lücken oder Doppelte).
- **Suche** (`marketplace_search`, läuft mit den Rechten der aufrufenden Person, RLS gilt): nur aktive/reservierte,
  nicht abgelaufene Anzeigen. Wortanfänge in Titel, Hersteller, Modell, Grösse und Beschreibung (`tsvector 'simple'`);
  für Tippfehler zusätzlich Trigramm-Ähnlichkeit (`pg_trgm`, im Schema `extensions`) auf Titel/Hersteller/Modell.
  «Gratis» zählt beim Sortieren als 0, «Preis auf Anfrage» kommt immer ans Ende.
- **Detailseite:** Bildergalerie, Preis, Ort, Übergabe, Alter, Sicherheitshinweise, Merkmal-Tabelle, Beschreibung und
  Anbieter-Karte (Name, Profilbild, Mitglied seit, Anzahl Flüge in Flyary; bei Schulen der Schulname). Wer die Anzeige
  verwaltet, sieht «Bearbeiten». «Teilen» teilt den App-Link (kein öffentlicher Link, Entscheid E3).
- **Anbieter-Karte** über `marketplace_seller_cards` (SECURITY DEFINER), weil Profile und Flüge für Fremde sonst nicht
  lesbar sind; sie liefert nur Daten zu Anzeigen, welche die aufrufende Person sehen darf.
- Die Sichtbarkeitsregel aus 0032 ist jetzt die Funktion `market_listing_visible`; die RLS-Regel und die
  SECURITY-DEFINER-Funktionen verwenden dieselbe Prüfung.
- Menüeintrag «Marktplatz» führt jetzt auf die Übersicht; «Meine Anzeigen» ist oben rechts erreichbar. In «Meine
  Anzeigen» öffnen Entwürfe das Formular, alle anderen die Detailseite.
- **Noch nicht dabei:** «Nachricht senden» (4.6) und «Melden» (4.8).

**Auslieferung:** zuerst `node scripts/db-migrate.mjs --apply` (0035), danach das Frontend.

## Marktplatz: Inserieren und «Meine Anzeigen» (4.4)

Erste Oberfläche des Marktplatzes. Migration `0034_marketplace_listing_status.sql`, Seiten `src/pages/MarketListingForm.tsx`
und `src/pages/MarketMine.tsx`, Komponenten unter `src/components/market/`, Regeln in `src/lib/marketplace-listing.ts`.

- **Einstieg:** Mehr → Community → «Marktplatz» (`/market/mine`), bis die Übersicht aus 4.5 steht. Routen `/market/new`,
  `/market/:id/edit`.
- **Inserieren in drei Schritten:** Fotos → Details (Angebot/Suche, Kategorie, Titel, Hersteller/Modell/Baujahr/Grösse je
  nach Kategorie, Zustand, Kategorie-Merkmale, Beschreibung) → Preis und Ort (Preisart, Betrag, PLZ, Ort, Kanton, Übergabe).
  Schritt 3 zeigt die Sicherheitshinweise, wie Interessierte sie sehen werden, und was vor dem Veröffentlichen noch fehlt.
  Beim Bearbeiten sind alle Abschnitte auf einer Seite (wie beim Flug).
- **Entwurf:** Beim «Weiter» nach Schritt 2 wird die Anzeige als Entwurf gespeichert; erst dann werden die in Schritt 1
  gewählten Fotos hochgeladen (der Speicherpfad braucht die Anzeigen-ID). Zusätzlich «Als Entwurf speichern».
- **Statusfunktionen** (nur über RPCs, Fehler als `marketplace:<code>` übersetzt): `marketplace_publish` prüft
  serverseitig PLZ/Ort, bei Angeboten Preis, Zustand, Pflichtmerkmale der Kategorie und mindestens ein Foto, dazu die
  Grenzen 10 aktive Anzeigen pro Person / 50 pro Schule und 5 Veröffentlichungen pro Person in 24 Stunden.
  `marketplace_reserve`, `marketplace_mark_sold` (Schul-Anzeigen mit mehreren Stück zählen herunter),
  `marketplace_renew` (60 Tage; eine abgelaufene Anzeige kommt zurück und nach oben), `marketplace_bump` (einmal in 7 Tagen).
  Laufzeit 60 Tage; Neuware von Schulen läuft nicht ab.
- **Meine Anzeigen:** Reiter Aktiv / Entwürfe / Beendet mit Titelbild, Preis, Status und Restlaufzeit (Warnfarbe ab
  7 Tagen). Aktionen je nach Zustand; «Hochschieben» zeigt, ab wann es wieder geht. Löschen entfernt zuerst die
  Fotodateien, dann die Anzeige.
- **Abweichungen vom Plan:** Kein Autosave über `note-autosave.ts` (das ist auf Notizen zugeschnitten und speichert
  bewusst nichts im Browser); gespeichert wird beim Schrittwechsel und per Knopf. Die Push-Erinnerung 3 Tage vor Ablauf
  kommt mit dem täglichen Job in 4.9. «Als Schule inserieren» folgt mit dem Schul-Shop in 4.7 (dort gehören die
  Pflichtangaben dazu); die Datenbank kann es schon. Die Tagesgrenze gilt nur für Privatpersonen; Schulen begrenzt die
  Obergrenze von 50 aktiven Anzeigen.

**Auslieferung:** zuerst `node scripts/db-migrate.mjs --apply` (0031–0034), danach das Frontend.

## Marktplatz: Fotos (4.3)

Migration `0033_marketplace_photos.sql`, App-Logik in `src/lib/marketplace-photos.ts`, Tests in
`src/test/marketplace-database.test.ts` (Abschnitt «photos») und `src/lib/marketplace-photos.test.ts`. Noch ohne Oberfläche.

- **Privater Bucket `marketplace-photos`**, nur WebP/JPEG, max. 2 MB pro Datei. Pfade
  `<anzeige>/<foto>.webp` und `<anzeige>/<foto>_thumb.webp`.
- Pro Foto werden im Browser zwei Dateien erzeugt: 1280 px für die Galerie, 320 px als Vorschaubild für Listen (spart
  Speicher und Datentransfer im Free-Plan). Kann der Browser ein Bild nicht umwandeln (z. B. HEIC ausserhalb von
  Safari), wird nichts hochgeladen und der Fehler `unsupported_format` gemeldet.
- **Zugriff:** Fotos sieht, wer die Anzeige sehen darf (die Speicher-Regel fragt die Anzeige ab, deren eigene RLS
  entscheidet). Hochladen und Löschen: wer die Anzeige verwaltet; löschen darf auch die globale Moderation. Keine neuen
  Fotos bei verkauften, abgelaufenen oder entfernten Anzeigen.
- **Obergrenze:** max. 6 Fotos pro Anzeige in der Tabelle `marketplace_listing_photos` (Trigger sperrt die Anzeige, damit
  zwei gleichzeitige Uploads nicht beide als 7. Foto durchkommen) und max. 12 Dateien im Ordner der Anzeige.
- **Reihenfolge** über die RPC `marketplace_reorder_photos` (alle Positionen in einem Schritt, erstes Foto = Titelbild).
- Beim Hochladen werden bereits hochgeladene Dateien wieder entfernt, wenn ein späterer Schritt scheitert. Beim Löschen
  zuerst die Dateien, dann der Eintrag.
- Abweichung vom Plan: Das gewählte Originalbild darf bis 20 MB gross sein statt 5 MB (Handyfotos sind oft grösser); in
  den Speicher kommen nur die komprimierten Dateien. Dateien gelöschter Anzeigen bleiben vorerst liegen; der
  Aufräum-Job in 4.9 entfernt verwaiste Ordner.

**Auslieferung:** `node scripts/db-migrate.mjs --apply` (0033). Kein Frontend-Deploy nötig.

## Marktplatz: Kategorien, Merkmale und Sicherheitshinweise (4.2)

Reine App-Logik, noch ohne Oberfläche und ohne Migration (`src/lib/marketplace-categories.ts`,
`src/lib/marketplace-safety.ts`, Texte unter `market.*` in DE/FR/EN).

- **Kategorien:** Schirm, Tandemschirm, Gurtzeug, Retter, Instrumente, Helm, Bekleidung/Zubehör, Sonstiges. Pro
  Kategorie ist festgelegt, ob Hersteller/Modell/Baujahr und Grösse abgefragt werden und welche Zusatzmerkmale es gibt
  (in `marketplace_listings.attributes`): z. B. Schirm mit EN/LTF-Klasse (Pflicht), Startgewicht von/bis, Flugstunden,
  letzte Nachprüfung, Porosität, Reparaturen; Retter mit Typ und max. Anhängelast (Pflicht) und letztem Packdatum.
- **`validateAttributes`** prüft und bereinigt die Eingaben eines Formulars: unbekannte Schlüssel und leere Felder fallen
  weg, Zahlen aus Text werden umgewandelt, Datumsangaben als Monat (`2026-04`) oder Tag, nicht in der Zukunft.
  Pflichtfelder gelten nur für Angebote, nicht für Such-Anzeigen.
- **Sicherheitshinweise** (`safetyHints`), nur Hinweise, nichts wird blockiert: Retter mit unbekanntem oder über
  6 Monate altem Packdatum, Schirm ohne Angabe zur Nachprüfung oder mit Nachprüfung über 24 Monate, Klasse C/D/CCC nicht
  für Einsteiger, «Für Teile» als nicht flugtauglich, allgemein «vor dem ersten Flug prüfen lassen» bei Schirm, Gurtzeug,
  Retter und Helm. Such-Anzeigen bekommen keine Hinweise.
- Abweichung vom Plan: Bei **neuem** Material fehlen die Hinweise «Nachprüfung fehlt» bzw. «Packdatum unbekannt», weil
  sie dort nicht zutreffen. Die Datenbank prüft `attributes` vorerst nur als JSON-Objekt; die serverseitige Prüfung der
  Pflichtfelder folgt mit der Veröffentlichungs-RPC in 4.4.
- Ein Test stellt sicher, dass jede Kategorie, jede Option und jeder Hinweis in allen drei Sprachen übersetzt ist.

## Marktplatz: Datenmodell und Zugriffsregeln (4.1)

Grundlage für den Marktplatz aus dem `Umsetzungsplan Marktplatz für Flyary (technische Spezifikation).md`
(Migrationen `0031_marketplace_group_functions.sql` und `0032_marketplace_listings.sql`, Tests in
`src/test/marketplace-database.test.ts` und `src/lib/marketplace.test.ts`). Noch ohne Oberfläche.

- **Anzeigen** (`marketplace_listings`): entweder privat (`seller_user_id`) oder von einer Flugschule
  (`seller_group_id`, nur Gruppen vom Typ `school`, per Trigger geprüft). Schul-Anzeigen verwalten Admins, Schulleitung
  und die neue Funktion `shop` (`market_can_manage`). Mehrere Stück (`quantity`) und «nur für unsere Schüler»
  (`visibility = 'school_students'`) gibt es nur bei Schulen.
- **Lesen:** aktive/reservierte, nicht abgelaufene Anzeigen sehen alle Angemeldeten (Schüler-Angebote nur Mitglieder der
  Schule). Entwürfe, verkaufte, abgelaufene und entfernte Anzeigen sehen nur Verwaltende und die globale Moderation
  (`app_role` admin/moderator). Nicht angemeldete Personen sehen nichts.
- **Schreiben:** Neue Anzeigen starten immer als Entwurf. Clients dürfen nur die Inhaltsspalten ändern
  (spaltenweises `GRANT UPDATE`); Status, Datumsfelder und Verkäufer ändern sich nur über die RPCs aus 4.4.
- **Sperren** (`marketplace_bans`, nur Admin): Gesperrte können keine Anzeigen anlegen; eine Sperre mit `until` läuft ab.
- **Konto löschen:** private Anzeigen verschwinden mit dem Konto; Schul-Anzeigen bleiben, `created_by` wird leer.
- Neue Schul-Funktionen `shop` und `market_moderator` in einer eigenen Migration (0031), weil ein neuer Enum-Wert
  nicht in derselben Transaktion verwendet werden darf, die ihn anlegt. `market_moderator` wird erst in 4.8 genutzt.
- Volltext-Spalte `search_vector` (Konfiguration `simple`, weil Texte in DE/FR/EN gemischt sind) für die Suche in 4.5;
  `featured_until` ist für eine spätere Bezahlfunktion reserviert.
- Abweichung vom Plan: statt eines einzigen `seller_user_id` gibt es `seller_user_id` (nur privat, löscht mit dem
  Konto) **und** `created_by` (wer die Anzeige erfasst hat, wird beim Löschen leer). Sonst wären Schul-Anzeigen
  verschwunden, sobald die erfassende Person ihr Konto löscht.

**Auslieferung:** `node scripts/db-migrate.mjs --apply` (0031, 0032). Kein Frontend-Deploy nötig.

## Chats: Kanäle (Etappe 1)

Ein Kanal-Modell für alle Unterhaltungen (Migration `0025_chat_channels.sql`, Tests in
`src/test/chat-channels-database.test.ts`):

- **Gruppenkanäle** mit frei wählbarem Namen und Zielgruppe: alle Mitglieder, Team (Leitung, Instruktoren,
  Startleiter), Schüler (optional nur bestimmte Stufen) oder ausgewählte Personen. Die Mitgliedschaft wird zur
  Lesezeit aus der Zielgruppe berechnet (`chat_can_read`), niemand pflegt Listen. Jede Gruppe hat «Allgemein»,
  Schulen zusätzlich «Team». Anlegen/Verwalten: Admin, Schulleitung, Instruktoren (`is_group_staff`); sie sehen
  alle Kanäle ihrer Gruppe. Optional «Nur das Team schreibt», Archivieren (nur noch lesbar).
- **Terminkanal** automatisch pro Termin, nur für Angemeldete, das Team und die Termin-Crew.
- **Direktnachrichten** sind im Modell vorgesehen (Etappe 3).
- Ankündigungen mit Lesebestätigung in jedem Kanal; Push an alle Leser des Kanals. Anhänge unter
  `chat-attachments/channel/<kanal>/<user>/…`, geschützt wie der Kanal selbst.
- App: Bereich «Nachrichten» (`/messages`, Ungelesen-Zähler) – im Pilotenmodus oben auf Start/Feed, im Schulmodus
  in der unteren Leiste; Kanal im Vollbild (`/messages/:id`); Gruppe → Tab Chat zeigt ihre Kanäle; Schulmodus →
  «Kommunikation» mit Kanalverwaltung und Team-Umfragen; Termin → Tab Chat = Terminkanal.
- Übernahme: `group_messages` (Team-Nachrichten in «Team»), Lesebestätigungen und `event_messages` wurden
  kopiert. Alte App-Versionen schreiben weiter in die alten Tabellen; Trigger leiten das in die Kanäle weiter.
  Die alten Tabellen werden nach der Übergangszeit entfernt.

**Auslieferung:** zuerst `node scripts/db-migrate.mjs --apply` (0025), danach das Frontend.

## Betrieb ohne Lovable (Supabase Zürich + Vercel)

Seit dem 24.09.2026 läuft Flyary auf einem eigenen Supabase-Projekt `pvhxrgvhzzqcyadyksvk` (Region
eu-central-2, Zürich) und wird über Vercel (`flyaryapp.vercel.app`) aus `main` deployt. Lovable ist
komplett entfernt (Google-Login direkt über Supabase, keine Lovable-Pakete, keine `lovable.app`-Adressen).

- **Zugangsdaten** für Skripte stehen in `docs/.env.deploy.local` (git-ignoriert): `SUPABASE_ACCESS_TOKEN`,
  `SUPABASE_PROJECT_REF`, `APP_URL`, `VERCEL_TOKEN`, VAPID-Schlüssel, `XCONTEST_ENCRYPTION_KEY`.
- **Migrationen:** `node scripts/db-migrate.mjs` zeigt offene, `--apply` spielt sie ein (je eine Transaktion,
  Buchführung in `supabase_migrations.schema_migrations` bzw. `drizzle.__drizzle_migrations`). Übersprungen
  werden die Lovable-Testdaten `20260327072955` und `drizzle/0002` (durch `20260921113000` + `0004` abgedeckt).
- **Einmalige Einrichtung** eines Projekts: `node scripts/setup-new-project.mjs` (Migrationen, Vault-Secrets
  `project_url`/`push_internal_secret`, Function-Secrets, Edge Functions, Login-Adressen). Mehrfach ausführbar.
- `.env` enthält nur öffentliche Werte (Projekt-URL, Anon-Key) und wird von Vite beim Vercel-Build gelesen.
- Neustart ohne Altdaten: Gruppen, Events und Konten aus Lovable-Zeiten wurden nicht übernommen;
  neue Push-Schlüssel, daher Push in der App neu aktivieren.

## Performance: Feed, Event-Detail, Start

Die Datenbank ist von der Schweiz aus ~120 ms pro Anfrage entfernt (vermutlich US-Region). Teuer waren deshalb
lange Ketten nacheinander ausgeführter Anfragen, nicht die Datenmenge.

- **Feed:** ein RPC `feed_page(_cursor, _limit)` liefert eine fertig gemischte, nach Datum sortierte Seite (Flüge,
  Events, Errungenschaften inkl. Likes, Kommentare, Lesezeichen); danach ein paralleler Signierschritt pro Bucket
  (`src/lib/feed-page.ts`, getestet). Vorher 8–9 sequenzielle Schritte, ~25–30 Anfragen pro Seite. Die Paginierung
  ist jetzt serverseitig exakt; Events erscheinen chronologisch statt nur auf Seite 1.
- **Event-Detail:** RPC `event_detail_data(_event_id)` statt ~11 sequenzieller Anfragen.
- Beide RPCs sind `SECURITY INVOKER` (RLS wie bisher) und lesen aus `profiles` nur freigegebene Spalten.
- Neue Indizes auf Fremdschlüsseln (u. a. `group_members(user_id)`, das fast jede RLS-Policy prüft).
- Flug-Detail signiert alle Fotos in einer Anfrage statt einer pro Foto.
- Der Splash wartet nicht mehr auf die Dashboard-Daten (Dashboard zeigt eigenes Skeleton).
- Service-Worker-Cache nur noch für Datenbank-Lesezugriffe (keine Fotos/Videos/Auth), mit 3 s Timeout.

**Auslieferung:** zuerst `drizzle/migrations/0019_feed_and_event_read_models.sql` anwenden (rein additiv, das alte
Frontend läuft damit weiter), danach das Frontend deployen. Grösster verbleibender Hebel: Datenbank-Region Europa.

## Pre-Launch-Audit (vor dem Start mit Vertical)

Tiefenprüfung vor dem ersten Einsatz mit Schülerinnen und Schülern. Behobene Befunde:

- **Gesundheitsdaten lesbar für alle Gruppenmitglieder (kritisch).** Das spaltenweise
  `REVOKE SELECT (medical_notes, …)` aus Migration 20260417064846 wirkt in Postgres nicht,
  solange die Rolle das tabellenweite SELECT-Recht hat (Supabase-Standard). Migration
  `0018` entzieht das Tabellenrecht und vergibt nur noch die unkritischen Spalten.
  Profil und XContest-Sync lesen die eigenen privaten Felder über `get_own_profile_private()`;
  die SHV-Nummer wird im fremden Pilotenprofil nicht mehr angezeigt.
- **Push-Funktion ohne Zugriffsprüfung.** `send-push` akzeptierte beliebige `user_id` mit dem
  öffentlichen Anon-Key. Jetzt erlaubt: Service-Role-Key, eigener Test-Push, oder das
  gemeinsame Secret aus dem Datenbank-Trigger.
- **Push-Nachrichten wurden nie angezeigt.** Der Service Worker hatte keinen `push`-Handler;
  neu `public/push-sw.js` (öffnet nur App-interne Links).
- **Event löschen** löschte zuerst Anmeldungen, Chat und Tagesnotizen und scheiterte dann an
  verknüpften Flügen. Jetzt ein einziger Delete (Kaskaden in der DB), `flights.event_id`
  wird auf `NULL` gesetzt.
- **Warteliste:** Abmeldung einer Person auf der Warteliste liess die nächste über das
  Maximum nachrücken; die Feed-Abmeldung umging die Warteliste ganz (Row-Delete).
- **Feed-Paginierung** übersprang Flüge, sobald eine ältere Challenge-Errungenschaft auf der
  ersten Seite lag (`src/lib/feed-paging.ts`, getestet).
- **Offline-Sync** konnte denselben Flug doppelt hochladen (Parallelaufruf, verlorene Antwort);
  jetzt Sperre + Client-UUID als Primärschlüssel.
- **Flug-Zwischenstand** wurde bei jedem Öffnen gespeichert und Tage später samt altem Datum
  wiederhergestellt; jetzt nur nach Eingabe, max. 12 h, nie über einen IGC-Import.
- **Anmeldeschluss** endete um 02:00 des gewählten Tages (UTC); jetzt Ende des lokalen Tages.
  Event-Datum und Tagesansichten rechnen mit dem lokalen Kalendertag.
- **Konto löschen** entfernte Fotos/IGC/Videos in Unterordnern nicht (nDSG).
- **Token-Refresh** erzeugte ein neues `user`-Objekt und lud offene Formulare neu;
  **App-Updates** luden die Seite mitten in der Eingabe neu (jetzt Hinweis bzw. im Hintergrund).
- Dashboard-Cache wird nach Flug-Speichern, Offline-Sync und Anmeldungen invalidiert;
  3D-Karte und XLSX-Import (1,4 MB) werden nicht mehr beim Installieren vorab geladen.

**Auslieferung (Reihenfolge beachten):**
1. Secret erzeugen und doppelt hinterlegen: im SQL-Editor
   `select vault.create_secret('<zufälliger Wert>', 'push_internal_secret');` und als
   Edge-Function-Secret `PUSH_INTERNAL_SECRET` mit demselben Wert.
2. Migration `drizzle/migrations/0018_prelaunch_audit_fixes.sql` anwenden.
3. Edge Functions `send-push` und `delete-account` deployen, dann das Frontend.
   Ältere geöffnete Clients laden das Profil erst nach dem Update wieder korrekt.

## Schülerdossier

Die Schülerliste öffnet ein schulbezogenes Dossier unter
`/school/students/:groupId/:studentId` statt des öffentlichen Pilotenprofils.
Die bestehende Schülerauswahl samt Aktiv-/Alle-Filter bleibt erhalten.

- Übersicht: Schülerstatus mit Grund/Datum, Ausbildungsstand (bearbeitbar),
  SHV-Nummer, Prüfungsdaten, Prüfungsmanöver-Fortschritt, letzter Schulflug,
  nächster Lernschritt und nächste Anmeldungen inklusive Warteliste.
- Ausbildung: Kontrollblatt mit Bewertungen und Notizen, nach Ausbildungsstufe filterbar.
  Die Bewertungen sind keine formelle Prüfungsfreigabe.
- Flüge: alle mit dieser Schule geteilten Flüge, Kommentare und Coaching-Notizen,
  in Seiten zu 30 Einträgen nachladbar. Private Flüge und Flüge anderer Schulen
  werden nicht in das Dossier übernommen.
- Tagesnotizen: eigene chronologische Liste mit Verfasser, Sichtbarkeit,
  Flugslot, Tageszusammenfassung und nächsten Schritten; ebenfalls nachladbar.
  Die Slots F1–F6 werden nicht künstlich einzelnen Flugbucheinträgen zugeordnet.
- Material: Ausrüstungscheck, laufende und zurückgegebene Schulausleihen mit
  Rückgabe-/Prüfterminen sowie hinterlegte eigene Schirme und Materialangaben.
- Abrechnung: bestehende offene/bezahlte Abrechnungsposten der Person in dieser
  Schule, CHF-Summen und Zahlungsdatum. Formelle Rechnungen und Online-Zahlungen
  bleiben Teil der späteren Phase 4.

**Auslieferung:** Migration `drizzle/migrations/0017_student_dossier.sql` muss vor
diesem Frontend angewendet werden. Sie wurde am 23.09.2026 live in einer Transaktion
ausgerollt; Migrationseintrag, Funktionsrechte und beide SELECT-Policies wurden
verifiziert. Alle sechs Dossierbereiche wurden anschliessend mit einem bestehenden
Schulpersonal-/Schülerkontext unter der Rolle `authenticated` lesend geprüft.
Der PostgREST-Schema-Cache wurde zum Neuladen benachrichtigt.
Der Dossier-RPC prüft Schule, Mitgliedschaft und Schulpersonal serverseitig und
verwendet RLS. Neue SELECT-Policies erlauben Schulpersonal das Lesen des
Ausbildungsfortschritts und der Flug-Coaching-Notizen. Ein separat geschützter
Profil-RPC gibt ausschliesslich die benötigten Ausbildungs-/Identifikationsfelder
zurück; Gesundheitsdaten, Notfallkontakte und Zugangsdaten gehören nicht zur Antwort.
Die internen Dossier-Abfragen laufen per POST, ohne PWA-GET-Cache, und mit
konten-, schul- und schülerspezifischen Query-Keys.

**Prüfung:** 181 Tests, Produktionsbuild, TypeScript-Prüfung und ESLint der
neuen Dateien erfolgreich. Datenbanktests prüfen alle sechs Dossierbereiche,
die Paginierung sowie Ablehnung fremder Schulen, Schüler und Starthelfer.
UI-Tests prüfen den Einstieg aus der Schülerliste, Kontextbindung, Nachladen und
Fehler-/Wiederholungszustände. Ein manueller Durchlauf mit echten Schulkonten
steht vor der Veröffentlichung noch aus.

## UX-Fortsetzung: Rollen und Tagesabläufe

Die unterbrochene UX-Arbeit wurde am 22.09.2026 ergänzt: kontobezogener Rollen- und
Schulwechsel, eigene Schulnavigation, Team-Einstieg für Starthelfer, passende
Ausbildungsfilter und Coaching-Notizen mit geordnetem Autosave und Fehleranzeige.
Neue Texte sind in DE/FR/EN vorhanden. Vergangene Coaching-Tage zeigen weiterhin
auch inzwischen pausierte Schüler; bei aktuellen Teilnehmerlisten lassen sie sich
einblenden. Ausbildungsbewertungen haben getrennte, beschriftete Bedienelemente.

**Auslieferung:** Vor dem Frontend muss `drizzle/migrations/0016_role_journeys.sql`
nach Migration 0015 angewendet werden. Sie erlaubt dem Schulpersonal das Speichern
der Tagesnotizen, unterstützt die Tagespause und liefert inaktive Schüler-IDs.
Die Migration wurde lokal mit PostgreSQL/PGlite getestet und am 22.09.2026 auf der
Live-Datenbank nach Migration 0015 in einer Transaktion angewendet. Migrationseintrag,
Notiz-Policies, Tagespause-Prüfregel und Funktionsrechte wurden anschliessend geprüft;
der PostgREST-Schema-Cache wurde zum Neuladen benachrichtigt.

**Prüfung:** 172 Tests erfolgreich, einschliesslich Autosave bei Folgeänderungen und
Fehlern, Ausbildungsfiltern, Übersetzungsschlüsseln und SQL-Zugriffsregeln.
TypeScript-Prüfung und Produktionsbuild erfolgreich. Der globale ESLint-Lauf ist
wegen zahlreicher Meldungen im Repository (überwiegend `no-explicit-any`) nicht grün.
Ein manueller Durchlauf mit echten Pilot-, Fluglehrer- und Starthelferkonten steht aus.
Fehlgeschlagene Notizentwürfe bleiben während der Sitzung im Arbeitsspeicher;
sie überstehen keinen Browser-Neustart. Bei offenen Änderungen warnt der Browser
beim Verlassen, soweit die Plattform dies unterstützt.

## Performance-Optimierungen

Messwerte, Prüfungen und Auslieferungsreihenfolge stehen in [docs/performance.md](docs/performance.md).
Vor dem aktualisierten Frontend muss die Migration `drizzle/migrations/0015_performance_read_models.sql` angewendet werden.

## App-weiter Audit nach Phase 5: i18n-Lücken und ein echter Berechtigungsfehler

Auf Wunsch des Nutzers, sicherzustellen dass „keine Bugs/Mismatches mehr“ in der App vorhanden
sind. Echtes Rollen-Testing im Browser war in dieser Umgebung nicht möglich (kein lauffähiges
Playwright-Setup, keine Testaccounts, `.env` zeigt auf eine echte Live-Supabase-Instanz – Schreiben
von Testdaten dorthin ohne Rückfrage wäre riskant gewesen). Stattdessen: Production-Build,
vollständiger Testlauf, i18n-Vollständigkeitsabgleich und ein gezielter Abgleich aller
`is_group_admin`-geschützten Tabellen gegen ihre UI-Gates (dieselbe Fehlerklasse, die bereits in
den Phasen-Audits mehrfach echte Bugs gefunden hat).

**i18n:** 8 Übersetzungslücken über drei Locales gefunden und geschlossen, keine davon durch diese
Session verursacht (teils seit der ursprünglichen Baseline vorhanden). Am gravierendsten: `de.json`
fehlten fast alle Texte des globalen [NotificationBell.tsx](src/components/NotificationBell.tsx)
(Titel, Leerzustand, Aktivitätstexte) – sichtbar für **jeden** Nutzer, nicht nur Flugschul-Rollen.
Ausserdem fehlten `goals.*`/`follows.*` komplett in `en`/`fr` und `training.grundkurs`/
`brevetkurs`/`siku`/`pilot` in `en`/`fr`. Alle drei Locale-Dateien sind jetzt exakt deckungsgleich
(1449 Schlüssel je Datei, per Skript verifiziert).

**Echter Berechtigungsfehler:** [SchoolPeople.tsx](src/components/school/SchoolPeople.tsx) zeigte
den „Funktionen zuweisen“-Button und die Funktions-Checkboxen im Bearbeiten-Dialog für jeden
Betrachter der Seite, weil [SchoolDashboard.tsx](src/pages/SchoolDashboard.tsx) `canManage` hart
auf `true` setzte – aber `group_member_functions` ist per RLS **admin-only**
(`is_group_admin`), nicht `is_group_staff` wie der Rest der Seite. Ein Fluglehrer oder Schulleiter
ohne Admin-Rolle sah damit Bedienelemente für eine Aktion, die serverseitig abgelehnt wird.
Schlimmer: `saveEdit()` prüfte den `error` der `insert`/`delete`-Aufrufe auf
`group_member_functions` gar nicht, sodass trotz abgelehnter Schreibung ein „Gespeichert“-Toast
erschien – ein „false success“, nicht nur eine überflüssig sichtbare Bedienoberfläche. Behoben
durch einen neuen, aus `group_members.role` abgeleiteten `isAdmin`-Prop für die Funktions-UI
(statt Hardcode) sowie explizite Fehlerprüfung in `saveEdit()` als zusätzliche Absicherung.
Ausbildungsstufen-Bearbeitung (RLS: `is_group_staff`) bleibt für alle Team-Rollen unverändert
verfügbar – nur die admin-only Funktionszuweisung wurde eingeschränkt.

Übrige stichprobenartig geprüfte `is_group_admin`-Policies (Event-Bearbeitung/-Löschung,
`flight_coach_notes`, `incident_reports`-Löschung, `challenge_goals`) waren bereits korrekt
gegen den jeweiligen UI-Zugriffspunkt abgeglichen – keine weiteren Funde.

## Fluggebiets-Wetter-Matching (Planung 7.3)

**Abweichung vom Plan (mit Nutzer abgeklärt):** Die im Akzeptanzkriterium referenzierte
"bestehende Windy-Einbindung" ist tatsächlich nur ein reines Bild-Iframe
(`embed.windy.com/embed2.html`, siehe [LocationDetail.tsx](src/pages/LocationDetail.tsx)) ohne
jeden JS-lesbaren Datenzugriff – dagegen lässt sich nichts programmatisch "abgleichen". Eine
echte Windy-API bräuchte einen kostenpflichtigen API-Key, den es nicht gibt. Auf Rückfrage hat
der Nutzer entschieden, stattdessen [Open-Meteo](https://api.open-meteo.com) zu verwenden
(kostenlos, kein API-Key, CORS-fähig, direkt vom Client aufrufbar). Das erfüllt den Grundsatz
"keine Speicherung von Wetterdaten" sogar wörtlicher als eine echte Windy-Anbindung: Der
abgerufene Wert lebt nur ephemer im Komponentenstand von `LocationDetail.tsx`, nirgends in der
Datenbank.

Neue Spalte `locations.optimal_wind_directions text[]` (8-Punkte-Kompass N/NE/E/SE/S/SW/W/NW),
editierbar in [Locations.tsx](src/pages/Locations.tsx) als Toggle-Buttons im Bearbeiten-Dialog.
Ampel-Anzeige (passend/grenzwertig/ungeeignet) nur auf der Ortsdetailseite, nicht auf der
separaten allgemeinen Wetterkarte ([Weather.tsx](src/pages/Weather.tsx)) – letztere zeigt keinen
einzelnen Ort mit hinterlegten optimalen Windrichtungen, ein Abgleich ohne Ortsbezug wäre nicht
sinnvoll möglich. `shv_approved`/`wind_sock`/`usage_permission_ref` aus der ursprünglichen
§3-Datenmodell-Zeile gehören zu anderen, noch nicht beauftragten Akzeptanzkriterien und wurden
nicht mitgebaut.

Kompass-Rundung, Match/Grenzwertig/Ungeeignet-Logik und das Parsen der Open-Meteo-Antwort in
[wind-match.ts](src/lib/wind-match.ts) extrahiert und getestet.

## Flugschule: Auslastung, Erfolgsquote, SHV-Mindestleistungs-Ampel (Planung 11.1, 11.2)

Phase 4 (Administration und Zahlung) ist bewusst zurückgestellt bis nach dem Workshop mit
Vertical; Phase 5 (Reporting und Wetter-Integration) wurde vorgezogen. Dies ist der erste Teil
davon (11.1, 11.2); 7.3 (Fluggebiets-Wetter-Matching) folgt separat.

**11.1 Auslastung und Erfolgsquote:** Erweitert die bestehende Statistiken-Kachel
[SchoolStats.tsx](src/components/school/SchoolStats.tsx) um zwei neue Ranglisten (Auslastung pro
Kursart, betreute Schüler pro Fluglehrer – beide jahresfilterbar wie die bestehenden Kennzahlen)
und eine separat beschriftete Kachelgruppe „Ausbildungserfolg (gesamt)“.

**Abweichung vom Plan:** Erfolgsquote und Ausbildungsdauer sind bewusst *nicht* durch die
Jahresauswahl gefiltert – eine Ausbildung dauert typischerweise mehrere Jahre, eine
„Erfolgsquote 2025“ allein wäre nicht aussagekräftig. Stattdessen ein Gesamt-Kennwert über alle
Schüler der Schule, im UI klar so beschriftet (Hinweistext unter der Kachel). Datenquelle ist
`training_level_history` statt der im Plan vorgeschlagenen `training_progress` (Letzteres ist
eine reine Manöver-Bewertungstabelle pro Übungspunkt aus dem Kontrollblatt, keine
Stufenhistorie – dieselbe Begründung wie bereits beim SHV-Jahresbericht, Planung 4.4).
„Grundkurs → Brevet“ wird vokabular-agnostisch berechnet (frühester Historieneintrag bis
`licensed`), da `training_level`-Vokabulare zwischen Gruppen differieren (siehe Umsetzungsplan
Abschnitt 14). Abgebrochene Ausbildungen (`student_status_history`, Status „cancelled“) werden
aus dem Nenner der Erfolgsquote entfernt statt als Misserfolg gezählt, wie im
Akzeptanzkriterium gefordert. Der im Akzeptanzkriterium erwähnte „Vorjahresvergleich wie bei den
bestehenden Schulstatistiken“ wurde nicht umgesetzt: Die referenzierte bestehende Kachel bietet
selbst nur einen Jahres-Select ohne Delta-Anzeige zum Vorjahr – es existiert kein wiederverwendbares
Muster dafür.

**11.2 SHV-Mindestleistungs-Ampel:** Neue Ampel-Karte in
[SchoolOverview.tsx](src/components/school/SchoolOverview.tsx) (Flugschul-Übersicht), ebenfalls
über `training_level_history` berechnet. Schwellen: ≥3 Brevetierte in den letzten 3 Jahren =
grün, 1–2 = gelb, 0 = rot.

Aggregationslogik (Auslastung pro Kategorie, Schüler pro Fluglehrer, Erfolgsquote,
Ausbildungsdauer) in [school-performance.ts](src/lib/school-performance.ts), Ampel-Logik in
[annual-report.ts](src/lib/annual-report.ts) (dort bereits die verwandte
`licensedCompletionsInYear`-Funktion aus 4.4), beide getestet.

## Empfänger-Übersicht Lesebestätigung: zu enge UI-Sichtbarkeit behoben (Nachtrag zu Planung 8.4)

Bei der Akzeptanzkriterien-Prüfung von Phase 3 aufgefallen: Die „X von Y bestätigt“-Übersicht in
[GroupChat.tsx](src/components/GroupChat.tsx) war hinter dem `canAnnounce`-Prop versteckt. Dieser
Prop wird von aufrufenden Seiten uneinheitlich gesetzt – `SchoolDashboard.tsx` übergibt immer
`true`, der reguläre Gruppenchat in `GroupDetail.tsx` dagegen nur `isAdmin`. Normale Mitglieder
im regulären Gruppenchat sahen die Übersicht dadurch nie, obwohl weder die RLS-Policy auf
`announcement_read_receipts` noch das Akzeptanzkriterium das verlangen – dokumentiert war sogar
explizit das Gegenteil. Behoben durch Entfernen der `canAnnounce`-Bedingung für die Übersicht;
der „Kenntnis bestätigen“-Button war davon nicht betroffen (war nie hinter `canAnnounce`
versteckt).

## Flugschule: Team-Verfügbarkeitsumfrage (Planung 8.5)

Neue Tabellen `team_polls`/`team_poll_responses`, sichtbar im Team-Kanal (Planung 6.3), umgesetzt
in [TeamPolls.tsx](src/components/school/TeamPolls.tsx), gerendert oberhalb des Team-Kanal-Chats
im „teamChat“-Bereich von [SchoolDashboard.tsx](src/pages/SchoolDashboard.tsx).

**Abweichung vom Plan:** Antwortoptionen sind ein freies, kommagetrenntes `text[]`-Feld (Default
„Ja, Nein“) statt eines fixen Ja/Nein-Enums – das Akzeptanzkriterium spricht im Plural von
„Antwortoptionen“, Ja/Nein im Ziel ist nur das Beispiel, nicht die einzige zulässige Form.
Erstellen/Löschen einer Umfrage bleibt Team-Personal im engeren Sinn vorbehalten
(`is_group_staff`, wie bei Ankündigungen in 8.4), Abstimmen ist allen Team-Kanal-Mitgliedern
möglich (`is_group_team_member`, schliesst Startleiter mit ein). Der Empfänger-Kreis für die
Antwort-Übersicht wird – wie in [GroupChat.tsx](src/components/GroupChat.tsx) für 8.4 – client-
seitig aus Admins plus Team-Funktionen (`school_lead`/`instructor`/`launch_helper`) bestimmt.

Zähl-/Abgleichslogik (Stimmen pro Option, eigene Antwort, Ablaufprüfung, Options-Parsing) in
[team-polls.ts](src/lib/team-polls.ts) extrahiert und getestet.

## Flugschule: Lesebestätigung sicherheitsrelevanter Ankündigungen (Planung 8.4)

Erweitert die bestehende Ankündigungsfunktion in [GroupChat.tsx](src/components/GroupChat.tsx)
(`group_messages.is_announcement`, siehe Planung 6.3) statt eine neue Mitteilungs-Struktur zu
bauen: eine neue Spalte `requires_confirmation` und eine neue Tabelle
`announcement_read_receipts` (`message_id`, `user_id`, `confirmed_at`, `UNIQUE(message_id,
user_id)`). Gilt sowohl für den normalen Gruppenkanal als auch den Team-Kanal
(`is_team_only`).

**Abweichung vom Plan:** Die Empfänger-Übersicht ("gelesen/bestätigt vs. ausstehend") ist als
einzelne, aktive Bestätigungs-Aktion umgesetzt ("Kenntnis bestätigen"-Button), nicht als
automatisches Lese-Tracking beim blossen Anzeigen der Nachricht – ein Tap beweist tatsächliche
Kenntnisnahme, ein reines Rendern der Nachricht im DOM nicht (Zweck des Features laut Ziel:
"Nachweis, dass … tatsächlich angekommen ist"). Der Empfänger-Kreis für die Zähler ("X von Y
bestätigt") wird analog zu `is_group_team_member` clientseitig bestimmt: alle Gruppenmitglieder
im normalen Kanal, nur Admins + Team-Funktionen (`school_lead`/`instructor`/`launch_helper`) im
Team-Kanal. Anders als beim Notfall-Zugriffsprotokoll (Planung 12.3) ist die Empfänger-Übersicht
für **alle** Gruppenmitglieder sichtbar, nicht nur die Schulleitung – "wer hat gelesen" ist hier
der Zweck des Features selbst, keine schützenswerte Information.

Zähl-/Abgleichslogik (bestätigt vs. ausstehend, Duplikat-Erkennung) in
[announcement-receipts.ts](src/lib/announcement-receipts.ts) extrahiert und getestet.

## Flugschule: Notfall-Schnellzugriff & Zugriffsprotokollierung (Planung 8.3, 12.3)

Naiver Ansatz (Client liest Notfallfelder aus `profiles`, Log wird separat geschrieben) scheitert:
Migration `20260417064846` sperrt `blood_type`, `medical_notes`, `allergies`,
`emergency_contact_name`, `emergency_contact_phone` per `REVOKE SELECT` auf Spaltenebene für
`authenticated`/`anon` – die breite zeilenbasierte Policy "Group members can view profiles"
greift dafür nicht mehr. Stattdessen eine neue SECURITY-DEFINER-Funktion
`get_emergency_contact_info(_event_id, _target_user_id)`, die Berechtigung prüft (Team-Personal
der Termin-Gruppe via `is_group_staff`, Zielperson muss für den Termin angemeldet sein), die
Felder liest und den Zugriff protokolliert – alles in einem serverseitigen Schritt, damit keine
Lücke zwischen Lesen und Protokollieren entstehen kann (8.3 und 12.3 wurden deshalb als ein
Feature umgesetzt, wie im Plan selbst als "verknüpft" vermerkt).

`blood_type`/`allergies`/`medical_notes` werden nur zurückgegeben, wenn die betroffene Person die
bestehende Gesundheitsdaten-Einwilligung (`health_data_consent_at`, siehe
[Profile.tsx](src/pages/Profile.tsx)) erteilt hat. Notfallkontakt (Name/Telefon) ist davon
unabhängig, da er im Ernstfall unverzichtbar ist und keine Gesundheitsdaten im engeren Sinn sind.

Das Zugriffsprotokoll (`emergency_data_access_log`) trägt eine eigene `group_id`-Spalte statt sich
nur auf `context_event_id` abzustützen, damit die Sichtbarkeits-Policy ("nur für Schulleitung",
Akzeptanzkriterium aus 12.3) auch dann stabil bleibt, wenn ein Termin später gelöscht wird
(`context_event_id` ist deshalb `ON DELETE SET NULL`, nicht `CASCADE`). "Schulleitung" ist
`is_group_admin` oder die Funktion `school_lead`, ohne `instructor`/`launch_helper` – enger als
`is_group_staff`, das für den Zugriff selbst genügt.

UI: neuer Notfall-Button (Siren-Icon) direkt in der Teilnehmerliste
([EventDetail.tsx](src/pages/EventDetail.tsx)), sichtbar für alle Team-Rollen (nicht nur bei
Flugschul-Gruppen, da `isStaff` gruppenunabhängig berechnet wird), öffnet einen Dialog statt
mehrerer Menüs. Auswertungslogik (Konsens-/Datenverfügbarkeits-Prüfung, Fehler-Mapping der
RPC-Exceptions) in [emergency-access.ts](src/lib/emergency-access.ts) extrahiert und getestet.

## Flugschule: CSV-Export mit Pausierungs-Status (Nachtrag zu Planung 5.2)

Der CSV-Export der Personenübersicht enthielt Status, Grund und Datum der letzten Statusänderung
nicht (nur Name, Stufe, Flüge, Prüfungsfortschritt, letzte Zusammenfassung) – bei der
Akzeptanzkriterien-Prüfung von Phase 2 als Lücke fürs Reporting aufgefallen. Drei Spalten
ergänzt (Status, Grund, Status seit); der Status wird übersetzt ausgegeben, Grund/Datum bleiben
bei aktiven Schülern ohne erfasste Änderung leer statt "aktiv" ohne weitere Angaben vorzutäuschen.
Der Export bleibt bewusst ungefiltert (exportiert immer alle Schüler unabhängig vom
Bildschirmfilter, siehe Abschnitt 5.2 oben). CSV-Aufbau und -Escaping nach
[student-csv.ts](src/lib/student-csv.ts) extrahiert und getestet.

## Flugschule: Strukturierter Geh/Nogo-Entscheid (Planung 7.1)

Neue, eigenständige Tabelle `event_weather_decisions` statt Erweiterung von
`flight_events.status`: dessen Enum `event_status` (`announced`/`confirmed`/`cancelled`) wird
app-weit für alle Gruppentypen verwendet, nicht nur Flugschulen, an vielen Stellen ausserhalb
dieses Features. Einen vierten Wert ("wetterabhängig") dort einzuführen, hätte jede bestehende
`status === 'confirmed'`/`'cancelled'`-Prüfung im ganzen Code auf Vollständigkeit prüfen müssen.
Bei den beiden Statuswerten, die eine Entsprechung in `event_status` haben (bestätigt/abgesagt),
wird `flight_events.status` beim Speichern synchron mitgesetzt, damit bestehende Logik – allen
voran [Abschnitt 7.2](src/components/school/AlternativeDateSuggestion.tsx), das exakt auf
`status === 'cancelled'` reagiert – unverändert weiterfunktioniert. "Wetterabhängig" hat keine
Entsprechung und bleibt ohne Sync.

Der Statuswechsel löst automatisch eine Push-Benachrichtigung an alle angemeldeten Teilnehmenden
aus – Wiederverwendung der bestehenden `notify-event-participants`-Edge-Function (Kapitel 10, bereits genutzt von
[EventAnnounceDialog.tsx](src/components/EventAnnounceDialog.tsx)), nicht neu gebaut. Die
Benachrichtigung feuert nur bei einer tatsächlichen Statusänderung, nicht bei jeder Bearbeitung
von Frist oder Notiz (sonst hätte jede kleine Korrektur unnötig erneut alle Teilnehmenden per
Push gestört).

Die "Erinnerung an die Deadline" ist als In-App-Hinweis umgesetzt (rot markiert, sobald die
Frist verstrichen ist und noch kein Entscheid erfasst wurde), nicht als automatischer
Erinnerungs-Push zu einem festen Zeitpunkt vor der Frist – dafür bräuchte es eine
serverseitige Zeitplanung (z. B. `pg_cron`), die in diesem Projekt noch nicht existiert und den
Rahmen dieses Einzelfeatures sprengen würde.

## Flugschule: Interner Team-Kanal (Planung 6.3)

Der Plan schlägt eine dedizierte "Team"-Gruppe pro Schule vor (Wiederverwendung von
`group_messages`, keine neue Tabelle). Eine echte zusätzliche `groups`-Zeile hätte aber
laufend synchronisierte Mitgliedschaft gebraucht und wäre in mehreren anderen Gruppenlisten der
App aufgetaucht (Gruppenübersicht, Termin-Erstellung, Schulauswahl im Flugschul-Bereich), die
alle nicht wissen, dass es sich um einen internen Hilfs-Datensatz handelt und ihn fälschlich als
normale, auswählbare Gruppe anzeigen würden. Stattdessen: `group_messages.is_team_only`, dessen
Sichtbarkeit live über `group_member_functions` geprüft wird (wie bei `is_group_staff`), ohne
Mitgliedschaft zu duplizieren. `group_messages` selbst bleibt wie im Plan gefordert unverändert
wiederverwendet – nur die Zugriffsregel kommt hinzu.

Zugriff hat, wer Schulleitung, Fluglehrer oder Starthelfer ist (`is_group_team_member`, bewusst
weiter gefasst als `is_group_staff`, das Starthelfer ausschliesst – der Plan nennt "Fluglehrern/
Startleitern" ausdrücklich als Zielgruppe). Der bestehende Ankündigungs-Push
([push_on_group_announcement](drizzle/migrations/0009_team_channel.sql)) wurde angepasst, damit
er bei `is_team_only` nur an Teamfunktionen zustellt statt – wie es die unveränderte
Originalfunktion getan hätte – den Nachrichtentext eines internen Team-Announcements per Push an
alle Schüler zu senden. Anhänge sind im Team-Kanal deaktiviert: Der Storage-Bucket für
Chat-Anhänge kennt nur Gruppenmitgliedschaft, nicht `is_team_only`, ein Schüler könnte bei
bekanntem Objektpfad sonst direkt auf Team-Anhänge zugreifen, auch ohne die zugehörige Nachricht
lesen zu können.

## Flugschule: Übergabenotizen zwischen Fluglehrern (Planung 6.2)

Der Plan nennt `flight_coach_notes.is_next_step` als Datenmodell – diese Tabelle ist aber die
allgemeine, gruppenunabhängige Flug-Coaching-Notiz (ein Eintrag pro geloggtem Flug, RLS über
Gruppen-Admin), nicht die Flugschul-spezifische Tagesnotiz. Diese existiert bereits als
`student_day_notes` (pro Termin und Schüler, inkl. Sichtbarkeits-Toggle für den Schüler und
Carry-over der Zusammenfassung vom letzten Flugtag in [CoachDayView.tsx](src/components/CoachDayView.tsx))
und ist schon Quelle der bisherigen "letzten Zusammenfassung" in der Schüler-Übersicht – die
naheliegendere Erweiterungsstelle, ausdrücklich im Sinne von Abschnitt 14 des Plans ("fachliches
Zielbild, keine verbindliche DDL"). `is_next_step` wurde daher dort ergänzt (Migration 0008).

Die Zusammenfassungs-Notiz eines Termins lässt sich als „Nächster Schritt" markieren (Icon-Toggle
neben dem bestehenden Sichtbarkeits-Toggle). In der kompakten Terminansicht von CoachDayView
erscheint dafür ein Indikator-Icon je Schüler, ohne die Karte öffnen zu müssen. In der
Personenübersicht ([SchoolStudents.tsx](src/components/school/SchoolStudents.tsx)) wird die
zuletzt markierte Notiz hervorgehoben angezeigt – ermittelt über das tatsächliche Datum des
zugehörigen Termins (nicht die Abfragereihenfolge, die bei Supabase ohne `ORDER BY` nicht
garantiert ist), damit bei mehreren markierten Notizen über die Zeit zuverlässig die aktuellste
erscheint. Frühere Notizen bleiben unverändert in `student_day_notes` erhalten (ein Eintrag pro
Termin), es wird nichts überschrieben.

## Kontrollblatt: Meilenstein-Freigaben (Planung 5.3)

Ausbildungskategorien können eine Voraussetzungs-Kategorie referenzieren
(`training_categories.unlocks_after_category_id`); ist diese nicht zu 100 % abgeschlossen,
zeigt das Kontrollblatt ([Training.tsx](src/pages/Training.tsx)) eine Kategorie mit einem
dezenten Schloss-Badge samt Name der Voraussetzung. Wie im Plan explizit gefordert ("kein
hartes Blockieren") verhindert das nichts: Sterne-Bewertung und Navigation in die
Übungsdetails bleiben für gesperrte Kategorien uneingeschränkt möglich – der Fluglehrer
behält die fachliche Entscheidungshoheit, es gibt daher auch keinen separaten
"Freigabe aufheben"-Mechanismus, weil nichts aufzuheben ist.

`training_categories` ist ein globales, schulübergreifendes Curriculum ohne `group_id` und
wird wie bisher direkt per Migration gepflegt, nicht über eine App-UI. Migration
`0007_training_category_prerequisites.sql` setzt dafür das im Plan genannte Beispiel:
Höhenflüge erst nach abgeschlossenem Übungshang.

## Flugschule: Ersatztermin-Vorschlag bei Absage (Planung 7.2)

Termine einer Flugschulgruppe mit Status "abgesagt" zeigen dem Team einen Vorschlag für bis zu
drei Ersatztage, basierend auf der Team-Verfügbarkeit aus Abschnitt 6.1: gesucht wird ab dem Tag
nach dem ursprünglichen Termin (nicht ab heute, damit auch rückwirkend abgesagte Termine sinnvolle
Vorschläge liefern) über bis zu drei Wochen vorwärts nach den nächsten Tagen, an denen mindestens
ein aktuelles Teammitglied (Schulleitung/Fluglehrer/Starthelfer) sich als verfügbar eingetragen
hat – nicht zwingend die nächsten drei Kalendertage in Folge, sondern die nächsten drei Tage mit
tatsächlicher Verfügbarkeit. Verfügbarkeits-Einträge von Personen, die keine dieser Funktionen
(mehr) haben, zählen nicht mit. Ein Klick auf einen Vorschlag übernimmt die bestehende
Duplikat-Funktion (`/events/new?duplicate=…`), jetzt erweitert um einen optionalen
`date`-Parameter, der das Terminformular mit dem gewählten Tag vorausfüllt statt das Datum leer
zu lassen.

## Flugschule: Pausierungs-Status (Planung 5.2)

Die Statusverwaltung (aktiv/pausiert/abgebrochen mit Grund und Datum) griff bereits auf eine
Tabelle `student_status_history` zu, die als Migration fehlte – jede Statusänderung landete
dadurch nur im Browser-localStorage (nicht geräte-/sitzungsübergreifend) statt in der Datenbank,
und ein "Grund" wurde nirgends erfasst (immer `null`, obwohl in der UI-Datenstruktur bereits
vorgesehen). Migration `0006_student_status_history.sql` ergänzt die Tabelle; die
localStorage-Umgehung entfällt zugunsten des im Projekt etablierten Musters: eine
Statusänderung erscheint erst nach bestätigter Speicherung, bei einem Fehler springt die
Anzeige auf den vorherigen Stand zurück und ein Toast informiert. Beim Ändern des Status fragt
ein Dialog neu nach einem optionalen Grund; Grund und Datum der letzten Änderung werden bei
pausierten/abgebrochenen Schülern in der Personenübersicht angezeigt.

Die Personenübersicht zeigt standardmässig nur aktive Schüler (Filter aktiv/alle, analog zum
bestehenden Muster im Material-Bereich); pausierte/abgebrochene bleiben über "Alle" weiterhin
erreichbar und damit im Kontrollblatt/Flugbuch nachvollziehbar, verschwinden aber aus der
Standardansicht der aktiven Terminplanung. Der CSV-Export bleibt bewusst ungefiltert (exportiert
immer alle Schüler unabhängig vom Bildschirmfilter).

## Flugschule: Verfügbarkeitsplanung Team (Planung 6.1)

Unter **Verfügbarkeit** trägt das Team (Schulleitung, Fluglehrer, Starthelfer) pro Tag eine
Wochenansicht mit drei Zuständen (verfügbar/unsicher/nicht verfügbar, optional mit Notiz) ein –
ein Klick auf den eigenen Status zykelt weiter, ein weiterer Klick über "nicht verfügbar" hinaus
löscht den Eintrag wieder. Da die Flugschul-Ansicht insgesamt nur für Schulleitung/Fluglehrer
erreichbar ist, kann von dort aus auch für andere Teammitglieder eingetragen werden (z. B. wenn
ein Starthelfer die Abwesenheit telefonisch durchgibt); serverseitig bleibt es über RLS
abgesichert (jede Person darf ohnehin nur ihre eigenen Einträge schreiben, Staff zusätzlich alle).

Bei der Termin-Einteilung ([EventStaff.tsx](src/components/EventStaff.tsx)) werden die
vorschlagbaren Personen nach Verfügbarkeit für das Termindatum sortiert (verfügbar zuerst) und
mit ihrem Status markiert – als Empfehlung, kein Blocker, da nicht jede Person ihre Verfügbarkeit
zwingend vorab einträgt. Ist bereits jemand eingeteilt, der sich für diesen Tag explizit als
nicht verfügbar gemeldet hat, erscheint dafür ein eigener Hinweis. Zusätzlich – kombiniert mit
Abschnitt 4.2 – warnt die Ansicht, wenn für ein Flugschul-Termin noch niemand eingeteilt ist und
keine als verfügbar gemeldete Person ein gültiges Fluglehrer-Zertifikat hat.

## Flugschule: Vorfallmeldung – Schnellzugriff & Materialfilter (Planung 4.1, 9.2)

Das Formular zur Unfall-/Vorfallmeldung ist aus [IncidentReports.tsx](src/components/school/IncidentReports.tsx)
in [IncidentReportDialog.tsx](src/components/school/IncidentReportDialog.tsx) ausgelagert und wird jetzt an zwei
Stellen verwendet: in der Sicherheits-Übersicht (Liste + Formular) und als eigenständiger
Schnellzugriff direkt im Termin (`EventDetail.tsx`), sichtbar für Schulleitung/Fluglehrer bei
Terminen einer Flugschulgruppe, unabhängig vom Terminstatus. Der Termin ist beim Öffnen aus dem
Termin heraus vorausgewählt, lässt sich aber weiterhin ändern oder auf „kein Termin" setzen.

In der Materialliste lässt sich zusätzlich nach dem SHV-Typengeprüft-Attribut filtern (alle /
nur typengeprüft / nur nicht typengeprüft), kombinierbar mit dem bestehenden Status-Filter.

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

## Datenbank-Migrationen

Die Schema-Historie ist auf zwei Ordner verteilt, weil Lovable die Art, wie Migrationen
geführt werden, unterwegs umgestellt hat:

- `supabase/migrations/` – die ursprüngliche Migrationsreihe. War lange historisch (bis ca. Mai
  2026), enthält aber inzwischen auch `20260921113000_flight_school_phase1.sql` – ein
  versehentliches Duplikat der Phase-1-Tabellen aus `drizzle/migrations/0002_...`, entstanden
  durch parallele Arbeit auf zwei Branches ohne Kenntnis voneinander. Siehe
  `drizzle/migrations/0004_reconcile_phase1_rls.sql` für den Hintergrund und die Bereinigung.
- `drizzle/migrations/` – die eigentlich vorgesehene neuere Migrationsreihe (ab Phase 1 der
  Flugschul-Erweiterungen, z. B. `0002_school_phase1_shv_compliance.sql`). `drizzle/schema.ts`
  ist absichtlich leer (`// auto-generated and intentionally left blank, do not edit`) – Drizzle
  wird hier nur als Migrations-Journal genutzt, nicht als ORM. Es gibt kein `drizzle-kit`-npm-Skript
  und keinen CI-Workflow, der eine der beiden Reihen automatisch anwendet; Lovable spielt
  Änderungen direkt gegen die produktive Datenbank ein.

Für einen Schema-Aufbau von Grund auf müssen **beide Ordner, in dieser Reihenfolge**, angewendet
werden: zuerst alle Dateien aus `supabase/migrations/`, danach alle aus `drizzle/migrations/`
(chronologisch nach Dateiname). Neue Migrationen ab Phase 1 der Flugschul-Erweiterungen gehören
in `drizzle/migrations/`.

### Bereinigung der doppelten Phase-1-Tabellen (`0004_reconcile_phase1_rls.sql`)

`20260921113000_flight_school_phase1.sql` (supabase) und `0002_school_phase1_shv_compliance.sql`
(drizzle) legen unabhängig voneinander dieselben fünf Tabellen an
(`incident_reports`, `instructor_certifications`, `equipment_maintenance`, `equipment_checks`,
`annual_report_submissions`), mit **unterschiedlichen RLS-Policies**. Welche der beiden zuerst
gegen die produktive Datenbank lief – und ob beide liefen – lässt sich aus dem Repo-Stand allein
nicht feststellen; es gibt keinen Zugriff auf eine Migrations-Tracking-Tabelle oder die DB selbst
im Rahmen dieser Arbeit.

Statt zu raten, macht `0004_reconcile_phase1_rls.sql` das Ergebnis unabhängig vom Ausgangszustand
eindeutig: Sie entfernt zuerst alle Policy-Namen, die aus beiden ursprünglichen Migrationen
stammen könnten (`DROP POLICY IF EXISTS`, dadurch idempotent), und legt danach einen einzigen,
definitiven Policy-Satz an. Zwei konkrete Abweichungen wurden dabei bewusst zugunsten der
strengeren/präziseren Variante aufgelöst:

- `incident_reports`: Löschen ist nur Admins vorbehalten, nicht jedem Staff-Mitglied (die
  supabase-Migration hatte hier eine pauschale Staff-Policy für alle Operationen).
- `instructor_certifications` und `equipment_checks`: Die betroffene Person kann ihre eigenen
  Zeilen lesen (z. B. liest [StudentEquipmentHint.tsx](src/components/school/StudentEquipmentHint.tsx)
  `equipment_checks` als der angemeldete Schüler selbst). War nur die supabase-Migration aktiv,
  gab es diese Selbstlese-Policy nicht – der Ausrüstungs-Hinweis hätte dann für Schüler dauerhaft
  "fehlend" angezeigt, unabhängig vom tatsächlichen Stand.

Die beiden ursprünglichen Migrationsdateien bleiben unverändert als historischer Beleg stehen;
nur `0004` verändert das tatsächliche Verhalten.
