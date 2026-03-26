
-- Add is_exam_maneuver column
ALTER TABLE public.training_items ADD COLUMN IF NOT EXISTS is_exam_maneuver boolean NOT NULL DEFAULT false;

-- Delete old data (CASCADE handles training_progress and flight_training_items)
DELETE FROM public.training_items;
DELETE FROM public.training_categories;

-- Insert SHV-konforme Kategorien
INSERT INTO public.training_categories (id, name, sort_order) VALUES
  ('c1000000-0000-0000-0000-000000000001', 'Theorie (SHV)', 1),
  ('c1000000-0000-0000-0000-000000000002', 'Starttechnik', 2),
  ('c1000000-0000-0000-0000-000000000003', 'SHV-Prüfungsmanöver', 3),
  ('c1000000-0000-0000-0000-000000000004', 'Landeeinteilung', 4),
  ('c1000000-0000-0000-0000-000000000005', 'Groundhandling', 5),
  ('c1000000-0000-0000-0000-000000000006', 'Flugpraxis', 6),
  ('c1000000-0000-0000-0000-000000000007', 'Sicherheitstraining / SIV', 7),
  ('c1000000-0000-0000-0000-000000000008', 'Übungshang', 8);

-- Theorie (SHV)
INSERT INTO public.training_items (category_id, name, sort_order, goal, content, mistakes, danger, is_exam_maneuver) VALUES
  ('c1000000-0000-0000-0000-000000000001', 'Fluglehre / Aerodynamik', 1,
   'Grundlagen der Aerodynamik verstehen: Auftrieb, Widerstand, Profilpolare, Strömungsabriss',
   'Anstellwinkel, Bernoulli-Prinzip, Tragflächenprofil, Geschwindigkeitspolare, Gleitwinkel, bestes Gleiten, geringstes Sinken',
   'Verwechslung von Anstellwinkel und Einstellwinkel. Fehlende Kenntnis der Strömungsabriss-Geschwindigkeit.',
   'Strömungsabriss bei zu geringer Geschwindigkeit oder zu hohem Anstellwinkel → Sackflug, Stall.', false),
  ('c1000000-0000-0000-0000-000000000001', 'Wetterkunde / Meteorologie', 2,
   'Wetterlagen und deren Einfluss auf den Flug beurteilen können',
   'Thermik, Föhn, Inversionen, Wolkenarten (Cu, Cb), Windgradient, Lee-Effekte, Talwind-Systeme, Gewitterentwicklung',
   'Unterschätzung von Föhn und Lee. Fehleinschätzung der Thermikstärke.',
   'Cumulonimbus (Cb) → Gewitter, Hagel, Blitz. Föhn → extreme Turbulenzen. Lee → Rotoren.', false),
  ('c1000000-0000-0000-0000-000000000001', 'Gesetzgebung / Luftrecht', 3,
   'Schweizer Luftrecht und SHV-Regulierungen kennen',
   'Luftraumstruktur (C, D, E), CTR, TMA, Vorflugregeln, Ausweichregeln, Flugverbotszonen, Bewilligungen, SHV-Brevet',
   'Unkenntnis der Luftraumgrenzen. Fliegen ohne gültige Bewilligung in CTR.',
   'Eindringen in kontrollierten Luftraum → Kollisionsgefahr mit Flugzeugen.', false),
  ('c1000000-0000-0000-0000-000000000001', 'Materialkunde', 4,
   'Aufbau und Wartung des Gleitschirms verstehen',
   'Kappe (Ober-/Untersegel, Zellen, Profil), Leinen (A/B/C/D, Tragegurte), Gurtzeug, Rettungsgerät, Beschleuniger',
   'Fehlende Vorflugskontrollen. Veraltete Leinen nicht erkannt.',
   'Materialversagen (Leinenbruch, defekte Karabiner) kann zum Kontrollverlust führen.', false),
  ('c1000000-0000-0000-0000-000000000001', 'Flugpraxis-Theorie', 5,
   'Theoretische Grundlagen der Flugtechnik kennen',
   'Kurvenflug, Gewichtsverlagerung, Bremstechnik, Speed-System, aktives Fliegen, Flugentscheidung, Notverfahren',
   'Überbremsen in Kurven. Fehlende mentale Vorbereitung auf Notfälle.',
   'Fehlentscheidung am Start → Unfall. Fehlende Notfallprozeduren.', false);

