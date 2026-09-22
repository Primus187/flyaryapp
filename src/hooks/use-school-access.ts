import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export async function fetchSchoolGroups(userId: string) {
  const [admins, functions] = await Promise.all([
    supabase.from("group_members").select("group_id").eq("user_id", userId).eq("role", "admin"),
    supabase.from("group_member_functions").select("group_id").eq("user_id", userId).in("function", ["instructor", "school_lead"]),
  ]);
  if (admins.error) throw admins.error;
  if (functions.error) throw functions.error;
  const ids = [...new Set([...(admins.data || []), ...(functions.data || [])].map((row) => row.group_id))];
  if (!ids.length) return [];
  const { data, error } = await supabase.from("groups").select("id, name").in("id", ids).eq("group_type", "school");
  if (error) throw error;
  return data || [];
}

export function useSchoolGroups() {
  const { user } = useAuth();
  return useQuery({ queryKey: ["school-groups", user?.id], enabled: !!user,
    queryFn: () => fetchSchoolGroups(user!.id), staleTime: 60_000 });
}

/** Shared account-scoped lookup; permissions are still enforced by database RLS. */
export function useSchoolAccess() {
  const query = useSchoolGroups();
  return { hasSchoolAccess: !!query.data?.length, loading: query.isFetching };
}
