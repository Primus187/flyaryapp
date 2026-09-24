-- Marketplace (plan 4.1): listings and access rules.
--   Private listing: seller_user_id = owner, seller_group_id NULL. Deleted with the account.
--   School listing:  seller_group_id = school, seller_user_id NULL. Managed by the school's admins and
--                    members with function school_lead or shop; survives when the person who created it leaves.
--   Reading: active/reserved listings that have not expired are visible to every signed-in person
--   ('school_students' only to members of the selling school). Everything else only to whoever manages
--   the listing and to the global moderation (app_role admin/moderator; school moderators follow in 4.8).
--   Writing: new listings start as drafts. Status, dates and seller columns are not updatable by clients;
--   they change only through the marketplace RPCs (plan 4.4). Banned people cannot create listings.

-- ── Bans (only the admin sets them, plan 4.8) ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.marketplace_bans (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  until timestamptz,                -- NULL = indefinitely
  reason text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.marketplace_bans ENABLE ROW LEVEL SECURITY;

-- ── Helper functions ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_market_banned(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.marketplace_bans WHERE user_id = _uid AND (until IS NULL OR until > now()));
$$;

-- Global moderation (Flyary admins and moderators).
CREATE OR REPLACE FUNCTION public.is_market_staff(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_uid, 'admin') OR public.has_role(_uid, 'moderator');
$$;

-- May _uid act for the seller? Private: the owner. School: admins, school leads and the shop team.
CREATE OR REPLACE FUNCTION public.market_can_manage(_uid uuid, _seller_user uuid, _seller_group uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN _uid IS NULL THEN false
    WHEN _seller_group IS NULL THEN _uid = _seller_user
    ELSE public.is_group_admin(_uid, _seller_group)
      OR public.has_group_function(_uid, _seller_group, 'school_lead')
      OR public.has_group_function(_uid, _seller_group, 'shop')
  END;
$$;

REVOKE ALL ON FUNCTION public.is_market_banned(uuid), public.is_market_staff(uuid),
  public.market_can_manage(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_market_banned(uuid), public.is_market_staff(uuid),
  public.market_can_manage(uuid, uuid, uuid) TO authenticated;

CREATE POLICY "Own ban or market staff can read bans" ON public.marketplace_bans
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_market_staff(auth.uid()));
CREATE POLICY "Admins manage bans" ON public.marketplace_bans
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ── Listings ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.marketplace_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  listing_type text NOT NULL DEFAULT 'offer' CHECK (listing_type IN ('offer', 'wanted')),
  category text NOT NULL CHECK (category IN
    ('glider', 'tandem', 'harness', 'reserve', 'instrument', 'helmet', 'clothing', 'other')),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 3 AND 80),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 4000),
  price_cents integer CHECK (price_cents BETWEEN 0 AND 10000000),   -- CHF in Rappen, max. CHF 100'000
  price_type text NOT NULL DEFAULT 'fixed' CHECK (price_type IN ('fixed', 'negotiable', 'free', 'on_request')),
  condition text CHECK (condition IN ('new', 'like_new', 'used', 'for_parts')),
  manufacturer text CHECK (char_length(manufacturer) <= 60),
  model text CHECK (char_length(model) <= 60),
  size text CHECK (char_length(size) <= 20),
  year smallint CHECK (year BETWEEN 1980 AND 2100),
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(attributes) = 'object'),
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  postal_code text CHECK (postal_code ~ '^[0-9]{4,5}$'),
  locality text CHECK (char_length(locality) <= 80),
  canton text CHECK (char_length(canton) <= 40),
  delivery text NOT NULL DEFAULT 'pickup' CHECK (delivery IN ('pickup', 'shipping', 'both')),
  visibility text NOT NULL DEFAULT 'all' CHECK (visibility IN ('all', 'school_students')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'reserved', 'sold', 'expired', 'removed')),
  removed_reason text,
  published_at timestamptz,
  expires_at timestamptz,
  bumped_at timestamptz,
  featured_until timestamptz,       -- for a later paid add-on (plan 8.3), unused for now
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  search_vector tsvector GENERATED ALWAYS AS (to_tsvector('simple',
    coalesce(title, '') || ' ' || coalesce(manufacturer, '') || ' ' || coalesce(model, '') || ' ' ||
    coalesce(size, '') || ' ' || coalesce(description, ''))) STORED,
  -- exactly one seller: a person or a school
  CONSTRAINT marketplace_listings_one_seller CHECK ((seller_user_id IS NULL) <> (seller_group_id IS NULL)),
  -- only schools sell several pieces or restrict a listing to their students
  CONSTRAINT marketplace_listings_school_only CHECK (
    seller_group_id IS NOT NULL OR (quantity <= 1 AND visibility = 'all')),
  CONSTRAINT marketplace_listings_free_price CHECK (price_type <> 'free' OR coalesce(price_cents, 0) = 0)
);
ALTER TABLE public.marketplace_listings ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS marketplace_listings_browse ON public.marketplace_listings (status, bumped_at DESC, id);
CREATE INDEX IF NOT EXISTS marketplace_listings_seller_user ON public.marketplace_listings (seller_user_id) WHERE seller_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS marketplace_listings_seller_group ON public.marketplace_listings (seller_group_id) WHERE seller_group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS marketplace_listings_search ON public.marketplace_listings USING gin (search_vector);