-- Starttechnik
INSERT INTO public.training_items (category_id, name, sort_order, goal, content, mistakes, danger, is_exam_maneuver) VALUES
  ('c1000000-0000-0000-0000-000000000002', '5-Punkte-Check', 1,
   'Systematische Startvorbereitung gemäss SHV-Standard durchführen',
   '1. Schirm (Kappe ausgelegt, Leinen sortiert), 2. Gurtzeug (geschlossen, Beingurte), 3. Rettung (gesichert, Handle erreichbar), 4. Helm (geschlossen, Visier), 5. Wind/Umfeld (Stärke, Richtung, Luftraum)',
   'Beingurte vergessen zu schliessen. Leinenverhänger übersehen. Check übersprungen bei Routine.',
   'Offenes Gurtzeug → Herausfallen. Leinenverhänger → asymmetrischer Start, Absturz.', false),
  ('c1000000-0000-0000-0000-000000000002', 'Vorwärtsstart', 2,
   'Sicheren Vorwärtsstart bei Windstärken 0–15 km/h durchführen',
   'Kappe flach auslegen, A-Gurte greifen, gleichmässig anziehen, Kappe kontrolliert über Kopf bringen, Laufrichtung halten, Abflugentscheidung',
   'Zu schnelles Anziehen → Schiessen. Schräges Auflegen. Zu frühes Einsetzen ins Gurtzeug.',
   'Unkontrolliertes Schiessen → Frontklapper am Boden. Abbruch bei Seitenwind → in Hindernisse.', false),
  ('c1000000-0000-0000-0000-000000000002', 'Rückwärtsstart', 3,
   'Sicheren Rückwärtsstart bei Wind >10 km/h durchführen',
   'Kreuzgriff (A-Gurte gekreuzt), Kappe aufziehen, kontrollieren über Schulter, Umdrehen, Laufen, Abflug',
   'Falscher Kreuzgriff → Verdrehung. Zu spät umgedreht. Kappe nicht kontrolliert vor dem Drehen.',
   'Verwicklung in Leinen beim Drehen. Rückwärtslaufen → Stolpergefahr an Hangkante.', false);

