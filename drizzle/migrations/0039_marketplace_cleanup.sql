-- Marketplace (plan 4.9): daily cleanup and storage monitoring (Supabase Free plan, decision E7).
--   marketplace_daily_cleanup() – called once a day by the Edge Function marketplace-cleanup (service role):
--     1. active/reserved listings past their end become 'expired'
--     2. a reminder (bell + push) 3 days before the end, once per running time (renewing starts a new one)
--     3. photos of listings sold > 14 days ago, hidden by moderation > 14 days ago or expired > 30 days ago:
--        photo rows deleted, file paths returned
--     4. drafts untouched for 30 days are deleted with their photos
--     5. orphaned files (listing gone, or a file no photo row points to after a day) are returned too
--   The database cannot delete storage files itself (only through the Storage API), so it returns the paths
--   and the Edge Function removes them.
--   marketplace_storage_usage() – bytes per bucket for Flyary admins (Free plan: 1 GB).

ALTER TABLE public.marketplace_listings ADD COLUMN IF NOT EXISTS expiry_reminded_at timestamptz;

CREATE OR REPLACE FUNCTION public.marketplace_daily_cleanup()
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _expired integer;
  _reminded integer := 0;
  _drafts integer;
  _paths text[] := '{}';
  _r record;
  _to uuid;
BEGIN
  -- 1. running time over
  UPDATE public.marketplace_listings SET status = 'expired'
  WHERE status IN ('active', 'reserved') AND expires_at IS NOT NULL AND expires_at <= now();
  GET DIAGNOSTICS _expired = ROW_COUNT;

  -- 2. reminder 3 days before the end
  FOR _r IN
    SELECT id, title, seller_user_id, created_by, expires_at FROM public.marketplace_listings
    WHERE status IN ('active', 'reserved') AND expires_at > now() AND expires_at <= now() + interval '3 days'
      AND (expiry_reminded_at IS NULL OR expiry_reminded_at < expires_at - interval '4 days')
  LOOP
    _to := coalesce(_r.seller_user_id, _r.created_by);
    IF _to IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, actor_id, type, reference_id, reference_type)
      VALUES (_to, NULL, 'market_expiring', _r.id, 'listing');
      PERFORM public.send_push_notification(_to, 'Anzeige läuft bald ab', left(_r.title, 80) || ' – jetzt verlängern?', '/market/mine');
      _reminded := _reminded + 1;
    END IF;
    UPDATE public.marketplace_listings SET expiry_reminded_at = now() WHERE id = _r.id;
  END LOOP;

  -- 3. photos of finished listings
  WITH gone AS (
    DELETE FROM public.marketplace_listing_photos ph USING public.marketplace_listings l
    WHERE ph.listing_id = l.id AND (
      (l.status = 'sold' AND l.updated_at < now() - interval '14 days')
      OR (l.status = 'removed' AND l.removed_at < now() - interval '14 days')
      OR (l.status = 'expired' AND l.expires_at < now() - interval '30 days'))
    RETURNING ph.path, ph.thumb_path)
  SELECT _paths || coalesce(array_agg(p), '{}') INTO _paths FROM gone, LATERAL unnest(ARRAY[gone.path, gone.thumb_path]) p;

  -- 4. abandoned drafts
  SELECT _paths || coalesce(array_agg(p), '{}') INTO _paths
  FROM public.marketplace_listing_photos ph JOIN public.marketplace_listings l ON l.id = ph.listing_id,
    LATERAL unnest(ARRAY[ph.path, ph.thumb_path]) p
  WHERE l.status = 'draft' AND l.updated_at < now() - interval '30 days';
  DELETE FROM public.marketplace_listings WHERE status = 'draft' AND updated_at < now() - interval '30 days';
  GET DIAGNOSTICS _drafts = ROW_COUNT;

  -- 5. orphaned files (at most 1000 per run)
  SELECT _paths || coalesce(array_agg(o.name), '{}') INTO _paths FROM (
    SELECT o.name FROM storage.objects o
    WHERE o.bucket_id = 'marketplace-photos'
      AND (NOT EXISTS (SELECT 1 FROM public.marketplace_listings l WHERE l.id = public.market_photo_listing(o.name))
        OR (o.created_at < now() - interval '1 day'
            AND NOT EXISTS (SELECT 1 FROM public.marketplace_listing_photos ph WHERE o.name IN (ph.path, ph.thumb_path))))
    LIMIT 1000) o;

  RETURN jsonb_build_object('expired', _expired, 'reminded', _reminded, 'deleted_drafts', _drafts,
    'paths', to_jsonb(ARRAY(SELECT DISTINCT unnest(_paths))));
END;
$$;
-- Service role only (the Edge Function); never callable from the app.
REVOKE ALL ON FUNCTION public.marketplace_daily_cleanup() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.marketplace_storage_usage()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'marketplace:not_allowed' USING ERRCODE = '42501'; END IF;
  RETURN (SELECT jsonb_build_object(
    'total_bytes', coalesce(sum((o.metadata->>'size')::bigint), 0),
    'buckets', coalesce((SELECT jsonb_object_agg(b.bucket_id, b.bytes) FROM (
      SELECT bucket_id, sum((metadata->>'size')::bigint) AS bytes FROM storage.objects GROUP BY bucket_id) b), '{}'::jsonb))
    FROM storage.objects o);
END;
$$;
REVOKE ALL ON FUNCTION public.marketplace_storage_usage() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marketplace_storage_usage() TO authenticated;
