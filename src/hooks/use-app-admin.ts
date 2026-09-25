import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/** true for Flyary admins (app_role admin); false while unknown or for everyone else. */
export function useAppAdmin(): boolean {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    let active = true;
    void supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }).then(({ data }) => { if (active) setIsAdmin(data === true); });
    return () => { active = false; };
  }, [user]);
  return isAdmin;
}
