-- XContest passwords were stored as plain Base64 written by the browser (btoa) and returned to the
-- browser by get_own_profile_private(). From now on only the sync-xcontest edge function writes the
-- column, AES-GCM encrypted with the XCONTEST_ENCRYPTION_KEY secret; legacy Base64 values are
-- re-encrypted on their next sync.

-- Clients (PostgREST roles anon/authenticated) may only clear the password, never set it. The
-- edge function uses the service role; migrations and scripts run as postgres. Not SECURITY
-- DEFINER, so current_user is the calling role. Raises instead of silently keeping the old value,
-- so a stale app version reports the failed save.
CREATE OR REPLACE FUNCTION public.protect_xcontest_password()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated')
     AND NEW.xcontest_password_encrypted IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.xcontest_password_encrypted IS DISTINCT FROM OLD.xcontest_password_encrypted) THEN
    RAISE EXCEPTION 'XContest password can only be saved through the app server; please update the app'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS protect_xcontest_password ON public.profiles;
CREATE TRIGGER protect_xcontest_password
  BEFORE INSERT OR UPDATE OF xcontest_password_encrypted ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_xcontest_password();

-- The owner only learns whether a password is stored. The return type changes, hence DROP.
DROP FUNCTION IF EXISTS public.get_own_profile_private();
CREATE FUNCTION public.get_own_profile_private()
RETURNS TABLE(
  blood_type text,
  medical_notes text,
  allergies text,
  emergency_contact_name text,
  emergency_contact_phone text,
  xcontest_username text,
  has_xcontest_password boolean,
  shv_number text,
  health_data_consent_at timestamp with time zone,
  exam_theory_date date,
  exam_practical_date date
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT blood_type, medical_notes, allergies,
         emergency_contact_name, emergency_contact_phone,
         xcontest_username, xcontest_password_encrypted IS NOT NULL,
         shv_number, health_data_consent_at,
         exam_theory_date, exam_practical_date
  FROM public.profiles
  WHERE user_id = auth.uid();
$$;

REVOKE EXECUTE ON FUNCTION public.get_own_profile_private() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_own_profile_private() TO authenticated;
