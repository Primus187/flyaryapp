-- chat-attachments bucket: path chat/<group_id>/<user_id>/<file>
CREATE POLICY "Group members upload chat attachments" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chat-attachments'
    AND (storage.foldername(name))[1] = 'chat'
    AND (storage.foldername(name))[3] = auth.uid()::text
    AND public.is_group_member(auth.uid(), ((storage.foldername(name))[2])::uuid)
  );
CREATE POLICY "Group members read chat attachments" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'chat-attachments'
    AND (storage.foldername(name))[1] = 'chat'
    AND public.is_group_member(auth.uid(), ((storage.foldername(name))[2])::uuid)
  );
CREATE POLICY "Uploader or staff delete chat attachments" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'chat-attachments'
    AND (
      (storage.foldername(name))[3] = auth.uid()::text
      OR public.is_group_staff(auth.uid(), ((storage.foldername(name))[2])::uuid)
    )
  );

-- Announcement push to all group members
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
  FOR _member IN SELECT user_id FROM public.group_members WHERE group_id = NEW.group_id AND user_id <> NEW.user_id LOOP
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

CREATE TRIGGER trg_push_on_group_announcement
  AFTER INSERT ON public.group_messages
  FOR EACH ROW EXECUTE FUNCTION public.push_on_group_announcement();