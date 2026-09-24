# Umsetzungsplan: Marktplatz für Flyary

2026-09-24 · Tobias Bolliger · Stand: M1 in Arbeit (siehe Status)

Dieses Dokument beschreibt einen Marktplatz für gebrauchtes und neues Gleitschirm-Material in Flyary: Pilotinnen und Piloten verkaufen ihr altes Material oder suchen günstige Occasionen, Flugschulen verkaufen Material aus ihrem Shop. Es ist wie der Umsetzungsplan für die Flugschul-Erweiterungen aufgebaut: Jeder Unterabschnitt ist ein eigener Auftrag an den Coding-Agenten, mit Ziel, Akzeptanzkriterien, Datenmodell und Platz in der Navigation.

## Status

| Stufe | Status | Bemerkung |
| --- | --- | --- |
| M1 – Grundfunktion (MVP) | 🔶 In Arbeit | 4.1–4.5 ✅; inkl. Schul-Shop mit Neuware und Moderation |
| M2 – Wiederkommen | ⬜ Nicht begonnen | Merkliste, gespeicherte Suchen, Vorausfüllen aus dem eigenen Material |
| M3 – Schulen im Alltag | ⬜ Nicht begonnen | Occasion aus dem Materialbestand, Verkauf auf die Abrechnung |
| M4 – Später / optional | ⏸ Zurückgestellt | Bewertungen, Diebstahl-Abgleich, kostenpflichtige Zusatzfunktionen, öffentlicher Teilen-Link, Zahlung in der App |

## 1. Grundsatzentscheide

Diese Entscheide sind gefällt (2026-09-24) und gelten für alle Stufen:

| # | Frage | Entscheid | Folge für die Umsetzung |
| --- | --- | --- | --- |
| E1 | Modell | **Kleinanzeigen** (wie Tutti, Facebook Marketplace): Kauf und Zahlung laufen direkt zwischen den Parteien | Keine Zahlung, kein Käuferschutz, kein Versand in der App. Keine Abhängigkeit von Phase 4 des Flugschul-Plans |
| E2 | Wer sieht Anzeigen? | **Alle angemeldeten Flyary-Nutzer** | Privatanzeigen sind immer für alle sichtbar. Nur Schulen können Angebote auf ihre eigenen Schüler beschränken |
| E3 | Öffentlicher Teilen-Link für Nicht-Nutzer | **Zurückgestellt** (M4) | Foto-Bucket bleibt privat, Zugriff über signierte URLs |
| E4 | Neuware von Schulen | **Schon in M1** | Schul-Shop mit gewerblichen Pflichtangaben gehört in M1 (Abschnitt 4.7) |
| E5 | Moderation | **Admin plus Moderatoren aus Schulen, die selbst einen Shop betreiben** | Meldungen zu **Schul-Anzeigen gehen nur an den Admin** (kein Moderieren unter Konkurrenten) |
| E6 | Kosten | **Vorerst gratis**, später kostenpflichtige Zusatzfunktionen | Felder für Hervorheben/Hochschieben schon im Modell, aber ohne Bezahlung |
| E7 | Infrastruktur | **Supabase Free-Plan bleibt** (Testphase, wenig Verkehr) | Enges Speicherbudget, Vorschaubilder, automatisches Aufräumen, Überwachung (Abschnitt 5) |

## 2. Stufenplan

| Stufe | Fokus | Enthaltene Features | Aufwand | Status |
| --- | --- | --- | --- | --- |
| M1 | Grundfunktion | 4.1–4.10 | L | 🔶 |
| M2 | Wiederkommen | 6.1–6.4 | M | ⬜ |
| M3 | Schulen im Alltag | 7.1–7.2 | M | ⬜ |
| M4 | Später / optional | 8.1–8.5 | L | ⏸ |

Reihenfolge innerhalb von M1: 4.1 → 4.2 → 4.3 → 4.4 → 4.5 → 4.6 → 4.7 → 4.8 → 4.9 → 4.10. Das Datenmodell und die Kategorien kommen zuerst, weil alle weiteren Features darauf aufbauen. Der Chat (4.6) folgt erst, wenn es Anzeigen zum Anschauen gibt.

## 3. Datenmodell

Logisches Zielbild. Vor der Umsetzung gegen das echte Schema abgleichen (siehe Flugschul-Plan, Abschnitt 14). Migrationen gehören in `drizzle/migrations/` (fortlaufend ab `0031_…`).

