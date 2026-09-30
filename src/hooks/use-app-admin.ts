import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Flyary admin rights (is_ops_admin, migration 0083): null while unknown, then true or false.
 * Since migration 0088 they need a session confirmed with the second factor (aal2); `refresh` asks again,
 * e.g. right after the code was confirmed.
 */
export function useOpsAdminState(refresh = 0): boolean | null {
  const userId = useAuth().user?.id;
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  useEffect(() => {
    if (!userId) { setIsAdmin(false); return; }
    let active = true;
    setIsAdmin(null);
    void supabase.rpc("is_ops_admin").then(({ data }) => { if (active) setIsAdmin(data === true); });
    return () => { active = false; };
  }, [userId, refresh]);
  return isAdmin;
}

/** true for Flyary admins with confirmed second factor; false while unknown or for everyone else. */
export function useAppAdmin(): boolean {
  return useOpsAdminState() === true;
}

/**
 * The account has the Flyary admin role, whether or not the second factor is confirmed yet
 * (is_admin_role, migration 0088). Grants nothing; only decides whether to show "Betrieb" and ask for the code.
 */
export function useAdminRole(): boolean | null {
  const userId = useAuth().user?.id;
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  useEffect(() => {
    if (!userId) { setIsAdmin(false); return; }
    let active = true;
    setIsAdmin(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RPC not in generated types.ts yet (migration 0088)
    void supabase.rpc("is_admin_role" as any).then(async ({ data, error }) => {
      // Before migration 0088 the function does not exist: fall back to the admin check itself.
      const result = error ? (await supabase.rpc("is_ops_admin")).data === true : data === true;
      if (active) setIsAdmin(result);
    });
    return () => { active = false; };
  }, [userId]);
  return isAdmin;
}
