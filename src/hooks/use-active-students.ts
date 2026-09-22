import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/** Staff-only list of inactive IDs; reasons never enter operational participant lists. */
export function useActiveStudents(groupId: string | undefined, enabled: boolean) {
  const { user } = useAuth();
  return useQuery({ queryKey: ["inactive-students", user?.id, groupId], enabled: !!groupId && !!user && enabled,
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("inactive_school_students" as never, { _group_id: groupId } as never);
      if (error) throw error;
      return (data || []) as unknown as string[];
    },
  });
}