| Tabelle | Zweck | Wichtige Felder | Feature |
| --- | --- | --- | --- |
| `marketplace_listings` | Anzeige (Angebot oder Suche) | `seller_user_id`, `seller_group_id` (nullable, gesetzt = Schul-Anzeige), `listing_type` (`offer`/`wanted`), `category`, `title`, `description`, `price_cents` (CHF in Rappen), `price_type` (`fixed`/`negotiable`/`free`/`on_request`), `condition` (`new`/`like_new`/`used`/`for_parts`), `manufacturer`, `model`, `size`, `year`, `attributes jsonb`, `quantity` (nur Schul-Neuware), `postal_code`, `locality`, `canton`, `delivery` (`pickup`/`shipping`/`both`), `visibility` (`all`/`school_students`), `status` (`draft`/`active`/`reserved`/`sold`/`expired`/`removed`), `removed_reason`, `expires_at`, `bumped_at`, `featured_until` (für spätere Bezahlfunktion, vorerst immer leer), `search_vector` | 4.1 |
| `marketplace_listing_photos` | Fotos pro Anzeige | `listing_id`, `path`, `thumb_path`, `position` | 4.3 |
| `school_shop_profiles` | Gewerbliche Pflichtangaben einer Schule | `group_id` (PK), `legal_name`, `street`, `postal_code`, `locality`, `uid_number` (nullable), `vat_registered`, `email`, `phone`, `warranty_text`, `active` | 4.7 |
| `chat_channels` (erweitert) | Chat zu einer Anzeige | + `kind = 'listing'`, `listing_id`, `buyer_id`; eindeutig pro (`listing_id`, `buyer_id`) | 4.6 |
| `marketplace_reports` | Meldungen | `listing_id`, `reporter_id`, `reason`, `note`, `status` (`open`/`dismissed`/`actioned`), `handled_by`, `handled_at`, `handled_note` | 4.8 |
| `marketplace_moderation_log` | Nachvollziehbarkeit jeder Moderationshandlung | `listing_id`, `actor_id`, `action`, `reason`, `created_at` | 4.8 |
| `marketplace_bans` | Vom Marktplatz gesperrte Personen (nur Admin) | `user_id`, `until`, `reason`, `created_by` | 4.8 |
| `group_function` (Enum erweitert) | Schul-Rollen für den Shop | + `shop` (darf für die Schule inserieren und Chats beantworten), + `market_moderator` | 4.7, 4.8 |
| `marketplace_favorites` | Merkliste | `user_id`, `listing_id` | 6.1 |
| `marketplace_saved_searches` | Gespeicherte Suchen mit Push | `user_id`, `filters jsonb`, `notify`, `last_notified_at` | 6.2 |

**Hinweis zum Enum:** `ALTER TYPE … ADD VALUE` darf in Postgres nicht im gleichen Transaktionsblock verwendet werden, in dem der neue Wert schon benutzt wird. Darum kommen die neuen `group_function`-Werte in eine eigene, vorgelagerte Migration.

**Statuswechsel** laufen nur über RPCs (`marketplace_publish`, `_reserve`, `_mark_sold`, `_renew`, `_bump`, `_remove`), nicht über freies UPDATE. Das ist das bewährte Muster aus `0024_set_event_status.sql`. So lassen sich Grenzen (Abschnitt 4.4) und Protokoll serverseitig durchsetzen.

## 4. M1 – Grundfunktion

### 4.1 Datenmodell und Zugriffsregeln für Anzeigen ✅

**Ziel:** Tabelle `marketplace_listings` mit sauberen Zugriffsregeln als Grundlage für alles Weitere.

**Akzeptanzkriterien:**

- Lesen: Anzeigen mit Status `active` oder `reserved` und `visibility = 'all'` sind für alle angemeldeten Personen sichtbar. `school_students` nur für Mitglieder der verkaufenden Schule. Entwürfe, abgelaufene, verkaufte und entfernte Anzeigen sieht nur, wer sie besitzt (Privatperson bzw. Schulteam mit Funktion `shop` oder `school_lead`), plus Moderation
- Schreiben: Privatanzeigen nur die Besitzerin bzw. der Besitzer. Schul-Anzeigen nur Teammitglieder mit Funktion `shop` oder `school_lead`
- `visibility = 'school_students'` ist nur bei Schul-Anzeigen erlaubt (CHECK-Constraint)
- Nicht angemeldete Personen sehen nichts
- Gesperrte Personen (`marketplace_bans`) können keine Anzeigen veröffentlichen
- RLS-Test mit mindestens drei Rollen: fremde Person, Besitzer, Schulteam einer anderen Schule

