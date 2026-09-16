import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

/**
 * True when the current user belongs to a flight school team:
 * either admin of a school group, or has the instructor / school_lead function.
 */
export function useSchoolAccess() {
  const { user } = useAuth();
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setHasAccess(false);
      setLoading(false);
      return;
    }
    let cancelled = false;

    const check = async () => {
      const [adminRes, functionRes] = await Promise.all([
        supabase.from("group_members").select("group_id").eq("user_id", user.id).eq("role", "admin"),
        supabase
          .from("group_member_functions")
          .select("group_id, function")
          .eq("user_id", user.id)
          .in("function", ["instructor", "school_lead"]),
      ]);

      const candidateIds = [
        ...(adminRes.data || []).map((r) => r.group_id),
        ...(functionRes.data || []).map((r) => r.group_id),
      ];

      if (candidateIds.length === 0) {
        if (!cancelled) { setHasAccess(false); setLoading(false); }
        return;
      }

      const { data: schools } = await supabase
        .from("groups")
        .select("id")
        .in("id", candidateIds)
        .eq("group_type", "school")
        .limit(1);

      if (!cancelled) {
        setHasAccess((schools?.length ?? 0) > 0);
        setLoading(false);
      }
    };

    check();
    return () => { cancelled = true; };
  }, [user]);

  return { hasSchoolAccess: hasAccess, loading };
}
