import { supabase } from "@/integrations/supabase/client";

/** Reads a group's invite code; only admins and the school team may (group_invite_code, migration 0070). */
export async function loadInviteCode(groupId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("group_invite_code", { _group_id: groupId });
  return error ? null : (data as string | null);
}

/** Replaces the code; links with the old one stop working. */
export async function renewInviteCode(groupId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("regenerate_group_invite_code", { _group_id: groupId });
  if (error) throw error;
  return data as string | null;
}