**Datenmodell:** `marketplace_listings` (Abschnitt 3)

**Ist-Stand:** Migrationen `0031_marketplace_group_functions.sql` (neue Funktionen `shop`, `market_moderator`) und `0032_marketplace_listings.sql` (`marketplace_listings`, `marketplace_bans`, Hilfsfunktionen `market_can_manage`, `is_market_staff`, `is_market_banned`). Neue Anzeigen starten immer als `draft`; Clients dürfen nur die Inhaltsspalten ändern (spaltenweises `GRANT UPDATE`), Status und Datumsfelder folgen mit den RPCs in 4.4. **Abweichung:** `seller_user_id` ist nur bei Privatanzeigen gesetzt (löscht mit dem Konto), bei Schul-Anzeigen leer; zusätzlich `created_by` (beim Löschen des Kontos leer), damit Schul-Anzeigen erhalten bleiben, wenn die erfassende Person geht. Moderation liest in 4.1 nur global (`app_role`); Schul-Moderatoren folgen in 4.8. RLS-Tests in `src/test/marketplace-database.test.ts` (Besitzer, fremde Person, Schul-Admin, Shop, Instruktor, Schüler, Shop einer fremden Schule, Moderator, Admin, Gesperrte, nicht angemeldet).

### 4.2 Kategorien, Merkmale und Sicherheitshinweise ✅

**Ziel:** Jede Kategorie hat ihre fachlich passenden Felder und zeigt Sicherheitshinweise an, ohne etwas zu blockieren.

**Kategorien und Merkmale (in `attributes`):**

| Kategorie | Merkmale |
| --- | --- |
| Schirm (Solo) | Gewichtsbereich von/bis, EN/LTF-Klasse, Flugstunden (Angabe des Verkäufers), letzte Nachprüfung (Datum), Porosität, Reparaturen |
| Tandemschirm | wie Schirm, dazu Tandem-Zulassung |
| Gurtzeug | Typ (Sitz, Liege, Wendegurtzeug, Tandem), Protektor, Retterfach |
| Retter | Typ (Rund, Rogallo, Kreuzkappe), max. Anhängelast, letztes Packdatum |
| Instrumente | Art (Vario, GPS, Funk, Kombi) |
| Helm | Norm (z. B. EN 966) |
| Bekleidung und Zubehör | Grösse |
| Sonstiges | keine Zusatzfelder |

**Akzeptanzkriterien:**

- Schema pro Kategorie in `src/lib/marketplace-categories.ts` (Pflichtfelder, erlaubte Werte, Anzeigereihenfolge), mit Vitest-Tests
- Sicherheitshinweise in `src/lib/marketplace-safety.ts`, nur Hinweise, nie gesperrte Knöpfe (gleiche Regel wie überall in Flyary):
  - Retter: letztes Packdatum älter als 6 Monate oder unbekannt
  - Schirm: keine Angabe zur letzten Nachprüfung, oder Nachprüfung älter als 2 Jahre
  - Schirm: EN-C/D bzw. LTF-C/D ist nicht für Einsteiger geeignet
  - Zustand `for_parts`: deutlicher Hinweis «Nicht flugtauglich»
  - Immer: Hinweis, das Material vor dem ersten Flug prüfen zu lassen
- Übersetzungen für Kategorien, Merkmale und Hinweise in DE/FR/EN

**Ist-Stand:** `src/lib/marketplace-categories.ts` (`CATEGORY_SPECS`, `validateAttributes`, `parseMonthDate`) und `src/lib/marketplace-safety.ts` (`safetyHints`), Texte unter `market.*`. EN- und LTF-Klasse sind in einem Feld zusammengefasst (A/B/C/D/CCC/ohne Zulassung). Pflichtfelder: Klasse bei Schirmen, Typ bei Gurtzeug und Instrumenten, Typ und max. Anhängelast bei Rettern; nur für Angebote. Prüf- und Packdaten als Monat oder Tag. **Abweichungen:** keine Hinweise «Nachprüfung fehlt»/«Packdatum unbekannt» bei neuem Material; Such-Anzeigen bekommen keine Hinweise; Tandemschirme haben dieselben Merkmale wie Soloschirme (ein eigenes Feld «Tandem-Zulassung» entfällt, weil die Kategorie das schon aussagt). Die serverseitige Prüfung der Pflichtfelder folgt mit der Veröffentlichungs-RPC (4.4).

