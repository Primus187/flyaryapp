
-- Fix overly permissive notification insert policy
DROP POLICY "Authenticated can insert notifications" ON public.notifications;

-- Notifications are inserted by SECURITY DEFINER trigger functions,
-- so no direct user insert is needed. But allow actor_id = auth.uid() as fallback.
CREATE POLICY "Users can insert notifications as actor"
ON public.notifications FOR INSERT TO authenticated
WITH CHECK (auth.uid() = actor_id);