-- SHV-Prüfungsmanöver (a–g) — alle is_exam_maneuver = true
INSERT INTO public.training_items (category_id, name, sort_order, goal, content, mistakes, danger, is_exam_maneuver) VALUES
  ('c1000000-0000-0000-0000-000000000003', 'a) Doppelkreis', 1,
   'Zwei Vollkreise rechtsdrehend in max. 20 Sekunden fliegen',
   'SHV Ziffer 5.7.2a: Zwei aufeinanderfolgende 360°-Kurven nach rechts. Maximale Zeit: 20 Sekunden. Gleichmässige Schräglage, konstanter Radius, koordinierte Gewichtsverlagerung und Bremseinsatz.',
   'Ungleichmässiger Radius. Zu flache oder zu steile Schräglage. Zeitüberschreitung. Höhenverlust nicht eingeplant.',
   'Zu steile Spirale → hohe Sinkrate, Kontrollverlust. Überzogene Innenbremse → Strömungsabriss innen, Trudeln.', true),
  ('c1000000-0000-0000-0000-000000000003', 'b) Acht', 2,
   'Eine Acht fliegen (1× links + 1× rechts) in max. 25 Sekunden',
   'SHV Ziffer 5.7.2b: Ein Vollkreis links, direkt gefolgt von einem Vollkreis rechts. Maximale Zeit: 25 Sekunden. Sauberer Wechsel der Kurvenrichtung, koordiniert.',
   'Verzögerung beim Richtungswechsel. Ungleich grosse Kreise. Zeitüberschreitung.',
   'Dynamischer Richtungswechsel kann zu Pendeln führen. Überziehen der Bremse beim Kurvenwechsel.', true),
  ('c1000000-0000-0000-0000-000000000003', 'c) Ohren beschleunigt geradeaus', 3,
   'Ohren anlegen (25% Spannweite), beschleunigt 10 Sekunden geradeaus fliegen',
   'SHV Ziffer 5.7.2c: Äussere A-Leinen greifen, 25% der Spannweite symmetrisch einklappen. Beschleuniger treten und mindestens 10 Sekunden stabil geradeaus halten. Danach Ohren freigeben, Beschleuniger lösen.',
   'Asymmetrisches Anlegen der Ohren. Kursabweichung durch einseitige Bremse. Zu kurz gehalten.',
   'Bei voll beschleunigtem Flug mit Ohren → reduzierte Sicherheitsmarge. Turbulenzen in dieser Konfiguration gefährlicher.', true),
  ('c1000000-0000-0000-0000-000000000003', 'd) Ohren mit Richtungswechsel', 4,
   'Ohren anlegen, dann per Gewichtsverlagerung 90° links und 90° rechts lenken',
   'SHV Ziffer 5.7.2d: Ohren anlegen (25% Spannweite), dann nur mit Körpergewicht (ohne Bremse!) 90°-Richtungswechsel links, dann rechts. Demonstriert Steuerbarkeit ohne Bremseinsatz.',
   'Instinktiv Bremse benutzen statt nur Gewicht. Zu wenig Gewichtsverlagerung → keine Richtungsänderung.',
   'Bremse mit angelegten Ohren → erhöhtes Stallrisiko der verkleinerten Fläche.', true),
  ('c1000000-0000-0000-0000-000000000003', 'e) Seitenklapper stabilisiert', 5,
   '40% der Spannweite einseitig einklappen und 3 Sekunden stabil halten',
   'SHV Ziffer 5.7.2e: Einseitig ca. 40% der Spannweite einklappen (B- oder A-Leinen aussen). Klapper mindestens 3 Sekunden stabilisieren, dabei Kurs halten mit Gegenbremse und Gewicht. Danach kontrolliert öffnen lassen.',
   'Zu wenig Gegenbremse → Drehung. Zu viel Gegenbremse → Stall der offenen Seite. Klapper nicht gehalten.',
   'Unkontrollierte Drehung bei fehlendem Gegenlenken. Bei Vollklapper → Verhänger, Spirale.', true),
  ('c1000000-0000-0000-0000-000000000003', 'f) Nicken (Pitch)', 6,
   'Pitch-Pendel erzeugen und innerhalb 5 Sekunden stabilisieren (max. 5 Impulse)',
   'SHV Ziffer 5.7.2f: Symmetrisches Anbremsen und Lösen (Pumpen) um Nickbewegung zu erzeugen. Maximal 5 Impulse. Danach innerhalb 5 Sekunden aktiv stabilisieren durch gezieltes Gegenbremsen.',
   'Zu starke Impulse → unkontrolliertes Schiessen. Timing beim Gegenbremsen falsch.',
   'Frontklapper bei zu starkem Schiessen nach vorne. Strömungsabriss bei zu starkem Anbremsen im Rückschwung.', true),
  ('c1000000-0000-0000-0000-000000000003', 'g) Rollen', 7,
   'Roll-Pendel erzeugen und innerhalb 8 Sekunden stabilisieren (max. 5 Impulse)',
   'SHV Ziffer 5.7.2g: Abwechselnd links-rechts anbremsen um Rollbewegung zu erzeugen. Maximal 5 Impulse. Danach innerhalb 8 Sekunden aktiv stabilisieren.',
   'Zu grosse Ausschläge → asymmetrischer Klapper. Falsches Timing beim Gegenlenken.',
   'Starkes Rollen → einseitiger Klapper → Verhänger. Dynamischer Klapper bei hoher Rollrate.', true);