### 4.3 Fotos ✅

**Ziel:** Fotos hochladen, ohne den Free-Plan zu sprengen.

**Akzeptanzkriterien:**

- Privater Bucket `marketplace-photos` (Muster aus `0021_chat_attachments_bucket.sql`), nur Bildformate, max. 5 MB pro Datei vor der Komprimierung
- Pro Foto werden zwei Dateien hochgeladen, beide im Browser mit `image-compress.ts` erzeugt: Vollbild 1280 px WebP (Ziel ca. 150 KB) und Vorschaubild 320 px (Ziel ca. 20 KB)
- Max. 6 Fotos pro Anzeige, durchgesetzt in der RLS bzw. in einem Trigger, nicht nur in der Oberfläche
- Reihenfolge veränderbar, erstes Foto ist das Titelbild
- Anzeige über signierte URLs mit `signed-url-cache.ts`. Listen laden nur Vorschaubilder
- Pfad-Schema `listing_id/photo_id.webp` und `listing_id/photo_id_thumb.webp`; Storage-Policy prüft über die Anzeige, wer schreiben darf

**Datenmodell:** `marketplace_listing_photos`, Bucket `marketplace-photos`

**Ist-Stand:** Migration `0033_marketplace_photos.sql`, App-Logik `src/lib/marketplace-photos.ts` (Upload mit Rückbau bei Fehlern, Löschen, Reihenfolge, signierte URLs). Bucket nimmt nur WebP/JPEG bis 2 MB; die Speicher-Regel zum Lesen fragt die Anzeige ab, damit deren RLS allein über die Sichtbarkeit entscheidet. Grenze doppelt: 6 Einträge pro Anzeige (Trigger mit Zeilensperre) und 12 Dateien pro Ordner. Reihenfolge über die RPC `marketplace_reorder_photos`. **Abweichungen:** Originalbild bis 20 MB statt 5 MB (Handyfotos); keine neuen Fotos bei verkauften/abgelaufenen/entfernten Anzeigen; Dateien gelöschter Anzeigen räumt erst 4.9 auf.

### 4.4 Inserieren und «Meine Anzeigen» ✅

**Ziel:** In unter zwei Minuten eine Anzeige online stellen und die eigenen Anzeigen verwalten.

**Akzeptanzkriterien:**

- Assistent in drei Schritten (wie der Flug-Assistent): **Fotos** → **Kategorie und Details** → **Preis und Ort**
- Entwurf wird laufend gespeichert (`note-autosave.ts`) und bleibt als `draft` erhalten, wenn man abbricht
- Anzeigentyp wählbar: «Ich verkaufe» oder «Ich suche». Such-Anzeigen brauchen kein Foto
- Ort: PLZ und Ortschaft, Kanton wird aus der PLZ abgeleitet oder gewählt. Keine genauen Koordinaten in M1
- «Meine Anzeigen» mit Reitern aktiv, reserviert, verkauft/abgelaufen und Entwürfe. Pro Anzeige: bearbeiten, reservieren, verkauft, verlängern, hochschieben, löschen
- Laufzeit: Privatanzeigen laufen nach **60 Tagen** ab, Push-Mitteilung 3 Tage vorher mit «Verlängern». Schul-Neuware läuft nicht ab
- Hochschieben (`bumped_at`): gratis, aber höchstens einmal pro 7 Tage. Die Begrenzung liegt serverseitig in der RPC, damit sie später kostenpflichtig werden kann (E6)
- Grenzen (serverseitig): max. **10 aktive Anzeigen** pro Privatperson, max. **50** pro Schule, max. **5 neue Anzeigen pro 24 Stunden** pro Person
- Einstieg «Marktplatz» unter Mehr → Community. Routen `/market`, `/market/new`, `/market/:id`, `/market/:id/edit`, `/market/mine`
- Logik für Laufzeit, Hochschieben und Grenzen in `src/lib/marketplace-listing.ts` mit Tests