-- Selling group must be a school; keep updated_at current.
CREATE OR REPLACE FUNCTION public.marketplace_listing_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.seller_group_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.seller_group_id IS DISTINCT FROM OLD.seller_group_id)
     AND NOT EXISTS (SELECT 1 FROM public.groups WHERE id = NEW.seller_group_id AND group_type = 'school') THEN
    RAISE EXCEPTION 'only flight schools can sell as a group' USING ERRCODE = '23514';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.marketplace_listing_guard() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_marketplace_listing_guard ON public.marketplace_listings;
CREATE TRIGGER trg_marketplace_listing_guard BEFORE INSERT OR UPDATE ON public.marketplace_listings
  FOR EACH ROW EXECUTE FUNCTION public.marketplace_listing_guard();

-- Privileges: nothing for anon; clients may only update the content columns.
REVOKE ALL ON public.marketplace_listings, public.marketplace_bans FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.marketplace_listings TO authenticated;
GRANT UPDATE (listing_type, category, title, description, price_cents, price_type, condition, manufacturer,
  model, size, year, attributes, quantity, postal_code, locality, canton, delivery, visibility)
  ON public.marketplace_listings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketplace_bans TO authenticated;

CREATE POLICY "Visible listings" ON public.marketplace_listings FOR SELECT TO authenticated USING (
  public.market_can_manage(auth.uid(), seller_user_id, seller_group_id)
  OR public.is_market_staff(auth.uid())
  OR (status IN ('active', 'reserved')
      AND (expires_at IS NULL OR expires_at > now())
      AND (visibility = 'all' OR public.is_group_member(auth.uid(), seller_group_id))));

CREATE POLICY "Create draft listings" ON public.marketplace_listings FOR INSERT TO authenticated WITH CHECK (
  status = 'draft' AND published_at IS NULL AND expires_at IS NULL AND bumped_at IS NULL
  AND featured_until IS NULL AND removed_reason IS NULL
  AND created_by = auth.uid()
  AND NOT public.is_market_banned(auth.uid())
  AND public.market_can_manage(auth.uid(), seller_user_id, seller_group_id));

CREATE POLICY "Edit own listings" ON public.marketplace_listings FOR UPDATE TO authenticated
  USING (public.market_can_manage(auth.uid(), seller_user_id, seller_group_id))
  WITH CHECK (public.market_can_manage(auth.uid(), seller_user_id, seller_group_id));

CREATE POLICY "Delete own listings" ON public.marketplace_listings FOR DELETE TO authenticated
  USING (public.market_can_manage(auth.uid(), seller_user_id, seller_group_id));
