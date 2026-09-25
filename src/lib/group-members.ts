import { supabase } from "@/integrations/supabase/client";

export interface GroupMemberRow {
  id: string;
  user_id: string;
  role: string;
  profiles: { pilot_name: string | null } | null;
}

/** Attaches pilot names to group_members rows. Members without a readable profile keep `profiles: null`. */
export function attachPilotNames(
  members: { id: string; user_id: string; role: string }[],
  profiles: { user_id: string; pilot_name: string | null }[],
): GroupMemberRow[] {
  const names = new Map(profiles.map((p) => [p.user_id, p.pilot_name]));
  return members.map((m) => ({ ...m, profiles: names.has(m.user_id) ? { pilot_name: names.get(m.user_id) ?? null } : null }));
}

/**
 * Loads the members of a group with their pilot names. group_members.user_id has no foreign key to
 * profiles, so a PostgREST embed `profiles(pilot_name)` fails and returns no rows at all; the names
 * are therefore loaded in a second query.
 */
export async function fetchGroupMembers(groupId: string): Promise<GroupMemberRow[] | null> {
  const { data: members, error } = await supabase.from("group_members").select("id, user_id, role").eq("group_id", groupId);
  if (error || !members) return null;
  if (members.length === 0) return [];
  const { data: profiles } = await supabase.from("profiles").select("user_id, pilot_name").in("user_id", members.map((m) => m.user_id));
  return attachPilotNames(members, profiles ?? []);
}