**Ist-Stand:** Migration `0034_marketplace_listing_status.sql` mit den RPCs `marketplace_publish`, `_reserve`, `_mark_sold`, `_renew`, `_bump` (Fehlercodes `marketplace:<code>`), Seiten `MarketListingForm.tsx` und `MarketMine.tsx`. `marketplace_publish` prüft die Pflichtangaben aus 4.2 serverseitig; Angebote brauchen mindestens ein Foto. Der Entwurf entsteht beim «Weiter» nach Schritt 2, danach werden die gewählten Fotos hochgeladen. **Abweichungen:** Speichern beim Schrittwechsel und per Knopf statt `note-autosave.ts` (auf Notizen zugeschnitten); Push 3 Tage vor Ablauf kommt mit dem Job in 4.9; «Als Schule inserieren» erst in 4.7; die Tagesgrenze gilt nur für Privatpersonen; der Menüeintrag führt bis 4.5 auf «Meine Anzeigen». Löschen einer Anzeige entfernt zuerst die Fotodateien.

### 4.5 Übersicht, Suche, Filter und Detailseite ✅

**Ziel:** Passendes Material schnell finden.

**Akzeptanzkriterien:**

- Übersicht als Kachelraster: Vorschaubild, Preis, Titel, Ortschaft, Alter der Anzeige, Abzeichen «Flugschule» bzw. «Suche» bzw. «Reserviert»
- Filter-Chips für Kategorie, dazu ein Filterblatt: Angebot/Suche, Preis von/bis, Zustand, Grösse, EN/LTF-Klasse (bei Schirmen), Kanton, «nur Flugschulen»
- Freitextsuche über Titel, Beschreibung, Hersteller und Modell. Postgres-Volltext mit der Konfiguration `simple` (Texte sind in DE/FR/EN gemischt) plus `pg_trgm` für Tippfehler
- Sortierung: neueste (nach `bumped_at`), Preis aufsteigend, Preis absteigend
- Eine RPC `marketplace_search(filters jsonb, cursor)` mit Keyset-Paginierung (Muster wie `feed-page.ts`), liefert nur die Kartenfelder und den Pfad des Vorschaubilds
- Detailseite: Bildergalerie, Preis (bei Schulen mit «inkl. MWST», falls MWST-pflichtig), Merkmal-Tabelle, Sicherheitshinweise, Verkäufer-Karte (Name, Mitglied seit, Schulzugehörigkeit, Anzahl erfasster Flüge) sowie die Buttons «Nachricht senden», «Melden» und «Teilen» (nur App-intern, E3)
- Bei Schul-Anzeigen zusätzlich die Pflichtangaben aus dem Shop-Profil (Abschnitt 4.7)

**Ist-Stand:** Migration `0035_marketplace_search.sql` (`marketplace_search`, `marketplace_seller_cards`, `market_listing_visible`), Seiten `Market.tsx` und `MarketListingDetail.tsx`, Logik `src/lib/marketplace-search.ts`. Filter stehen in der URL. Tippfehler-Toleranz über `word_similarity` ≥ 0.5 auf Titel/Hersteller/Modell. «Gratis» sortiert als 0, «Preis auf Anfrage» immer zuletzt. Die Sichtbarkeitsregel ist jetzt eine Funktion, die RLS und SECURITY-DEFINER-Funktionen gemeinsam nutzen. **Abweichungen:** Kanton wird gewählt, nicht aus der PLZ abgeleitet; «Nachricht senden» folgt in 4.6, «Melden» in 4.8, Pflichtangaben von Schulen in 4.7; «Teilen» teilt nur den App-Link.

### 4.6 Chat zur Anzeige

**Ziel:** Käufer und Verkäufer kontaktieren sich, ohne Telefon oder E-Mail herauszugeben, und ohne dass sie eine gemeinsame Gruppe brauchen.

**Hintergrund:** `chat_open_direct` verlangt heute eine gemeinsame Gruppe (`0029_chat_direct_replies_reactions.sql`). Diese Schutzregel soll **nicht** gelockert werden. Stattdessen gibt es eine eigene Channel-Art `listing`, die nur über eine Anzeige entsteht.

**Akzeptanzkriterien:**

