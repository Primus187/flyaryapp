-- Marketplace (plan 4.7): school shop with the details a commercial seller has to show.
--   school_shop_profiles: company, address, UID, VAT, contact, warranty text. "active" is only possible
--   when every required field is filled (CHECK), so an active profile is always complete.
--   Admins and school leads edit the profile; the shop team only sells (they can read it).
--   School listings can only be published or renewed while the shop is active, and are only visible to
--   others while it is (market_listing_visible) – without the legal details they are not shown.
--   marketplace_my_shops: schools whose listings the caller manages, for "Verkaufen als" in the form.

CREATE TABLE IF NOT EXISTS public.school_shop_profiles (
  group_id uuid PRIMARY KEY REFERENCES public.groups(id) ON DELETE CASCADE,
  legal_name text NOT NULL DEFAULT '' CHECK (char_length(legal_name) <= 120),
  street text NOT NULL DEFAULT '' CHECK (char_length(street) <= 120),
  postal_code text NOT NULL DEFAULT '' CHECK (postal_code = '' OR postal_code ~ '^[0-9]{4,5}$'),
  locality text NOT NULL DEFAULT '' CHECK (char_length(locality) <= 80),
  uid_number text CHECK (uid_number ~ '^CHE-[0-9]{3}\.[0-9]{3}\.[0-9]{3}$'),
  vat_registered boolean NOT NULL DEFAULT false,
  email text NOT NULL DEFAULT '' CHECK (char_length(email) <= 120),
  phone text CHECK (char_length(phone) <= 40),
  warranty_text text NOT NULL DEFAULT '' CHECK (char_length(warranty_text) <= 2000),
  active boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  CONSTRAINT school_shop_profiles_vat_uid CHECK (NOT vat_registered OR uid_number IS NOT NULL),
  CONSTRAINT school_shop_profiles_complete CHECK (NOT active OR (
    btrim(legal_name) <> '' AND btrim(street) <> '' AND postal_code <> '' AND btrim(locality) <> ''
    AND email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' AND btrim(warranty_text) <> ''))
);
ALTER TABLE public.school_shop_profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.school_shop_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.groups WHERE id = NEW.group_id AND group_type = 'school') THEN
    RAISE EXCEPTION 'only flight schools have a shop' USING ERRCODE = '23514';
  END IF;
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.school_shop_guard() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_school_shop_guard ON public.school_shop_profiles;
CREATE TRIGGER trg_school_shop_guard BEFORE INSERT OR UPDATE ON public.school_shop_profiles
  FOR EACH ROW EXECUTE FUNCTION public.school_shop_guard();

-- Legal details are decided by the school's admins and school leads.
CREATE OR REPLACE FUNCTION public.market_can_admin_shop(_uid uuid, _group uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _uid IS NOT NULL AND (public.is_group_admin(_uid, _group) OR public.has_group_function(_uid, _group, 'school_lead'));
$$;

CREATE OR REPLACE FUNCTION public.market_shop_ready(_group uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.school_shop_profiles WHERE group_id = _group AND active);
$$;

REVOKE ALL ON FUNCTION public.market_can_admin_shop(uuid, uuid), public.market_shop_ready(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.market_can_admin_shop(uuid, uuid), public.market_shop_ready(uuid) TO authenticated;

REVOKE ALL ON public.school_shop_profiles FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.school_shop_profiles TO authenticated;
CREATE POLICY "Active shops are public, the school's sellers see their own" ON public.school_shop_profiles
  FOR SELECT TO authenticated USING (active OR public.market_can_manage(auth.uid(), NULL, group_id));
CREATE POLICY "School admins create the shop" ON public.school_shop_profiles
  FOR INSERT TO authenticated WITH CHECK (public.market_can_admin_shop(auth.uid(), group_id));
CREATE POLICY "School admins edit the shop" ON public.school_shop_profiles
  FOR UPDATE TO authenticated USING (public.market_can_admin_shop(auth.uid(), group_id))
  WITH CHECK (public.market_can_admin_shop(auth.uid(), group_id));

-- ── Visibility: school listings only with an active shop ────────────────────
CREATE OR REPLACE FUNCTION public.market_listing_visible(_uid uuid, l public.marketplace_listings)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _uid IS NOT NULL AND (
    public.market_can_manage(_uid, l.seller_user_id, l.seller_group_id)
    OR public.is_market_staff(_uid)
    OR (l.status IN ('active', 'reserved')
        AND (l.expires_at IS NULL OR l.expires_at > now())
        AND (l.seller_group_id IS NULL OR public.market_shop_ready(l.seller_group_id))
        AND (l.visibility = 'all' OR public.is_group_member(_uid, l.seller_group_id))));
$$;

-- ── Publishing and renewing: school listings need an active shop ────────────
CREATE OR REPLACE FUNCTION public.marketplace_publish(_listing uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  l public.marketplace_listings := public.marketplace_locked_listing(_listing);
  a jsonb := l.attributes;
  _missing text;
BEGIN
  IF public.is_market_banned(auth.uid()) THEN RAISE EXCEPTION 'marketplace:banned' USING ERRCODE = '42501'; END IF;
  IF l.status <> 'draft' THEN RAISE EXCEPTION 'marketplace:wrong_status' USING ERRCODE = '22023'; END IF;
  IF l.seller_group_id IS NOT NULL AND NOT public.market_shop_ready(l.seller_group_id) THEN
    RAISE EXCEPTION 'marketplace:shop_not_ready' USING ERRCODE = '23514';
  END IF;

  _missing := CASE
    WHEN l.postal_code IS NULL OR coalesce(btrim(l.locality), '') = '' THEN 'missing_place'
    WHEN l.listing_type = 'wanted' THEN NULL
    WHEN l.price_type IN ('fixed', 'negotiable') AND coalesce(l.price_cents, 0) <= 0 THEN 'missing_price'
    WHEN l.condition IS NULL THEN 'missing_condition'
    WHEN l.category IN ('glider', 'tandem') AND NOT a ? 'certification' THEN 'missing_attributes'
    WHEN l.category = 'harness' AND NOT a ? 'harness_type' THEN 'missing_attributes'
    WHEN l.category = 'reserve' AND NOT (a ? 'reserve_type' AND a ? 'max_load') THEN 'missing_attributes'
    WHEN l.category = 'instrument' AND NOT a ? 'instrument_type' THEN 'missing_attributes'
    WHEN NOT EXISTS (SELECT 1 FROM public.marketplace_listing_photos WHERE listing_id = l.id) THEN 'missing_photo'
  END;
  IF _missing IS NOT NULL THEN RAISE EXCEPTION 'marketplace:%', _missing USING ERRCODE = '23514'; END IF;

  PERFORM public.marketplace_check_active_limit(l);
  IF l.seller_group_id IS NULL AND (SELECT count(*) FROM public.marketplace_listings o
      WHERE o.seller_user_id = l.seller_user_id AND o.published_at > now() - interval '24 hours') >= 5 THEN
    RAISE EXCEPTION 'marketplace:limit_daily' USING ERRCODE = '23514';
  END IF;

  UPDATE public.marketplace_listings SET status = 'active', published_at = now(), bumped_at = now(),
    expires_at = public.marketplace_expiry(l)
  WHERE id = l.id RETURNING * INTO l;
  RETURN jsonb_build_object('status', l.status, 'expires_at', l.expires_at, 'bumped_at', l.bumped_at);
END;
$$;

CREATE OR REPLACE FUNCTION public.marketplace_renew(_listing uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  l public.marketplace_listings := public.marketplace_locked_listing(_listing);
  _was_expired boolean := l.status = 'expired' OR (l.status IN ('active', 'reserved') AND l.expires_at <= now());
BEGIN
  IF public.is_market_banned(auth.uid()) THEN RAISE EXCEPTION 'marketplace:banned' USING ERRCODE = '42501'; END IF;
  IF l.status NOT IN ('active', 'reserved', 'expired') THEN
    RAISE EXCEPTION 'marketplace:wrong_status' USING ERRCODE = '22023';
  END IF;
  IF l.seller_group_id IS NOT NULL AND NOT public.market_shop_ready(l.seller_group_id) THEN
    RAISE EXCEPTION 'marketplace:shop_not_ready' USING ERRCODE = '23514';
  END IF;
  IF _was_expired THEN PERFORM public.marketplace_check_active_limit(l); END IF;
  UPDATE public.marketplace_listings SET
    status = CASE WHEN status = 'expired' THEN 'active' ELSE status END,
    expires_at = public.marketplace_expiry(l),
    bumped_at = CASE WHEN _was_expired THEN now() ELSE bumped_at END
  WHERE id = l.id RETURNING * INTO l;
  RETURN jsonb_build_object('status', l.status, 'expires_at', l.expires_at, 'bumped_at', l.bumped_at);
END;
$$;

-- Schools the caller sells for, with whether the shop is active and whether the caller may edit it.
CREATE OR REPLACE FUNCTION public.marketplace_my_shops()
RETURNS TABLE (group_id uuid, name text, ready boolean, can_admin boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT g.id, g.name, public.market_shop_ready(g.id), public.market_can_admin_shop(auth.uid(), g.id)
  FROM public.groups g
  WHERE g.group_type = 'school' AND public.market_can_manage(auth.uid(), NULL, g.id)
  ORDER BY g.name;
$$;
REVOKE ALL ON FUNCTION public.marketplace_my_shops() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marketplace_my_shops() TO authenticated;
