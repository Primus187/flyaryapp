-- Abschnitt 8.3 (Notfall-Schnellzugriff) + 12.3 (Zugriffsprotokollierung sensibler Daten)
--
-- profiles.emergency_contact_name/phone/blood_type/allergies/medical_notes sind seit der
-- Migration 20260417064846 per REVOKE SELECT auf Spaltenebene für authenticated/anon gesperrt;
-- Zeilenrechte allein (die "Group members can view profiles"-Policy) reichen dafür nicht mehr aus.
-- Direkter Client-Read scheidet also aus. Stattdessen: eine SECURITY DEFINER-RPC, die Berechtigung
-- prüft, die Daten liest UND den Zugriff protokolliert - alles in einem serverseitigen Schritt, damit
-- keine Lücke zwischen Lesen und Protokollieren entstehen kann.
--
-- Berechtigt ist Team-Personal (is_group_staff) der Gruppe des Termins, und nur für Personen, die
-- tatsächlich für diesen Termin angemeldet sind (an die Teilnehmerliste gebunden, wie im Akzeptanz-
-- kriterium gefordert). blood_type/allergies/medical_notes werden zusätzlich nur zurückgegeben, wenn
-- die betroffene Person die Gesundheitsdaten-Einwilligung (health_data_consent_at) erteilt hat;
-- Notfallkontakt (Name/Telefon) ist davon unabhängig, da er für den Ernstfall unverzichtbar ist.
--
-- Das Zugriffsprotokoll bekommt eine eigene group_id-Spalte (zusätzlich zu context_event_id), damit
-- die "nur für Schulleitung"-Policy stabil bleibt, auch falls ein Termin später gelöscht wird.

CREATE TABLE public.emergency_data_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  accessed_by uuid NOT NULL,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  context_event_id uuid REFERENCES public.flight_events(id) ON DELETE SET NULL,
  accessed_at timestamptz NOT NULL DEFAULT now()
);

-- Kein INSERT/UPDATE/DELETE-Grant an authenticated: Zeilen entstehen ausschliesslich über die
-- SECURITY-DEFINER-Funktion unten (analog zum bestehenden Muster bei public.notifications).
GRANT SELECT ON public.emergency_data_access_log TO authenticated;
GRANT ALL ON public.emergency_data_access_log TO service_role;
ALTER TABLE public.emergency_data_access_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School leadership views access log" ON public.emergency_data_access_log
  FOR SELECT TO authenticated
  USING (
    public.is_group_admin(auth.uid(), group_id)
    OR public.has_group_function(auth.uid(), group_id, 'school_lead')
  );

CREATE INDEX idx_emergency_data_access_log_group ON public.emergency_data_access_log(group_id);
CREATE INDEX idx_emergency_data_access_log_profile ON public.emergency_data_access_log(profile_id);

CREATE OR REPLACE FUNCTION public.get_emergency_contact_info(_event_id uuid, _target_user_id uuid)
RETURNS TABLE(
  emergency_contact_name text,
  emergency_contact_phone text,
  blood_type text,
  allergies text,
  medical_notes text,
  health_data_consent_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _group_id uuid;
BEGIN
  SELECT fe.group_id INTO _group_id FROM public.flight_events fe WHERE fe.id = _event_id;
  IF _group_id IS NULL THEN
    RAISE EXCEPTION 'event not found';
  END IF;

  IF NOT public.is_group_staff(auth.uid(), _group_id) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.event_signups es
    WHERE es.event_id = _event_id AND es.user_id = _target_user_id AND es.signed_up = true
  ) THEN
    RAISE EXCEPTION 'target is not a participant of this event';
  END IF;

  INSERT INTO public.emergency_data_access_log (profile_id, accessed_by, group_id, context_event_id)
  VALUES (_target_user_id, auth.uid(), _group_id, _event_id);

  RETURN QUERY
  SELECT
    p.emergency_contact_name,
    p.emergency_contact_phone,
    CASE WHEN p.health_data_consent_at IS NOT NULL THEN p.blood_type ELSE NULL END,
    CASE WHEN p.health_data_consent_at IS NOT NULL THEN p.allergies ELSE NULL END,
    CASE WHEN p.health_data_consent_at IS NOT NULL THEN p.medical_notes ELSE NULL END,
    p.health_data_consent_at
  FROM public.profiles p
  WHERE p.user_id = _target_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_emergency_contact_info(uuid, uuid) TO authenticated;