- `chat_channels.kind` um `listing` erweitert, `chat_channels_kind_shape` angepasst (`listing_id` und `buyer_id` gesetzt, `group_id`/`event_id` leer)
- RPC `marketplace_open_chat(listing_id)`: erstellt oder öffnet den Chat zwischen der aufrufenden Person (Käufer) und der Anzeige. Nicht möglich für die eigene Anzeige, für nicht sichtbare Anzeigen oder für gesperrte Personen
- Mitglieder: Käufer plus Verkäufer. Bei Schul-Anzeigen alle Teammitglieder mit Funktion `shop` oder `school_lead` (Leserecht über eine Funktion, nicht über feste Mitgliederzeilen, damit neue Shop-Mitarbeitende automatisch dazukommen)
- Wiederverwendung von `ChannelChat.tsx` (Antworten, Reaktionen, Bearbeiten, Anhänge). Im Kopf eine kleine Karte der Anzeige (Foto, Titel, Preis, Status)
- Schnelltext beim ersten Kontakt: «Ist das noch verfügbar?»
- Fester Sicherheitshinweis im Chat: «Nie im Voraus an Unbekannte überweisen. Material vor Ort ansehen.» Zusätzlich ein Hinweis, wenn eine Nachricht eine IBAN oder einen externen Zahlungslink enthält (Erkennung in `src/lib/marketplace-chat.ts` mit Tests)
- Push wie bei Direktnachrichten (`0028`/`0029`)
- In der Nachrichtenliste erscheinen Anzeige-Chats in einem eigenen Bereich «Marktplatz»
- Ist die Anzeige verkauft oder entfernt, bleibt der Chat lesbar, und die Karte zeigt den Status

### 4.7 Schul-Shop mit Neuware

**Ziel:** Flugschulen verkaufen gewerblich (Neuware und Occasionen) mit den gesetzlich nötigen Angaben.

**Akzeptanzkriterien:**

- Neue Kachel «Shop» im Flugschul-Bereich (`/school/shop`), sichtbar für `school_lead` und `shop`
- Shop-Profil (`school_shop_profiles`): Firmenname, Adresse, UID-Nummer (bzw. Angabe «nicht MWST-pflichtig»), E-Mail, Telefon, Gewährleistungstext. **Schul-Anzeigen lassen sich erst veröffentlichen, wenn das Profil vollständig und aktiv ist.** Das ist eine rechtliche Voraussetzung und bewusst eine Ausnahme von der Regel «kein hartes Blockieren», die für Sicherheitshinweise gilt
- Schulleitung vergibt die Funktionen `shop` und `market_moderator` über den bestehenden Personen-Dialog
- Schul-Anzeigen zeigen Name und Abzeichen der Schule statt der Person, die inseriert hat
- Neuware: Zustand `new`, Menge (`quantity`), ohne Ablaufdatum. Bei «verkauft» wird die Menge um eins reduziert; erst bei 0 wechselt der Status auf `sold`
- Sichtbarkeit wählbar: «alle» oder «nur unsere Schüler» (z. B. Schulungsmaterial mit Schülerrabatt)
- Preise bei MWST-pflichtigen Schulen mit «inkl. MWST»
- Verkaufsabwicklung vorerst im Chat und vor Ort. Die Buchung auf die Abrechnung folgt in M3 (7.2)

**Offen, mit Vertical zu klären:** Reichen diese Angaben aus Sicht der Schulen? Braucht es eigene AGB pro Schul-Shop oder genügt ein Gewährleistungstext? Kurze juristische Prüfung empfohlen (Preisbekanntgabeverordnung, UWG Art. 3 Abs. 1 lit. s zur Anbieterkennzeichnung im Onlinehandel).

### 4.8 Melden und Moderation

**Ziel:** Problematische Anzeigen schnell erkennen und entfernen, verteilt auf mehrere Schultern, ohne Interessenkonflikte.

**Akzeptanzkriterien:**

- «Anzeige melden» auf jeder Detailseite. Gründe: Betrug/Verdacht, gefährliches oder nicht flugtaugliches Material ohne Kennzeichnung, falsche Kategorie, anstössiger Inhalt, Sonstiges. Eine Meldung pro Person und Anzeige
- **Wer bearbeitet welche Meldung (E5):**

  | Anzeige | Admin / globaler Moderator (`app_role`) | Schul-Moderator (`market_moderator` einer Schule mit aktivem Shop) |
  | --- | --- | --- |
  | Privatanzeige | ✅ | ✅ |
  | Schul-Anzeige (eigene oder fremde Schule) | ✅ | ❌ – geht **nur an den Admin** |

- Schul-Moderatoren sind nur solange Moderatoren, wie ihre Schule einen aktiven Shop hat (`school_shop_profiles.active`). Die Prüfung erfolgt serverseitig in einer Funktion `is_market_moderator(uid)`
- Handlungen der Moderation: Meldung abweisen, Anzeige ausblenden (Status `removed` mit Grund), Anzeige wieder freigeben. Jede Handlung landet im `marketplace_moderation_log`
- Nur der Admin kann Personen sperren (`marketplace_bans`) und Anzeigen endgültig löschen
- Automatisch ausgeblendet wird eine Anzeige ab **3 offenen Meldungen** von verschiedenen Personen, bis jemand aus der Moderation entscheidet. Das gilt auch für Schul-Anzeigen (entscheiden darf dann nur der Admin)
- Die Verkäuferin bzw. der Verkäufer erhält eine Mitteilung mit Grund, wenn die Anzeige ausgeblendet wird
- Moderationsansicht `/market/moderation`: offene Meldungen, gefiltert nach dem, was die Person bearbeiten darf
- Push an die zuständige Moderation bei neuen Meldungen (gebündelt, max. einmal pro Stunde)
- RLS-Test: Ein Schul-Moderator sieht Meldungen zu Schul-Anzeigen nachweislich nicht

