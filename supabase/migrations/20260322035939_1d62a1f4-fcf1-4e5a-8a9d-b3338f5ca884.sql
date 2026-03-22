
-- Training categories
CREATE TABLE public.training_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.training_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view categories" ON public.training_categories FOR SELECT TO authenticated USING (true);

-- Training items
CREATE TABLE public.training_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.training_categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  goal text,
  content text,
  mistakes text,
  danger text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.training_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view items" ON public.training_items FOR SELECT TO authenticated USING (true);

-- Training progress (user ratings)
CREATE TABLE public.training_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  item_id uuid NOT NULL REFERENCES public.training_items(id) ON DELETE CASCADE,
  rating int NOT NULL DEFAULT 0,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, item_id)
);
ALTER TABLE public.training_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own progress" ON public.training_progress FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own progress" ON public.training_progress FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own progress" ON public.training_progress FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own progress" ON public.training_progress FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Seed categories
INSERT INTO public.training_categories (id, name, sort_order) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Theorie', 1),
  ('a0000000-0000-0000-0000-000000000002', 'Übungshang', 2),
  ('a0000000-0000-0000-0000-000000000003', 'Höhenflüge', 3),
  ('a0000000-0000-0000-0000-000000000004', 'Groundhandling', 4),
  ('a0000000-0000-0000-0000-000000000005', 'Sicherheitstraining / SIV', 5);

-- Seed items: Theorie
INSERT INTO public.training_items (category_id, name, sort_order, goal, content, mistakes, danger) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Fluglehre / Aerodynamik', 1, 'Verständnis der Grundlagen des Fliegens', 'Auftrieb, Widerstand, Profilpolare, Geschwindigkeitsbereiche, Strömungsabriss, Klappverhalten', 'Verwechslung von Anstellwinkel und Eintrittskante\nFalsche Vorstellung der Kräfte am Profil', 'Fehleinschätzung der Flugphysik kann zu gefährlichen Manövern führen'),
  ('a0000000-0000-0000-0000-000000000001', 'Wetterkunde / Meteorologie', 2, 'Wetterlagen beurteilen und Flugentscheide treffen', 'Thermik, Wind, Föhn, Fronten, Wolkenarten, Gefahrenwetter, Inversionslage', 'Unterschätzung von Windstärke und Böigkeit\nFehlende Kenntnis der lokalen Wetterdynamik', 'Fliegen bei ungeeignetem Wetter ist einer der häufigsten Unfallgründe'),
  ('a0000000-0000-0000-0000-000000000001', 'Gesetzgebung / Luftrecht', 3, 'Kenntnis der relevanten Vorschriften und Lufträume', 'VFR-Regeln, Luftraumstruktur, Naturschutzgebiete, Pflichten des Piloten, Haftung, Versicherung', 'Unkenntnis von Sperrgebieten oder TMA\nFliegen ohne gültige Versicherung', 'Verletzung des Luftrechts kann Bussen oder Lizenzentzug nach sich ziehen'),
  ('a0000000-0000-0000-0000-000000000001', 'Material- und Gerätekunde', 4, 'Aufbau und Funktion des Gleitschirms verstehen', 'Kappenkonstruktion, Leinenplan, Gurtzeug, Rettungsgerät, Beschleuniger, Checks', 'Unzureichende Materialkontrolle\nFalsche Einstellung des Gurtzeugs', 'Materialversagen durch mangelnde Wartung oder fehlende Checks'),
  ('a0000000-0000-0000-0000-000000000001', 'Flugpraxis-Theorie', 5, 'Theoretisches Wissen für die praktische Umsetzung', 'Startarten, Kurvenfliegen, Landeeinteilung, Thermikfliegen, Streckenflug-Grundlagen', 'Fehlende Vorstellung der Abläufe\nTheorie nicht auf Praxis übertragen', 'Mangelndes Verständnis führt zu Fehlreaktionen im Flug');

