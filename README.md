# Flyary

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
