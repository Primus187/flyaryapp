UPDATE public.profiles SET training_level = CASE lower(trim(training_level))
  WHEN 'grundkurs' THEN 'ground'
  WHEN 'brevetkurs' THEN 'altitude'
  WHEN 'siku' THEN 'exam_ready'
  ELSE training_level
END
WHERE lower(trim(training_level)) IN ('grundkurs', 'brevetkurs', 'siku');