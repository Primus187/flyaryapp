import { supabase } from "@/integrations/supabase/client";

/** Deletes the signed-in account with all its data (Edge Function delete-account) and signs out. */
export async function deleteOwnAccount(notSignedInMessage: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error(notSignedInMessage);
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`, {
    method: "POST",
    headers: { Authorization: `Bearer ${session.access_token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error || "Failed");
  }
  await supabase.auth.signOut();
  localStorage.clear();
}
