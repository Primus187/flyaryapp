-- Marketplace (plan 4.10): one-time confirmation of the marketplace rules before the first listing.
--   The app shows the rules (truthful details, mark unairworthy gear as "for parts", Flyary only connects
--   buyers and sellers) and stores the confirmed version here, so it can be shown later who agreed to what.
--   Creating a listing requires the current version (1). A new version of the rules means a new number
--   here and in src/lib/marketplace-terms.ts; everyone confirms again before their next listing.

CREATE TABLE IF NOT EXISTS public.marketplace_terms_acceptances (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  version integer NOT NULL CHECK (version >= 1),
  accepted_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.marketplace_terms_acceptances ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.marketplace_terms_acceptances FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.marketplace_terms_acceptances TO authenticated;
CREATE POLICY "Own confirmation" ON public.marketplace_terms_acceptances FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.market_terms_accepted(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.marketplace_terms_acceptances WHERE user_id = _uid AND version >= 1);
$$;
REVOKE ALL ON FUNCTION public.market_terms_accepted(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.market_terms_accepted(uuid) TO authenticated;

DROP POLICY IF EXISTS "Create draft listings" ON public.marketplace_listings;
CREATE POLICY "Create draft listings" ON public.marketplace_listings FOR INSERT TO authenticated WITH CHECK (
  status = 'draft' AND published_at IS NULL AND expires_at IS NULL AND bumped_at IS NULL
  AND featured_until IS NULL AND removed_reason IS NULL
  AND created_by = auth.uid()
  AND NOT public.is_market_banned(auth.uid())
  AND public.market_terms_accepted(auth.uid())
  AND public.market_can_manage(auth.uid(), seller_user_id, seller_group_id));
