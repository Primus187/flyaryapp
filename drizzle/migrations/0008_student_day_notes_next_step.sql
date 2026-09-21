-- Abschnitt 6.2: Übergabenotizen zwischen Fluglehrern
--
-- Der Plan nennt flight_coach_notes.is_next_step als Datenmodell, aber flight_coach_notes ist
-- die allgemeine, gruppenunabhängige Flug-Coaching-Notiz (pro einzelnem geloggten Flug, RLS
-- über is_group_admin) - nicht die Flugschul-spezifische Tages-/Übergabenotiz. Diese ist
-- bereits student_day_notes (pro Termin und Schüler, mit visible_to_student, Carry-over-Logik
-- zum Vortag in CoachDayView.tsx, und bereits Quelle für die "letzte Zusammenfassung" in der
-- Schüler-Übersicht). Abschnitt 14 des Plans erlaubt genau diese Abweichung ausdrücklich
-- ("fachliches Zielbild, keine verbindliche DDL"). is_next_step wird daher hier ergänzt.

ALTER TABLE public.student_day_notes
  ADD COLUMN IF NOT EXISTS is_next_step boolean NOT NULL DEFAULT false;