-- Seed items: Übungshang
INSERT INTO public.training_items (category_id, name, sort_order, goal, content, mistakes, danger) VALUES
  ('a0000000-0000-0000-0000-000000000002', 'Schirm auslegen und Vorbereitung', 1, 'Korrektes Auslegen des Schirms und Pre-Flight-Check', 'Leinen sortieren, Schirm kontrollieren, Wind beurteilen, Gurtzeug anlegen, 5-Punkte-Check', 'Leinen verdreht oder verknotet\nGurtzeug nicht korrekt geschlossen', 'Fehlende Kontrolle kann zu Startabbruch oder Unfall führen'),
  ('a0000000-0000-0000-0000-000000000002', 'Vorwärts-Aufziehen', 2, 'Sicherer Vorwärtsstart am Übungshang', 'Impuls geben, Arme strecken, Schirm über den Kopf führen, kontrollieren, loslaufen', 'Zu wenig Impuls\nArme nicht gestreckt\nSchirm nicht kontrolliert', 'Seitenklapper beim Start durch fehlende Kontrolle'),
  ('a0000000-0000-0000-0000-000000000002', 'Rückwärts-Aufziehen', 3, 'Rückwärtsstart sicher beherrschen', 'Eindrehen, Bremsen kreuzen, Schirm aufziehen, kontrollieren, umdrehen, starten', 'Falsche Leinenführung beim Eindrehen\nZu hektisches Umdrehen', 'Leinen um den Körper gewickelt, Kontrollverlust'),
  ('a0000000-0000-0000-0000-000000000002', 'Slalomlauf / Richtungswechsel', 4, 'Steuern am Boden und kontrollierte Richtungswechsel', 'Gewichtsverlagerung, Bremsleineneinsatz, Blickrichtung', 'Zu viel Bremse einseitig\nSchirm übersteuert', 'Einklappen einer Seite durch Übersteuern'),
  ('a0000000-0000-0000-0000-000000000002', 'Kurzflüge und Landungen', 5, 'Kontrollierte Kurzflüge mit sauberer Landung', 'Abheben, geradeaus fliegen, Landeeinteilung, Abbremsen', 'Zu spätes Anbremsen\nLandung nicht gegen den Wind', 'Harte Landung oder Überschiessen des Landeplatzes'),
  ('a0000000-0000-0000-0000-000000000002', 'Notsteuerung / Ohren anlegen', 6, 'Ohren anlegen als Abstiegshilfe kennen', 'A-Leinen greifen, symmetrisch ziehen, Fahrt kontrollieren, lösen', 'Asymmetrisches Ziehen\nZu starkes Anbremsen gleichzeitig', 'Stall durch zu viel Bremse bei angelegten Ohren');

