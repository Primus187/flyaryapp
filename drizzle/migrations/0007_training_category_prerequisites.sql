-- Abschnitt 5.3: Meilenstein-Freigaben im Kontrollblatt
--
-- Ausbildungskategorien können eine Voraussetzungs-Kategorie referenzieren, die vollständig
-- abgeschlossen sein muss. Wie im Plan beschrieben ist das keine harte Sperre (Fluglehrer
-- behält fachliche Entscheidungshoheit) - rein informativ im Kontrollblatt markiert.

ALTER TABLE public.training_categories
  ADD COLUMN IF NOT EXISTS unlocks_after_category_id uuid REFERENCES public.training_categories(id);

-- Konkretes Beispiel aus dem Plan: Höhenflüge erst nach abgeschlossenem Übungshang.
-- training_categories ist ein globales Curriculum (kein group_id), Kategorien werden wie
-- bisher direkt per Migration gepflegt, nicht über eine App-UI.
UPDATE public.training_categories
SET unlocks_after_category_id = (SELECT id FROM public.training_categories WHERE name = 'Übungshang')
WHERE name = 'Höhenflüge'
  AND EXISTS (SELECT 1 FROM public.training_categories WHERE name = 'Übungshang');
