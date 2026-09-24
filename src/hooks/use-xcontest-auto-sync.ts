import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const SYNC_COOLDOWN_KEY = "xcontest_last_auto_sync";
const COOLDOWN_MS = 1000 * 60 * 60; // 1 hour

export function useXcontestAutoSync() {
  const { user } = useAuth();
  const { toast } = useToast();
  const ran = useRef(false);

  useEffect(() => {
    if (!user || ran.current) return;
    ran.current = true;

    const lastSync = localStorage.getItem(SYNC_COOLDOWN_KEY);
    if (lastSync && Date.now() - Number(lastSync) < COOLDOWN_MS) return;

    (async () => {
      try {
        const { data: privateRows } = await supabase.rpc("get_own_profile_private");
        const profile = privateRows?.[0];

        if (!profile?.xcontest_username || !profile.xcontest_password_encrypted) return;

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        localStorage.setItem(SYNC_COOLDOWN_KEY, String(Date.now()));

        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-xcontest`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
          }
        );
        const data = await res.json().catch(() => ({} as any));
        if (res.ok && data?.imported > 0) {
          toast({
            title: `XContest: ${data.imported} neue Flüge importiert`,
          });
        }
      } catch {
        // Silent fail for auto-sync
      }
    })();
  }, [user]);
}