### 4.9 Aufräumen, Speicherüberwachung und Konto-Löschung

**Ziel:** Der Marktplatz bleibt im Free-Plan (E7), und gelöschte Konten hinterlassen nichts.

**Akzeptanzkriterien:**

- Täglicher Aufräum-Job:
  - Privatanzeigen nach Ablauf auf `expired` setzen, 3 Tage vorher Push
  - Fotos von verkauften oder entfernten Anzeigen nach **14 Tagen** löschen
  - Fotos von abgelaufenen Anzeigen nach **30 Tagen** löschen
  - Entwürfe, die älter als 30 Tage sind, samt Fotos löschen
  - Verwaiste Foto-Ordner löschen (Anzeige gelöscht, Dateien noch im Bucket; siehe 4.3)
- Dateien müssen über die Storage-API gelöscht werden, nicht durch Löschen von Zeilen in `storage.objects`. Darum läuft der Job als Edge Function `marketplace-cleanup`, ausgelöst täglich per `pg_cron` + `pg_net` (vor der Umsetzung prüfen, ob beide Erweiterungen im Projekt aktiv sind)
- Speicherüberwachung: Die Admin-Ansicht zeigt den belegten Speicher pro Bucket (Summe aus `storage.objects`). Hinweis ab **700 MB** Gesamtbelegung: Wechsel auf Supabase Pro prüfen
- `delete-account` löscht Anzeigen, Fotos, Merklisten, gespeicherte Suchen und Meldungen der Person. Anzeige-Chats bleiben für das Gegenüber lesbar, mit «Gelöschtes Konto» als Absender (gleiche Regel wie bei den übrigen Chats)

### 4.10 Nutzungsbedingungen und Hinweise

**Ziel:** Klare Rollen: Flyary vermittelt nur, verkauft wird zwischen den Parteien.

**Akzeptanzkriterien:**

- Ergänzung in `LegalTerms.tsx`: Flyary ist nur Vermittlerin und nicht Vertragspartei. Die Verantwortung für Angaben, Zustand und Lufttüchtigkeit liegt bei Verkäufer und Käufer. Verbotene Inhalte. Moderation und Sperren
- Hinweis vor dem ersten Inserieren (einmalig bestätigen): Angaben wahrheitsgemäss, nicht flugtaugliches Material als «Für Teile» kennzeichnen
- Hinweis bei Privatanzeigen: Privatverkauf, Gewährleistung wegbedungen, soweit gesetzlich zulässig (als Vorschlag im Beschreibungstext, nicht erzwungen)
- Texte in DE/FR/EN, juristische Durchsicht vor dem Start empfohlen

## 5. Speicherbudget (Free-Plan)

| Grösse | Wert |
| --- | --- |
| Free-Plan Speicher | 1 GB, davon ca. 200 MB belegt (Stand 2026-09-24) |
| Budget für den Marktplatz | ca. 500 MB |
| Pro Foto | ca. 150 KB Vollbild + 20 KB Vorschaubild |
| Pro Anzeige (max. 6 Fotos) | ca. 1 MB, im Schnitt eher 0.5 MB |
| Platz für | ca. 500–1000 gleichzeitig vorhandene Anzeigen |
| Datentransfer | Listen laden nur Vorschaubilder (20 KB). 100 Anzeigen durchblättern ≈ 2 MB |

Mit dem Aufräumen aus Abschnitt 4.9 bleibt der Bestand begrenzt. Wird es knapp, zuerst auf 4 Fotos reduzieren, dann Supabase Pro.

## 6. M2 – Wiederkommen

### 6.1 Merkliste

Herz auf Karte und Detailseite, Liste unter «Meine Anzeigen». Mitteilung, wenn eine gemerkte Anzeige reserviert, verkauft oder im Preis gesenkt wird.

### 6.2 Gespeicherte Suchen mit Push

