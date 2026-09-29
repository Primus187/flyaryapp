-- Fix of 0074 (reported 2026-09-29): a school admin without the instructor function could not
-- confirm flights, even with a valid instructor certificate. Rule now: every member of the school
-- staff (is_group_staff = admin, school lead or instructor; launch helpers are not staff) with a
-- certificate for the flight's discipline valid today may confirm, never the own flight.
-- The certificate stays the proof of the qualification; the function alone is not enough.

CREATE OR REPLACE FUNCTION public.can_confirm_training(_user_id uuid, _group_id uuid, _discipline text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id IS NOT NULL AND _group_id IS NOT NULL
    AND public.is_group_staff(_user_id, _group_id)
    AND EXISTS (SELECT 1 FROM public.instructor_certifications
                WHERE user_id = _user_id AND group_id = _group_id
                  AND cert_type = public.instructor_cert_for(_discipline)
                  AND valid_until >= current_date);
$$;

NOTIFY pgrst, 'reload schema';
