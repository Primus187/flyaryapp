import { supabase } from "@/integrations/supabase/client";

export interface SchoolOption { id: string; name: string }

/** The schools the user belongs to (any function); confirmations go to one of them. */
export async function fetchMySchools(userId: string): Promise<SchoolOption[]> {
  const { data, error } = await supabase.from("group_members").select("groups(id, name, group_type)").eq("user_id", userId);
  if (error) throw error;
  return (data || []).flatMap((row) => {
    const g = row.groups as { id: string; name: string; group_type: string } | null;
    return g && g.group_type === "school" ? [{ id: g.id, name: g.name }] : [];
  });
}