Aktuelle Filter als Suche speichern. Neue passende Anzeigen lösen eine Push-Mitteilung aus, gebündelt höchstens einmal pro Tag und Suche. Max. 5 gespeicherte Suchen pro Person.

### 6.3 Vorausfüllen aus dem eigenen Material

«Aus meinem Material» füllt die Anzeige aus `pilot_gliders` vor (Hersteller, Modell, Grösse). Flugstunden werden aus dem Flugbuch vorgeschlagen und als «laut Flugbuch des Verkäufers» gekennzeichnet. Weil `flights.glider` heute Freitext ist, stimmt der Abgleich nur ungefähr. Genauer wird es erst mit einer echten Verknüpfung `flights.pilot_glider_id` (eigener, vorgelagerter Umbau).

### 6.4 Umkreissuche und Gewichts-Abgleich

Umkreis ab eigener PLZ mit gerundeten Koordinaten (über die bestehende Funktion `reverse-geocode` bzw. eine PLZ-Tabelle), ohne PostGIS. Hinweis «Passt zu deinem Startgewicht», wenn im Profil ein Gewicht erfasst ist und der Gewichtsbereich des Schirms passt.

## 7. M3 – Schulen im Alltag

### 7.1 Occasion aus dem Materialbestand

Button «Als Occasion verkaufen» in `SchoolEquipment.tsx`. Die Anzeige wird aus `school_equipment` vorausgefüllt (Typ, Grösse, Prüfdaten). Beim Verkauf wird das Material automatisch mit Grund «verkauft» ausgemustert.

### 7.2 Reservieren und auf die Abrechnung setzen

Bei Schul-Anzeigen kann das Shop-Team einen Verkauf an eine Person der Schule «auf die Abrechnung setzen». Das erzeugt ein `billing_items` mit `item_type = 'sale'` und dem Verkaufspreis. Die Übergabe erfolgt z. B. am nächsten Flugtag. Damit gibt es eine Zahlungsabwicklung ohne Online-Zahlung.

## 8. M4 – Später / optional

| # | Feature | Voraussetzung |
| --- | --- | --- |
| 8.1 | Bewertungen nach abgeschlossenem Verkauf (nur zwischen Personen, die gechattet haben und beim «Verkauft» ausgewählt wurden) | Genügend Transaktionen, sonst leicht manipulierbar |
| 8.2 | Seriennummer-Abgleich gegen gestohlen gemeldetes Material (Nummer nur gehasht gespeichert) | Bedarf aus der Community |
| 8.3 | Kostenpflichtige Zusatzfunktionen: Hervorheben (`featured_until`), häufigeres Hochschieben, mehr Fotos, Schul-Shop-Paket | Phase 4 (Zahlungsanbieter) des Flugschul-Plans |
| 8.4 | Öffentlicher Teilen-Link für Nicht-Nutzer (Muster `/shared/flights/:token`) | Entscheid E3 neu fällen; Bucket-Zugriff anpassen |
| 8.5 | Zahlung in der App / Käuferschutz | Phase 4, regulatorische Abklärung (Geld für Dritte) |

## 9. Definition of Done

Es gelten Abschnitt 13 und 14 des Flugschul-Plans unverändert. Pro Feature: Migration mit RLS, Logik in `src/lib/*.ts` mit Vitest-Tests, UI in der bestehenden Navigation, DE/FR/EN, README-Abschnitt, ein Commit. Vor dem Commit `npx tsc --noEmit`, `npx eslint` für geänderte Dateien und `npx vitest run`. Nach Abschluss jeder Stufe eine eigene Abnahmeprüfung aller Features dieser Stufe.

Speziell für den Marktplatz:

- [ ] RLS-Tests decken fremde Person, Besitzer, Schulteam der eigenen und einer fremden Schule, Schul-Moderator und Admin ab
- [ ] Grenzen (Anzahl Anzeigen, Fotos, Hochschieben) sind serverseitig durchgesetzt und getestet
- [ ] Neue Speicherpfade sind im Aufräum-Job und in `delete-account` berücksichtigt

## 10. Offene Punkte

- Pflichtangaben und Gewährleistung für Schul-Shops mit Vertical und juristisch klären (4.7)
- Text der Nutzungsbedingungen juristisch durchsehen lassen (4.10)
- Prüfen, ob `pg_cron` und `pg_net` im Supabase-Projekt verfügbar sind (4.9)
- Soll Vertical als erste Schule mit Shop und Moderation starten?
