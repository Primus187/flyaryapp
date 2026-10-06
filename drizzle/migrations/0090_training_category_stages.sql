-- Ausbildungsstand along the SHV, step 3: the Kontrollblatt follows the stage (decision 2026-10-06).
--
-- training_categories.training_level was empty for every category, so the level filter on the
-- Training page filtered nothing. Each category now belongs to one stage in the vocabulary of
-- migration 0089; the app opens the part of the own stage and keeps the other parts collapsed
-- (own stars stay, nothing counts as fulfilled automatically).

-- Categories that already carry one of the older words.
UPDATE public.training_categories SET training_level = public.normalize_training_level(training_level)
  WHERE training_level IN ('grundkurs', 'brevetkurs', 'siku', 'pilot');

UPDATE public.training_categories SET training_level = 'ground'
  WHERE training_level IS NULL AND name IN ('Übungshang', 'Groundhandling', 'Starttechnik');
UPDATE public.training_categories SET training_level = 'altitude'
  WHERE training_level IS NULL AND name IN ('Landeeinteilung', 'Flugpraxis', 'Theorie (SHV)');
UPDATE public.training_categories SET training_level = 'exam_ready'
  WHERE training_level IS NULL AND name IN ('SHV-Prüfungsmanöver');
UPDATE public.training_categories SET training_level = 'licensed'
  WHERE training_level IS NULL AND name IN ('Sicherheitstraining / SIV');
