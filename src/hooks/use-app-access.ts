import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { AppAccess } from "@/lib/app-access";

export const APP_ACCESS_KEY = "app-access";

/** Whether the signed-in account may use the app in the pilot phase (my_access, migration 0079). */
export function useAppAccess() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [APP_ACCESS_KEY, user?.id],
    enabled: !!user,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<AppAccess> => {
      const { data, error } = await supabase.rpc("my_access" as never);
      if (error) throw error;
      return data as unknown as AppAccess;
    },
  });
}