-- Seed items: Höhenflüge
INSERT INTO public.training_items (category_id, name, sort_order, goal, content, mistakes, danger) VALUES
  ('a0000000-0000-0000-0000-000000000003', 'Startplatz-Beurteilung', 1, 'Wind und Startplatz selbständig beurteilen', 'Windrichtung, Windstärke, Turbulenzen, Hindernisse, Fluchtmöglichkeiten, Alternativstartplätze', 'Gruppenzwang, Start trotz ungünstiger Bedingungen\nFehlende Eigenbeurteilung', 'Start bei zu starkem oder böigem Wind'),
  ('a0000000-0000-0000-0000-000000000003', 'Vorwärtsstart Höhe', 2, 'Sicherer Vorwärtsstart am Hang/Berg', 'Aufziehen, Kontrollblick, Beschleunigen, klarer Abhebeentscheid', 'Zu zögerlich\nSchirm nicht korrekt über dem Kopf', 'Startabbruch am steilen Hang'),
  ('a0000000-0000-0000-0000-000000000003', 'Rückwärtsstart Höhe', 3, 'Sicherer Rückwärtsstart bei Wind', 'Aufziehen, Kontrollblick, Umdrehen, Beschleunigen', 'Eindrehen in falscher Richtung\nZu langes Kontrollieren', 'Verwicklung in Leinen'),
  ('a0000000-0000-0000-0000-000000000003', 'Kurvenflug', 4, 'Saubere, koordinierte Kurven fliegen', 'Gewichtsverlagerung + Bremse, Blickrichtung, Kurvenradius kontrollieren', 'Nur Bremse ohne Gewicht\nZu enge Kurven', 'Negativkurve oder Trudeln bei überzogener Innenbremse'),
  ('a0000000-0000-0000-0000-000000000003', 'Aktives Fliegen', 5, 'Auf Turbulenzen reagieren und Kappe aktiv steuern', 'Nickbewegungen ausgleichen, Klapper vermeiden, Beschleuniger-Einsatz', 'Passives Fliegen in Turbulenzen\nÜberreaktion auf kleine Störungen', 'Klapper und Verhänger in turbulenter Luft'),
  ('a0000000-0000-0000-0000-000000000003', 'Thermikfliegen', 6, 'Thermik erkennen und nutzen', 'Bart zentrieren, Kreisen, Aufwind-Signale lesen, Abflugentscheid', 'Zu grosse Kreise\nWechsel der Kreisrichtung im Bart\nAndere Piloten nicht beachten', 'Kollisionsgefahr im Bart, Absturz bei Turbulenzen'),
  ('a0000000-0000-0000-0000-000000000003', 'Landeeinteilung', 7, 'Sichere und präzise Landung', 'Position-Leg, Base-Leg, Final, gegen den Wind, Abbremsen', 'Zu spät in den Endanflug\nFalsche Höheneinteilung', 'Landung im Hindernis oder bei Rückenwind'),
  ('a0000000-0000-0000-0000-000000000003', 'Soaring / Hangfliegen', 8, 'Hangaufwind nutzen und Regeln einhalten', 'Soaring-Regeln (rechts Vorrang), Abstand zum Hang, 8er-Technik', 'Zu nah am Hang\nRegeln nicht eingehalten', 'Kollision, Lee-Turbulenzen'),
  ('a0000000-0000-0000-0000-000000000003', 'Ohren anlegen', 9, 'Kontrollierter Schnellabstieg', 'A-Leinen aussen greifen, symmetrisch ziehen, Fahrt halten, lösen, nachbremsen', 'Asymmetrisch gezogen\nGleichzeitig zu viel gebremst', 'Stall oder Trudeln bei Fehlbedienung'),
  ('a0000000-0000-0000-0000-000000000003', 'B-Stall', 10, 'B-Stall als Abstiegshilfe', 'B-Ebene symmetrisch ziehen, stabile Sinkrate, lösen', 'Asymmetrisches Ziehen\nZu schnelles Lösen', 'Verhänger oder Spirale nach Auflösung'),
  ('a0000000-0000-0000-0000-000000000003', 'Steilspirale', 11, 'Schneller Höhenabbau in Notfällen', 'Einleiten, Schräglagen kontrollieren, Auflösen über mehrere Umdrehungen', 'Einleitung zu schnell\nAuflösung zu abrupt', 'Bewusstlosigkeit durch G-Kräfte, Kontrollverlust'),
  ('a0000000-0000-0000-0000-000000000003', 'Notlandung', 12, 'Verhalten bei Aussenlandung', 'Landefeld wählen, Hindernisse beurteilen, Anflug planen, PLF', 'Entscheidung zu spät\nZu kleine Felder gewählt', 'Landung in Bäumen, Stromleitungen oder Wasser'),
  ('a0000000-0000-0000-0000-000000000003', 'Rettungsgerät-Theorie', 13, 'Kenntnis des Rettungsschirm-Einsatzes', 'Wann werfen, Wurftechnik, Verhalten nach Öffnung, Pendelverhalten', 'Zu langes Zögern\nFalsche Wurftechnik\nNicht stallen nach Öffnung', 'Spiegelflug, Schirm fliegt in Rettung'),
  ('a0000000-0000-0000-0000-000000000003', 'Streckenflugtechnik', 14, 'Grundlagen des Überlandfliegens', 'Gleiten, Vorflug-Theorie, Luftraumkenntnis, Aussenlandemöglichkeiten', 'Zu optimistische Gleitzahl-Annahme\nLuftraum-Verletzung', 'Aussenlandung ohne Vorbereitung, Luftraumverletzung'),
  ('a0000000-0000-0000-0000-000000000003', 'Flugentscheid', 15, 'Bewusste Go/No-Go-Entscheidung', 'Wetter, eigenes Können, Tagesform, Gruppendruck erkennen, persönliche Limits setzen', 'Gruppendruck nachgeben\nEigene Grenzen nicht kennen', 'Unfall durch Überschätzung');

