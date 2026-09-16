REVOKE EXECUTE ON FUNCTION public.get_own_profile_private() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_pilot_stats(uuid, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_public_profile(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.join_group_by_invite_code(uuid) FROM anon;