-- Landeeinteilung
INSERT INTO public.training_items (category_id, name, sort_order, goal, content, mistakes, danger, is_exam_maneuver) VALUES
  ('c1000000-0000-0000-0000-000000000004', 'Landevolte (Position → Gegen → Quer → End)', 1,
   'Standardmässige Landevolte mit korrekten Anflugteilen fliegen',
   'Positionsanflug (parallel zur Landebahn), Gegenanflug, Queranflug (90° zur Landerichtung), Endanflug (in den Wind). Höhe mit S-Kurven oder Achten abbauen falls nötig.',
   'Queranflug zu tief oder zu hoch. Endanflug nicht in den Wind. Zu späte Korrektur.',
   'Landung mit Rückenwind → hohe Bodengeschwindigkeit → Verletzung. Zu tiefer Queranflug → Hinderniskollision.', false),
  ('c1000000-0000-0000-0000-000000000004', 'Landung im Zielfeld', 2,
   'Ziellandung gemäss SHV-Vorgaben: Kreis 34m oder Rechteck 20×45m / 15×60m',
   'Präzise Höhenplanung im Endanflug. Aufsetzen im markierten Bereich. Ausflaren auf Kniehöhe, Stehlandung.',
   'Zu hohes Ausflaren → Durchsacken. Zu tiefes Ausflaren → harte Landung. Falsche Geschwindigkeit im Endanflug.',
   'Harte Landung bei zu viel Geschwindigkeit oder Wind von hinten. Einfädeln bei tiefem Anflug über Hindernisse.', false),
  ('c1000000-0000-0000-0000-000000000004', 'Toplanding', 3,
   'Sichere Landung am Startplatz oder auf einer Bergkuppe durchführen',
   'Soaring nutzen, Höhe halten, Landevolte anpassen, genau in den Wind, Landefläche erkunden, Windstärke beurteilen',
   'Zu wenig Wind → Unterschiessen. Turbulenz am Grat unterschätzt. Kein Fluchtplan.',
   'Lee-Turbulenzen hinter dem Grat. Dynamischer Stall bei böigem Wind. Absturz über Hangkante.', false);

-- Groundhandling
INSERT INTO public.training_items (category_id, name, sort_order, goal, content, mistakes, danger, is_exam_maneuver) VALUES
  ('c1000000-0000-0000-0000-000000000005', 'Vorwärts-Aufziehen am Boden', 1,
   'Kappe gleichmässig und kontrolliert über Kopf aufziehen (vorwärts)',
   'Leinen sortieren, A-Gurte symmetrisch greifen, gleichmässig anziehen, Kappe über Kopf stabilisieren',
   'Zu schnelles Anziehen → Schiessen. Asymmetrisches Aufziehen → Seitenpendel.',
   'Wind kann Kappe unkontrolliert nach vorne ziehen → Schleifen am Boden.', false),
  ('c1000000-0000-0000-0000-000000000005', 'Rückwärts-Aufziehen & Kontrollieren', 2,
   'Kappe im Kreuzgriff aufziehen, kontrollieren und halten',
   'Kreuzgriff, langsam aufziehen, über Schulter kontrollieren, Korrekturen mit A- und Bremse, Kappe über Kopf halten',
   'Falscher Kreuzgriff. Zu viel Bremse → Kappe bricht zusammen. Nicht nach Kappe geschaut.',
   'Verwicklung in Leinen. Bei starkem Wind → Pilot wird hochgezogen.', false),
  ('c1000000-0000-0000-0000-000000000005', 'Kiting / Spielen mit dem Schirm', 3,
   'Schirm stabil über Kopf halten und sich am Boden bewegen',
   'Gewichtsverlagerung, minimale Bremskorrektur, seitliches Laufen, 360°-Drehungen mit Schirm über Kopf',
   'Zu viel Bremseinsatz. Schirm nicht in Windachse gehalten. Zu hektische Korrekturen.',
   'Bei starkem Wind → Pilot wird angehoben und kann unkontrolliert abheben.', false);

