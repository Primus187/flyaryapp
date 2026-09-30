-- Betriebsbereich step 5 (plan "Umsetzungsplan Betriebsbereich", §8): Flyary admin rights need the second
-- factor. A stolen Google sign-in alone can no longer create schools, grant or pause access, read the error
-- log, the test list or feedback.
--
-- Since 0083 every operator policy and function asks is_ops_admin(); requiring assurance level aal2 there
-- (a session confirmed with a TOTP code, Supabase Auth MFA) covers all of them at once.
-- is_admin_role() tells the app "admin, but not confirmed with the second factor yet", so it can ask for the
-- code instead of hiding the Betriebsbereich. It grants nothing by itself.
-- Decision 2026-09-30: only for Flyary admins, not for school leads.

CREATE OR REPLACE FUNCTION public.is_ops_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin')
    AND COALESCE(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;

CREATE OR REPLACE FUNCTION public.is_admin_role()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin');
$$;
REVOKE ALL ON FUNCTION public.is_admin_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin_role() TO authenticated;
