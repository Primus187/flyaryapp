-- Abschnitt 6.3: Interner Team-Kanal
--
-- Der Plan schlägt eine dedizierte "Team"-Gruppe pro Schule vor (Wiederverwendung von
-- group_messages, keine neue Tabelle). Eine echte zusätzliche groups-Zeile hätte aber gepflegte
-- Mitgliedschaft (synchron zu group_member_functions) gebraucht und wäre in mehreren anderen
-- Gruppenlisten der App aufgetaucht (Groups.tsx, EventForm-Gruppenauswahl, SchoolDashboard-
-- Schulauswahl), die alle nicht wissen, dass es sich um einen internen Hilfs-Datensatz handelt.
--
-- Stattdessen: group_messages.is_team_only, geprüft live über group_member_functions bei jedem
-- Zugriff (wie is_group_staff), ohne Mitgliedschaft zu duplizieren/synchronisieren. group_messages
-- selbst bleibt unverändert wiederverwendet, wie im Plan gefordert - nur die Sichtbarkeitsregel
-- kommt hinzu.

CREATE OR REPLACE FUNCTION public.is_group_team_member(_user_id uuid, _group_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_group_admin(_user_id, _group_id)
    OR EXISTS (
      SELECT 1 FROM public.group_member_functions
      WHERE user_id = _user_id AND group_id = _group_id
        AND function IN ('instructor', 'school_lead', 'launch_helper')
    )
$$;
REVOKE EXECUTE ON FUNCTION public.is_group_team_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_group_team_member(uuid, uuid) TO authenticated;

ALTER TABLE public.group_messages
  ADD COLUMN IF NOT EXISTS is_team_only boolean NOT NULL DEFAULT false;

DROP POLICY IF EXISTS "Members read chat" ON public.group_messages;
CREATE POLICY "Members read chat" ON public.group_messages
  FOR SELECT TO authenticated
  USING (
    public.is_group_member(auth.uid(), group_id)
    AND (NOT is_team_only OR public.is_group_team_member(auth.uid(), group_id))
  );

DROP POLICY IF EXISTS "Members write chat" ON public.group_messages;
CREATE POLICY "Members write chat" ON public.group_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.is_group_member(auth.uid(), group_id)
    AND (NOT is_announcement OR public.is_group_staff(auth.uid(), group_id))
    AND (NOT is_team_only OR public.is_group_team_member(auth.uid(), group_id))
  );

-- Push-Empfänger für Ankündigungen: bei is_team_only nur an Teamfunktionen, sonst unverändert
-- an alle Gruppenmitglieder (gleiche Push-Mechanik, jetzt team-bewusst statt zu leaken).
CREATE OR REPLACE FUNCTION public.push_on_group_announcement()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _member record;
  _author text;
  _group_name text;
BEGIN
  IF NOT NEW.is_announcement THEN RETURN NEW; END IF;
  SELECT COALESCE(NULLIF(pilot_name, ''), 'Jemand') INTO _author FROM public.profiles WHERE user_id = NEW.user_id;
  SELECT name INTO _group_name FROM public.groups WHERE id = NEW.group_id;
  FOR _member IN
    SELECT gm.user_id FROM public.group_members gm
    WHERE gm.group_id = NEW.group_id AND gm.user_id <> NEW.user_id
      AND (NOT NEW.is_team_only OR public.is_group_team_member(gm.user_id, NEW.group_id))
  LOOP
    PERFORM public.send_push_notification(
      _member.user_id,
      'Ankündigung: ' || COALESCE(_group_name, 'Gruppe'),
      _author || ': ' || LEFT(NEW.message, 120),
      '/groups/' || NEW.group_id
    );
  END LOOP;
  RETURN NEW;
END;
$$;