-- Flugpraxis
INSERT INTO public.training_items (category_id, name, sort_order, goal, content, mistakes, danger, is_exam_maneuver) VALUES
  ('c1000000-0000-0000-0000-000000000006', 'Thermik fliegen', 1,
   'Thermikblasen erkennen, zentrieren und effizient aufdrehen',
   'Thermikquellen erkennen (Felder, Felsen), Einstieg, Zentrieren (engere Kreise zur stärksten Steigrate), Gewichtsverlagerung nutzen, andere Piloten beobachten',
   'Zu weite Kreise → Thermikkern verfehlt. Zu enges Kreisen → Stall-Gefahr. Andere Piloten nicht gesehen.',
   'Kollisionsgefahr beim Thermikkreisen mit mehreren Piloten. Zu tiefes Einkreisen → kein Ausweg.', false),
  ('c1000000-0000-0000-0000-000000000006', 'Soaring / Hangfliegen', 2,
   'Dynamischen Aufwind am Hang nutzen und sicher soaren',
   'Parallel zum Hang fliegen, Sicherheitsabstand halten, Vorflugregeln (hangaufwärts hat Vortritt), Wenden zum Hang hin',
   'Zu nah am Hang. Wende vom Hang weg statt zum Hang hin. Vorflugregeln missachtet.',
   'Lee-Turbulenzen hinter Graten. Kollision mit anderen Piloten. Strömungsabriss bei Hangwende.', false),
  ('c1000000-0000-0000-0000-000000000006', 'Streckenflug (XC) Grundlagen', 3,
   'Grundlagen des Streckenflugs: Gleiten, Thermikwechsel, Routenplanung',
   'Gleitphasen optimieren (Speed-to-Fly), Thermikanschluss finden, Luftraumbeachtung, Aussenlandemöglichkeiten prüfen, Windversatz einplanen',
   'Zu tiefes Vorfliegen → kein Thermikanschluss. Luftraum missachtet. Kein Aussenlandeplan.',
   'Aussenlandung in ungeeignetem Gelände. Luftraumverletzung. Überentwicklung (Gewitter).', false),
  ('c1000000-0000-0000-0000-000000000006', 'Aktives Fliegen', 4,
   'Turbulente Luft aktiv und sicher durchfliegen',
   'Anbremsen bei Aufwind (Schirm hinter sich halten), Freigeben bei Abwind (Schirm vor sich lassen), Vorhalten, Gewichtsverlagerung, Speed-System situativ einsetzen',
   'Passives Fliegen in turbulenter Luft. Falsche Reaktion auf Klapper (zu viel Bremse).',
   'Klapper in Turbulenz → asymmetrische Konfiguration. Frontklapper bei ungebremstem Flug in Abwind.', false),
  ('c1000000-0000-0000-0000-000000000006', 'Flugentscheidung / Risikomanagement', 5,
   'Fundierte Go/No-Go-Entscheidung treffen und Risiken einschätzen',
   'IMSAFE-Check (Illness, Medication, Stress, Alcohol, Fatigue, Eating), Wetterbriefing, persönliche Limits setzen, Peer Pressure erkennen',
   'Fliegen trotz Bauchgefühl. Gruppendruck nachgeben. Eigene Limits nicht kennen.',
   'Start bei grenzwertigen Bedingungen → höchstes Unfallrisiko. Selbstüberschätzung.', false);

