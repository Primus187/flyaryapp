
-- Create 6 test students in auth.users
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, confirmation_token, raw_app_meta_data, raw_user_meta_data)
VALUES
  ('a1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'max.mueller@test.flyary.ch', crypt('testpass123', gen_salt('bf')), now(), now(), now(), '', '{"provider":"email","providers":["email"]}', '{"full_name":"Max Müller"}'),
  ('a1000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'lisa.keller@test.flyary.ch', crypt('testpass123', gen_salt('bf')), now(), now(), now(), '', '{"provider":"email","providers":["email"]}', '{"full_name":"Lisa Keller"}'),
  ('a1000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'jonas.weber@test.flyary.ch', crypt('testpass123', gen_salt('bf')), now(), now(), now(), '', '{"provider":"email","providers":["email"]}', '{"full_name":"Jonas Weber"}'),
  ('a1000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sarah.brunner@test.flyary.ch', crypt('testpass123', gen_salt('bf')), now(), now(), now(), '', '{"provider":"email","providers":["email"]}', '{"full_name":"Sarah Brunner"}'),
  ('a1000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'marco.steiner@test.flyary.ch', crypt('testpass123', gen_salt('bf')), now(), now(), now(), '', '{"provider":"email","providers":["email"]}', '{"full_name":"Marco Steiner"}'),
  ('a1000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'anna.frei@test.flyary.ch', crypt('testpass123', gen_salt('bf')), now(), now(), now(), '', '{"provider":"email","providers":["email"]}', '{"full_name":"Anna Frei"}')
ON CONFLICT (id) DO NOTHING;

-- Create identities for the users
INSERT INTO auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
VALUES
  ('a1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'max.mueller@test.flyary.ch', 'email', '{"sub":"a1000000-0000-0000-0000-000000000001","email":"max.mueller@test.flyary.ch"}', now(), now(), now()),
  ('a1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000002', 'lisa.keller@test.flyary.ch', 'email', '{"sub":"a1000000-0000-0000-0000-000000000002","email":"lisa.keller@test.flyary.ch"}', now(), now(), now()),
  ('a1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000003', 'jonas.weber@test.flyary.ch', 'email', '{"sub":"a1000000-0000-0000-0000-000000000003","email":"jonas.weber@test.flyary.ch"}', now(), now(), now()),
  ('a1000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000004', 'sarah.brunner@test.flyary.ch', 'email', '{"sub":"a1000000-0000-0000-0000-000000000004","email":"sarah.brunner@test.flyary.ch"}', now(), now(), now()),
  ('a1000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000005', 'marco.steiner@test.flyary.ch', 'email', '{"sub":"a1000000-0000-0000-0000-000000000005","email":"marco.steiner@test.flyary.ch"}', now(), now(), now()),
  ('a1000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000006', 'anna.frei@test.flyary.ch', 'email', '{"sub":"a1000000-0000-0000-0000-000000000006","email":"anna.frei@test.flyary.ch"}', now(), now(), now())
ON CONFLICT DO NOTHING;

-- Update profiles (created by handle_new_user trigger)
UPDATE public.profiles SET pilot_name = 'Max Müller', training_level = 'Grundkurs', flight_school = 'Vertical' WHERE user_id = 'a1000000-0000-0000-0000-000000000001';
UPDATE public.profiles SET pilot_name = 'Lisa Keller', training_level = 'Brevetkurs', flight_school = 'Vertical' WHERE user_id = 'a1000000-0000-0000-0000-000000000002';
UPDATE public.profiles SET pilot_name = 'Jonas Weber', training_level = 'Grundkurs', flight_school = 'Vertical' WHERE user_id = 'a1000000-0000-0000-0000-000000000003';
UPDATE public.profiles SET pilot_name = 'Sarah Brunner', training_level = 'Brevetkurs', flight_school = 'Vertical' WHERE user_id = 'a1000000-0000-0000-0000-000000000004';
UPDATE public.profiles SET pilot_name = 'Marco Steiner', training_level = 'SiKu', flight_school = 'Vertical' WHERE user_id = 'a1000000-0000-0000-0000-000000000005';
UPDATE public.profiles SET pilot_name = 'Anna Frei', training_level = 'Grundkurs', flight_school = 'Vertical' WHERE user_id = 'a1000000-0000-0000-0000-000000000006';

-- Add as group members
INSERT INTO public.group_members (group_id, user_id, role) VALUES
  ('07e1a432-7745-4582-801a-bb695765c7f6', 'a1000000-0000-0000-0000-000000000001', 'member'),
  ('07e1a432-7745-4582-801a-bb695765c7f6', 'a1000000-0000-0000-0000-000000000002', 'member'),
  ('07e1a432-7745-4582-801a-bb695765c7f6', 'a1000000-0000-0000-0000-000000000003', 'member'),
  ('07e1a432-7745-4582-801a-bb695765c7f6', 'a1000000-0000-0000-0000-000000000004', 'member'),
  ('07e1a432-7745-4582-801a-bb695765c7f6', 'a1000000-0000-0000-0000-000000000005', 'member'),
  ('07e1a432-7745-4582-801a-bb695765c7f6', 'a1000000-0000-0000-0000-000000000006', 'member')
ON CONFLICT DO NOTHING;

-- Create 5 past flight days
INSERT INTO public.flight_events (id, group_id, title, event_date, status, created_by, meeting_point, flight_area, day_topic, departure_info) VALUES
  ('b2000000-0000-0000-0000-000000000001', '07e1a432-7745-4582-801a-bb695765c7f6', 'Grundkurs Tag 1 - Erste Höhenflüge', '2026-02-15 07:00:00+00', 'confirmed', 'ec8dda00-c48d-4ff0-8b19-3cb251d75090', 'Bahnhof Interlaken Ost, 08:15', 'Amisbühl / Bönigen', 'Starttechnik & Geradeausflug', 'Abfahrt 08:15 ab Interlaken Ost'),
  ('b2000000-0000-0000-0000-000000000002', '07e1a432-7745-4582-801a-bb695765c7f6', 'Grundkurs Tag 2 - Kurvenflug', '2026-02-22 07:00:00+00', 'confirmed', 'ec8dda00-c48d-4ff0-8b19-3cb251d75090', 'Bahnhof Interlaken Ost, 08:15', 'Amisbühl / Bönigen', 'Kurven links/rechts, Achten', 'Abfahrt 08:15 ab Interlaken Ost'),
  ('b2000000-0000-0000-0000-000000000003', '07e1a432-7745-4582-801a-bb695765c7f6', 'Brevetkurs - Ohren anlegen', '2026-03-01 07:00:00+00', 'confirmed', 'ec8dda00-c48d-4ff0-8b19-3cb251d75090', 'Parkplatz Talstation Beatenberg', 'Niederhorn / Beatenberg', 'Ohren anlegen, beschleunigt fliegen', 'Treffpunkt 08:30 Talstation'),
  ('b2000000-0000-0000-0000-000000000004', '07e1a432-7745-4582-801a-bb695765c7f6', 'Brevetkurs - Nicken & Rollen', '2026-03-08 07:00:00+00', 'confirmed', 'ec8dda00-c48d-4ff0-8b19-3cb251d75090', 'Parkplatz Talstation Beatenberg', 'Niederhorn / Beatenberg', 'Nicken, Rollen, Steilspirale Einleitung', 'Treffpunkt 08:30 Talstation'),
  ('b2000000-0000-0000-0000-000000000005', '07e1a432-7745-4582-801a-bb695765c7f6', 'SiKu Trainingsflug', '2026-03-15 07:00:00+00', 'confirmed', 'ec8dda00-c48d-4ff0-8b19-3cb251d75090', 'Parkplatz Talstation Niesen', 'Niesen / Mülenen', 'Seitenklapper, Frontklapper, Steilspirale', 'Treffpunkt 08:00 Talstation Niesen')
ON CONFLICT (id) DO NOTHING;

-- Create event signups
INSERT INTO public.event_signups (event_id, user_id, signed_up) VALUES
  -- Tag 1: Max, Jonas, Anna
  ('b2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', true),
  ('b2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000003', true),
  ('b2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000006', true),
  -- Tag 2: Max, Jonas, Anna, Lisa
  ('b2000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', true),
  ('b2000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000003', true),
  ('b2000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000006', true),
  ('b2000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000002', true),
  -- Brevetkurs Ohren: Lisa, Sarah
  ('b2000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000002', true),
  ('b2000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000004', true),
  -- Brevetkurs Nicken: Lisa, Sarah, Max
  ('b2000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000002', true),
  ('b2000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000004', true),
  ('b2000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000001', true),
  -- SiKu: Marco
  ('b2000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000005', true)
ON CONFLICT DO NOTHING;

-- Create flights for students (using first location as takeoff/landing)
INSERT INTO public.flights (id, user_id, date, group_id, event_id, duration_minutes, altitude_gain, glider, comments) VALUES
  -- Tag 1 flights
  ('c3000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', '2026-02-15', '07e1a432-7745-4582-801a-bb695765c7f6', 'b2000000-0000-0000-0000-000000000001', 8, 300, 'Advance Alpha 7 26', 'Erster Höhenflug, sauberer Start'),
  ('c3000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', '2026-02-15', '07e1a432-7745-4582-801a-bb695765c7f6', 'b2000000-0000-0000-0000-000000000001', 10, 300, 'Advance Alpha 7 26', 'Zweiter Flug, Landeeinteilung besser'),
  ('c3000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000003', '2026-02-15', '07e1a432-7745-4582-801a-bb695765c7f6', 'b2000000-0000-0000-0000-000000000001', 7, 300, 'Nova Prion 5 S', 'Start etwas hektisch'),
  ('c3000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000006', '2026-02-15', '07e1a432-7745-4582-801a-bb695765c7f6', 'b2000000-0000-0000-0000-000000000001', 9, 300, 'Advance Alpha 7 24', 'Guter erster Flug'),
  -- Tag 2 flights
  ('c3000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000001', '2026-02-22', '07e1a432-7745-4582-801a-bb695765c7f6', 'b2000000-0000-0000-0000-000000000002', 12, 300, 'Advance Alpha 7 26', 'Achten gut geflogen'),
  ('c3000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000003', '2026-02-22', '07e1a432-7745-4582-801a-bb695765c7f6', 'b2000000-0000-0000-0000-000000000002', 11, 300, 'Nova Prion 5 S', 'Kurven werden flüssiger'),
  ('c3000000-0000-0000-0000-000000000007', 'a1000000-0000-0000-0000-000000000006', '2026-02-22', '07e1a432-7745-4582-801a-bb695765c7f6', 'b2000000-0000-0000-0000-000000000002', 10, 300, 'Advance Alpha 7 24', 'Muss Blickführung verbessern'),
  ('c3000000-0000-0000-0000-000000000008', 'a1000000-0000-0000-0000-000000000002', '2026-02-22', '07e1a432-7745-4582-801a-bb695765c7f6', 'b2000000-0000-0000-0000-000000000002', 15, 300, 'Swing Mito 2 S', 'Kurvenflug sicher'),
  -- Brevetkurs Ohren flights
  ('c3000000-0000-0000-0000-000000000009', 'a1000000-0000-0000-0000-000000000002', '2026-03-01', '07e1a432-7745-4582-801a-bb695765c7f6', 'b2000000-0000-0000-0000-000000000003', 20, 800, 'Swing Mito 2 S', 'Ohren anlegen geübt, sauber'),
  ('c3000000-0000-0000-0000-000000000010', 'a1000000-0000-0000-0000-000000000004', '2026-03-01', '07e1a432-7745-4582-801a-bb695765c7f6', 'b2000000-0000-0000-0000-000000000003', 18, 800, 'Advance Alpha 7 26', 'Ohren noch unsicher, mehr üben'),
  -- Brevetkurs Nicken flights
  ('c3000000-0000-0000-0000-000000000011', 'a1000000-0000-0000-0000-000000000002', '2026-03-08', '07e1a432-7745-4582-801a-bb695765c7f6', 'b2000000-0000-0000-0000-000000000004', 25, 800, 'Swing Mito 2 S', 'Nicken gut, Rollen noch üben'),
  ('c3000000-0000-0000-0000-000000000012', 'a1000000-0000-0000-0000-000000000004', '2026-03-08', '07e1a432-7745-4582-801a-bb695765c7f6', 'b2000000-0000-0000-0000-000000000004', 22, 800, 'Advance Alpha 7 26', 'Nicken sauber ausgeführt'),
  ('c3000000-0000-0000-0000-000000000013', 'a1000000-0000-0000-0000-000000000001', '2026-03-08', '07e1a432-7745-4582-801a-bb695765c7f6', 'b2000000-0000-0000-0000-000000000004', 18, 800, 'Advance Alpha 7 26', 'Erster Brevetkurs-Flug'),
  -- SiKu flights
  ('c3000000-0000-0000-0000-000000000014', 'a1000000-0000-0000-0000-000000000005', '2026-03-15', '07e1a432-7745-4582-801a-bb695765c7f6', 'b2000000-0000-0000-0000-000000000005', 35, 1200, 'Advance Epsilon 10 M', 'Seitenklapper provoziert und aufgelöst'),
  ('c3000000-0000-0000-0000-000000000015', 'a1000000-0000-0000-0000-000000000005', '2026-03-15', '07e1a432-7745-4582-801a-bb695765c7f6', 'b2000000-0000-0000-0000-000000000005', 30, 1200, 'Advance Epsilon 10 M', 'Steilspirale 2 Umdrehungen sauber')
ON CONFLICT (id) DO NOTHING;

-- Create student day notes (instructor feedback)
INSERT INTO public.student_day_notes (event_id, student_user_id, flight_number, note, visible_to_student, instructor_id) VALUES
  -- Tag 1: Max
  ('b2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 1, 'Sauberer Vorwärtsstart, gute Geschwindigkeit beim Aufziehen. Landeeinteilung etwas zu hoch.', true, 'ec8dda00-c48d-4ff0-8b19-3cb251d75090'),
  ('b2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 2, 'Landeeinteilung deutlich besser. Flair-Timing üben.', true, 'ec8dda00-c48d-4ff0-8b19-3cb251d75090'),
  ('b2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', NULL, 'Talentierter Schüler, lernt schnell. Bereit für Kurvenflug.', true, 'ec8dda00-c48d-4ff0-8b19-3cb251d75090'),
  -- Tag 1: Jonas
  ('b2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000003', 1, 'Start etwas hektisch, Schirm nicht kontrolliert aufgezogen. Muss Bodenhandling mehr üben.', true, 'ec8dda00-c48d-4ff0-8b19-3cb251d75090'),
  ('b2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000003', NULL, 'Braucht mehr Bodenhandling-Übung. Nervös beim Start. Nächstes Mal erst Übungshang.', false, 'ec8dda00-c48d-4ff0-8b19-3cb251d75090'),
  -- Tag 1: Anna
  ('b2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000006', 1, 'Sehr ruhig und konzentriert. Guter Start. Landung etwas zu schnell.', true, 'ec8dda00-c48d-4ff0-8b19-3cb251d75090'),
  ('b2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000006', NULL, 'Gute Grundlagen, ruhige Pilotin. Kann direkt zu Kurven übergehen.', true, 'ec8dda00-c48d-4ff0-8b19-3cb251d75090'),
  -- Tag 2: Max
  ('b2000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 1, 'Achten schön symmetrisch, gute Gewichtsverlagerung.', true, 'ec8dda00-c48d-4ff0-8b19-3cb251d75090'),
  ('b2000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', NULL, 'Fortgeschrittener Grundkurs-Schüler. Bereit für Solo-Flüge.', true, 'ec8dda00-c48d-4ff0-8b19-3cb251d75090'),
  -- Brevetkurs: Lisa
  ('b2000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000002', 1, 'Ohren sauber angelegt und gehalten. Beschleuniger-Kombination geübt.', true, 'ec8dda00-c48d-4ff0-8b19-3cb251d75090'),
  ('b2000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000002', NULL, 'Brevetkurs läuft gut. Ohren sicher, Beschleuniger noch etwas zaghaft.', true, 'ec8dda00-c48d-4ff0-8b19-3cb251d75090'),
  -- Brevetkurs: Sarah
  ('b2000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000004', 1, 'Ohren nicht symmetrisch angelegt. Muss an Zugpunkt arbeiten.', true, 'ec8dda00-c48d-4ff0-8b19-3cb251d75090'),
  ('b2000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000004', NULL, 'Ohren noch unsicher. Braucht mehr Übung vor nächstem Manöver.', false, 'ec8dda00-c48d-4ff0-8b19-3cb251d75090'),
  -- SiKu: Marco
  ('b2000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000005', 1, 'Seitenklapper sauber provoziert. Gute Reaktion, aktives Gegensteuern.', true, 'ec8dda00-c48d-4ff0-8b19-3cb251d75090'),
  ('b2000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000005', 2, 'Steilspirale kontrolliert eingeleitet. Ausleitung etwas zu abrupt.', true, 'ec8dda00-c48d-4ff0-8b19-3cb251d75090'),
  ('b2000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000005', NULL, 'Erfahrener Pilot. SiKu-Manöver gut, Steilspirale-Ausleitung noch verfeinern.', true, 'ec8dda00-c48d-4ff0-8b19-3cb251d75090')
ON CONFLICT DO NOTHING;

-- Add some training progress for students
INSERT INTO public.training_progress (user_id, item_id, rating) VALUES
  -- Lisa: 5 of 7 exam maneuvers done
  ('a1000000-0000-0000-0000-000000000002', 'fd282f1a-f5bc-42d1-b9fa-0ac5b68f8982', 4),
  ('a1000000-0000-0000-0000-000000000002', 'e86c32f4-d822-4d5e-bf3a-6fd05f0bffd3', 3),
  ('a1000000-0000-0000-0000-000000000002', '58acc866-7996-4912-ad07-47d16b3f262f', 4),
  ('a1000000-0000-0000-0000-000000000002', '5f192be5-c905-4d96-af97-606f5b284dcb', 3),
  ('a1000000-0000-0000-0000-000000000002', '36019bb7-4252-4328-bf0f-c1ace7a582c1', 3),
  -- Sarah: 3 of 7 exam maneuvers
  ('a1000000-0000-0000-0000-000000000004', 'fd282f1a-f5bc-42d1-b9fa-0ac5b68f8982', 3),
  ('a1000000-0000-0000-0000-000000000004', 'e86c32f4-d822-4d5e-bf3a-6fd05f0bffd3', 3),
  ('a1000000-0000-0000-0000-000000000004', '58acc866-7996-4912-ad07-47d16b3f262f', 4),
  -- Marco: all 7 done
  ('a1000000-0000-0000-0000-000000000005', 'fd282f1a-f5bc-42d1-b9fa-0ac5b68f8982', 5),
  ('a1000000-0000-0000-0000-000000000005', 'e86c32f4-d822-4d5e-bf3a-6fd05f0bffd3', 4),
  ('a1000000-0000-0000-0000-000000000005', '58acc866-7996-4912-ad07-47d16b3f262f', 5),
  ('a1000000-0000-0000-0000-000000000005', '5f192be5-c905-4d96-af97-606f5b284dcb', 4),
  ('a1000000-0000-0000-0000-000000000005', '36019bb7-4252-4328-bf0f-c1ace7a582c1', 5),
  ('a1000000-0000-0000-0000-000000000005', 'e62dbdbd-faf7-4d2f-b55d-cf4d8e172ad5', 4),
  ('a1000000-0000-0000-0000-000000000005', '87a7aef6-d19d-4ce6-9e3a-3d4bee1b53ee', 5),
  -- Max: 2 of 7
  ('a1000000-0000-0000-0000-000000000001', 'fd282f1a-f5bc-42d1-b9fa-0ac5b68f8982', 3),
  ('a1000000-0000-0000-0000-000000000001', 'e86c32f4-d822-4d5e-bf3a-6fd05f0bffd3', 3)
ON CONFLICT DO NOTHING;