-- Seed items: Groundhandling
INSERT INTO public.training_items (category_id, name, sort_order, goal, content, mistakes, danger) VALUES
  ('a0000000-0000-0000-0000-000000000004', 'Vorwärts-Aufziehen (Ground)', 1, 'Schirm sicher und kontrolliert aufziehen', 'Impuls, Armhaltung, Schirm stabilisieren, stehen bleiben', 'Schirm überschiesst\nKein Kontrollblick', 'Vom Schirm mitgezogen werden bei Wind'),
  ('a0000000-0000-0000-0000-000000000004', 'Rückwärts-Aufziehen (Ground)', 2, 'Kontrolliertes Aufziehen mit Blick zum Schirm', 'Eindrehen, Leinen sortieren, Impuls, stabilisieren', 'Falsche Eindreh-Richtung\nLeinen vertauscht', 'Vom Schirm geschleift bei starkem Wind'),
  ('a0000000-0000-0000-0000-000000000004', 'Schirm halten und stabilisieren', 3, 'Schirm im Zenit halten bei wechselndem Wind', 'Bremse und A-Leinen dosiert einsetzen, Gewichtsverlagerung', 'Übersteuerung\nKein Ausgleich bei Böen', 'Schirm klappt ein oder zieht den Piloten um'),
  ('a0000000-0000-0000-0000-000000000004', 'Cobra-Start', 4, 'Cobra-Technik als Alternative zum Vorwärtsstart', 'Kappe rosetten, Impuls nur über A-Leinen, Schirm öffnet sich selbst', 'Falsche Rosettierung\nZu starker Zug', 'Asymmetrisches Öffnen'),
  ('a0000000-0000-0000-0000-000000000004', 'Seitliches Handling', 5, 'Seitliches Steuern und Bewegen mit dem Schirm', 'Seitwärts laufen, Schirm folgt, Kreise gehen', 'Schirm wird instabil\nZu schnelle Richtungswechsel', 'Einklappen bei schnellem Richtungswechsel'),
  ('a0000000-0000-0000-0000-000000000004', 'Starkwind-Handling', 6, 'Sicherer Umgang mit dem Schirm bei starkem Wind', 'Schirm ablegen, sichern, kontrolliertes Aufnehmen, Bremsentechnik', 'Schirm nicht rechtzeitig abgelegt\nGriff in die falschen Leinen', 'Vom Schirm mitgeschleift oder angehoben');

-- Seed items: Sicherheitstraining / SIV
INSERT INTO public.training_items (category_id, name, sort_order, goal, content, mistakes, danger) VALUES
  ('a0000000-0000-0000-0000-000000000005', 'Seitenklapper', 1, 'Reaktion auf einseitige Einklapper', 'Klapper auslösen, Gegengewicht, Gegenbremse, öffnen lassen', 'Überreaktion mit zu viel Gegenbremse\nKeine Gewichtsverlagerung', 'Spirale bei Überreaktion, Verhänger'),
  ('a0000000-0000-0000-0000-000000000005', 'Frontalklapper', 2, 'Reaktion auf frontales Einklappen', 'Hände hoch, Fläche freigeben, nachbremsen', 'Bremsen halten statt loslassen\nPanik', 'Parachutal-Stall wenn Bremsen gehalten'),
  ('a0000000-0000-0000-0000-000000000005', 'Fullstall', 3, 'Kontrollierten Strömungsabriss einleiten und auflösen', 'Bremsen symmetrisch durchziehen, halten, kontrolliert lösen', 'Asymmetrisches Lösen\nZu schnelles Lösen', 'Vorschiesser mit Einklapper'),
  ('a0000000-0000-0000-0000-000000000005', 'Steilspirale (SIV)', 4, 'Steilspirale unter Anleitung über Wasser üben', 'Einleiten, G-Kräfte spüren, kontrollierter Ausstieg', 'Zu schnelles Einleiten\nBlackout nicht erkannt', 'G-LOC (Bewusstlosigkeit), Kontrollverlust'),
  ('a0000000-0000-0000-0000-000000000005', 'Rettungsgerät werfen', 5, 'Praxis-Übung des Rettungswurfs', 'Griff finden, herausziehen, werfen, Hauptschirm stallen', 'Griff nicht gefunden\nIn Leinen geworfen\nNicht gestallt', 'Spiegelflug bei nicht gestalltem Hauptschirm'),
  ('a0000000-0000-0000-0000-000000000005', 'Trudeln / Spin', 6, 'Trudelansatz erkennen und auflösen', 'Einseitig anbremsen bis Trudeln einsetzt, sofort lösen', 'Zu langes Halten\nPanik bei schneller Drehung', 'SAT oder Spirale wenn nicht rechtzeitig aufgelöst'),
  ('a0000000-0000-0000-0000-000000000005', 'Wingover', 7, 'Dynamische Manöver mit Pendelbewegung', 'Rhythmisches Einleiten, Timing, Steuerimpulse', 'Falsche Timing\nZu aggressive Impulse', 'Klapper in der Pendelbewegung, Kontrollverlust');