-- Sicherheitstraining / SIV
INSERT INTO public.training_items (category_id, name, sort_order, goal, content, mistakes, danger, is_exam_maneuver) VALUES
  ('c1000000-0000-0000-0000-000000000007', 'Seitenklapper (gross)', 1,
   'Kontrollierter seitlicher Klapper und Reaktion darauf üben (SIV)',
   'Einseitiges Einklappen (50–75%), Gegenlenken mit Bremse und Gewicht, kontrolliertes Öffnen lassen, Kurs halten',
   'Panik → keine Reaktion. Überreaktion mit Bremse → Stall. Klapper nicht aktiv geöffnet.',
   'Verhänger → Spirale → schneller Höhenverlust. Immer über Wasser oder mit genügend Höhe üben.', false),
  ('c1000000-0000-0000-0000-000000000007', 'Frontklapper', 2,
   'Kontrollierter Frontklapper und Wiederherstellung des Normalflugs (SIV)',
   'Symmetrisches Ziehen der A-Leinen, Frontklapper auslösen, Hände hoch (lösen), Kappe öffnet sich selbstständig',
   'A-Leinen nicht symmetrisch gezogen → asymmetrischer Klapper. Zu lange gehalten.',
   'Zu tiefer Frontklapper + asymmetrisch → Trudeln. Immer über Wasser und mit SIV-Instruktor üben.', false),
  ('c1000000-0000-0000-0000-000000000007', 'Steilspirale', 3,
   'Kontrollierte Steilspirale mit hoher Sinkrate fliegen und ausleiten',
   'Schrittweises Einleiten, Sinkrate kontrollieren (bis 14 m/s), Ausleiten durch langsames Öffnen der Innenbremse, G-Kräfte erwarten',
   'Zu schnelles Einleiten → Kontrollverlust. Falsches Ausleiten → Nachdrehen.',
   'G-Kräfte → Blackout möglich (>4G). Nachdrehen nach dem Ausleiten → erneutes Einleiten. NUR unter professioneller Anleitung!', false),
  ('c1000000-0000-0000-0000-000000000007', 'Fullstall', 4,
   'Vollständigen Strömungsabriss (Fullstall) und Wiederherstellung üben (SIV)',
   'Symmetrisches Durchbremsen bis zum Strömungsabriss. Kappe fällt nach hinten. Hände symmetrisch lösen → Vorwärtsschwung → Kappe fliegt wieder.',
   'Asymmetrisches Lösen → Trudeln. Zu schnelles Lösen → starkes Vorschiessen.',
   'Trudeln bei asymmetrischem Stall. Verhänger nach Fullstall. NUR über Wasser mit SIV-Lehrer!', false),
  ('c1000000-0000-0000-0000-000000000007', 'Rettungsgerät werfen', 5,
   'Korrektes Auslösen und Werfen des Rettungsgeräts üben',
   'Griff finden, Handle ziehen, Rettung kraftvoll in freien Luftraum werfen, Schirm deaktivieren (B-Stall oder einziehen)',
   'Rettung in Leinen geworfen. Handle nicht gefunden. Schirm nicht deaktiviert → Spirale mit Rettung.',
   'Falsch geworfene Rettung → Verhänger. Schirm fliegt weiter → Rettung kann sich nicht öffnen. Training rettet Leben!', false);

-- Übungshang
INSERT INTO public.training_items (category_id, name, sort_order, goal, content, mistakes, danger, is_exam_maneuver) VALUES
  ('c1000000-0000-0000-0000-000000000008', 'Erste Hüpfer / Kurzflüge', 1,
   'Kontrolliertes Abheben und Landen am flachen Übungshang',
   'Vorwärtsstart am Hang, kurz abheben (1–5m Höhe), geradeaus fliegen, kontrolliert ausflaren und stehen',
   'Zu frühes Einsetzen ins Gurtzeug. Nicht geradeaus gelaufen. Hände zu hoch (überbremst).',
   'Am Übungshang gering. Stolpern beim Laufen. Seitenwind kann Anfänger überraschen.', false),
  ('c1000000-0000-0000-0000-000000000008', 'Erste Kurven', 2,
   'Flache Kurven (15–30° Schräglage) am Übungshang fliegen',
   'Leichte Gewichtsverlagerung + sanfter Bremseinsatz einseitig. Blick in Kurvenrichtung. Kurve mit Gegenbremse einleiten und ausleiten.',
   'Zu starke Bremse → enger Kreis, Stallgefahr. Keine Gewichtsverlagerung. Blick nach unten.',
   'Am Übungshang gering bei flachen Kurven. Bei zu steiler Kurve → Stallgefahr.', false),
  ('c1000000-0000-0000-0000-000000000008', 'Geschwindigkeitskontrolle', 3,
   'Verschiedene Geschwindigkeiten erfühlen und die Bremsweg-Geschwindigkeits-Beziehung verstehen',
   'Vollgas (Hände oben), halbe Bremse, volle Bremse (kurz vor Stall). Geräuschunterschiede wahrnehmen. Stallpunkt erspüren.',
   'Stallpunkt unbemerkt überschritten. Nicht symmetrisch gebremst.',
   'Stall bei zu starkem Bremsen → Strömungsabriss, Trudeln (am Übungshang bei genug Höhe weniger kritisch).', false);
