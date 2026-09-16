import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useSchoolAccess } from "@/hooks/use-school-access";

export type RoleMode = "pilot" | "school";

interface RoleModeValue {
  mode: RoleMode;
  setMode: (mode: RoleMode) => void;
  /** Nur wahr, wenn die Person zum Schulteam gehört – nur dann gibt es einen Umschalter. */
  canSwitch: boolean;
}

const STORAGE_KEY = "flyary.roleMode";

const RoleModeContext = createContext<RoleModeValue>({
  mode: "pilot",
  setMode: () => {},
  canSwitch: false,
});

export function RoleModeProvider({ children }: { children: React.ReactNode }) {
  const { hasSchoolAccess } = useSchoolAccess();
  const [mode, setModeState] = useState<RoleMode>(() => {
    if (typeof window === "undefined") return "pilot";
    return window.localStorage.getItem(STORAGE_KEY) === "school" ? "school" : "pilot";
  });

  // Ohne Schulzugang gibt es nur den Pilotmodus.
  useEffect(() => {
    if (!hasSchoolAccess && mode === "school") setModeState("pilot");
  }, [hasSchoolAccess, mode]);

  const setMode = useCallback((next: RoleMode) => {
    setModeState(next);
    try { window.localStorage.setItem(STORAGE_KEY, next); } catch { /* noop */ }
  }, []);

  const value = useMemo<RoleModeValue>(() => ({
    mode: hasSchoolAccess ? mode : "pilot",
    setMode,
    canSwitch: hasSchoolAccess,
  }), [hasSchoolAccess, mode, setMode]);

  return <RoleModeContext.Provider value={value}>{children}</RoleModeContext.Provider>;
}

export function useRoleMode() {
  return useContext(RoleModeContext);
}
