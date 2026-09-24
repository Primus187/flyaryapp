import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { clearSignedUrlCache } from "@/lib/signed-url-cache";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null, user: null, loading: true, signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session first, then subscribe to changes
    let mounted = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) {
        setSession(session);
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setSession(session);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Supabase hands out a new user object on every token refresh (hourly, and on app resume).
  // Many effects depend on `user`; keep its identity stable unless the account really changed,
  // otherwise open forms (e.g. editing a flight) were reloaded and lost unsaved input.
  const sessionUser = session?.user ?? null;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- identity keyed on id + updated_at on purpose
  const user = useMemo(() => sessionUser, [sessionUser?.id, sessionUser?.updated_at]);

  const signOut = async () => {
    await supabase.auth.signOut();
    queryClient.clear();
    clearSignedUrlCache();
    if ("caches" in window) await caches.delete("supabase-api");
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
