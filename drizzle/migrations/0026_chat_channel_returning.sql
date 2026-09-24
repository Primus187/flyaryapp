-- Fix for 0025: creating a channel failed with "new row violates row-level security policy".
-- The app inserts and reads the row back in one statement (INSERT ... RETURNING). The SELECT
-- policy called chat_can_read(), which looks the channel up by id - but a function cannot see the
-- row its own statement is inserting, so the check failed. Staff visibility is now decided from the
-- row's own columns (staff see every group/event channel of their group anyway); everyone else
-- still goes through chat_can_read().
DROP POLICY IF EXISTS "Read accessible channels" ON public.chat_channels;
CREATE POLICY "Read accessible channels" ON public.chat_channels FOR SELECT TO authenticated
  USING ((kind <> 'direct' AND public.is_group_staff(auth.uid(), group_id)) OR public.chat_can_read(auth.uid(), id));
