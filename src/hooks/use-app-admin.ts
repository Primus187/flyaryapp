import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/** Flyary admin (is_ops_admin, migration 0083): null while unknown, then true or false. */
export function useOpsAdminState(): boolean | null {
  const userId = useAuth().user?.id;
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  useEffect(() => {
    if (!userId) { setIsAdmin(false); return; }
    let active = true;
    setIsAdmin(null);
    void supabase.rpc("is_ops_admin").then(({ data }) => { if (active) setIsAdmin(data === true); });
    return () => { active = false; };
  }, [userId]);
  return isAdmin;
}

/** true for Flyary admins; false while unknown or for everyone else. */
export function useAppAdmin(): boolean {
  return useOpsAdminState() === true;
}
