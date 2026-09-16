-- Strip PUBLIC default execute from all security definer functions
REVOKE EXECUTE ON FUNCTION public.check_and_award_badges() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_and_award_badges_for_user(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_own_profile_private() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_pilot_stats(uuid, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_public_profile(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_signup_waitlist() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_group_function(uuid, uuid, public.group_function) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_group_admin(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_group_staff(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_owner_of_flight(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.join_group_by_invite_code(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_followers_new_flight() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_on_comment() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_on_follow() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_on_like() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.push_on_notification() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.recalculate_pilot_xp() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.send_push_notification(uuid, text, text, text) FROM PUBLIC;

-- Client-callable RPCs: authenticated only
GRANT EXECUTE ON FUNCTION public.get_own_profile_private() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pilot_stats(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_profile(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_group_by_invite_code(uuid) TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;