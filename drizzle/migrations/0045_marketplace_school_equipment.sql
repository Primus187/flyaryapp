-- Marketplace (plan 7.1): sell school equipment as a used item.
--   marketplace_listings.school_equipment_id links a school listing to the piece of equipment it sells.
--   Only for school listings and only equipment of the same school; at most one running listing per piece.
--   When such a listing is sold, the equipment is retired automatically ("Verkauft (Marktplatz)").

ALTER TABLE public.marketplace_listings ADD COLUMN IF NOT EXISTS school_equipment_id uuid
  REFERENCES public.school_equipment(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS marketplace_listings_one_per_equipment ON public.marketplace_listings (school_equipment_id)
  WHERE school_equipment_id IS NOT NULL AND status IN ('draft', 'active', 'reserved');

CREATE OR REPLACE FUNCTION public.marketplace_equipment_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.school_equipment_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.school_equipment_id IS DISTINCT FROM OLD.school_equipment_id) THEN
    IF NEW.seller_group_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.school_equipment e WHERE e.id = NEW.school_equipment_id AND e.group_id = NEW.seller_group_id) THEN
      RAISE EXCEPTION 'marketplace:equipment_other_school' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.marketplace_equipment_guard() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_marketplace_equipment_guard ON public.marketplace_listings;
CREATE TRIGGER trg_marketplace_equipment_guard BEFORE INSERT OR UPDATE OF school_equipment_id, seller_group_id ON public.marketplace_listings
  FOR EACH ROW EXECUTE FUNCTION public.marketplace_equipment_guard();

-- Sold → the piece leaves the inventory.
CREATE OR REPLACE FUNCTION public.marketplace_retire_sold_equipment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'sold' AND OLD.status IS DISTINCT FROM 'sold' AND NEW.school_equipment_id IS NOT NULL THEN
    UPDATE public.school_equipment SET status = 'retired', retired_at = current_date, retire_reason = 'Verkauft (Marktplatz)'
    WHERE id = NEW.school_equipment_id AND status <> 'retired';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.marketplace_retire_sold_equipment() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_marketplace_retire_sold_equipment ON public.marketplace_listings;
CREATE TRIGGER trg_marketplace_retire_sold_equipment AFTER UPDATE OF status ON public.marketplace_listings
  FOR EACH ROW EXECUTE FUNCTION public.marketplace_retire_sold_equipment();
