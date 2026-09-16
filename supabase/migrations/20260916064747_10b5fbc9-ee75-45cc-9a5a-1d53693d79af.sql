-- RLS helper functions: authenticated only (needed inside policies)
REVOKE EXECUTE ON FUNCTION public.has_group_function(uuid, uuid, public.group_function) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_group_staff(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_group_admin(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_owner_of_flight(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_group_function(uuid, uuid, public.group_function) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_group_staff(uuid, uuid) TO authenticated;

-- Internal trigger/notification functions: not directly callable at all
REVOKE EXECUTE ON FUNCTION public.handle_signup_waitlist() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.send_push_notification(uuid, text, text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_comment() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_follow() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_like() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_followers_new_flight() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.push_on_notification() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalculate_pilot_xp() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_and_award_badges() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_and_award_badges_for_user(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;