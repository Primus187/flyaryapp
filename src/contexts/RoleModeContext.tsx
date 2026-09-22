import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useSchoolGroups } from "@/hooks/use-school-access";
import { useAuth } from "@/contexts/AuthContext";

export type RoleMode = "pilot" | "school";
interface RoleModeValue {
  mode: RoleMode;
  setMode: (mode: RoleMode) => void;
  canSwitch: boolean;
  loading: boolean;
  schoolGroupId: string;
  setSchoolGroupId: (id: string) => void;
  canManageSchool: boolean;
}
const RoleModeContext = createContext<RoleModeValue>({ mode: "pilot", setMode: () => {}, canSwitch: false,
  loading: true, schoolGroupId: "", setSchoolGroupId: () => {}, canManageSchool: false });
function saved(key: string) {
  try { return window.localStorage.getItem(key); } catch { return null; }
}
function remember(key: string, value: string) {
  try { window.localStorage.setItem(key, value); } catch { /* Optional preference storage. */ }
}
export function RoleModeProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const groups = useSchoolGroups();
  const account = user?.id || "";
  const [preference, setPreference] = useState<{ account: string; mode: RoleMode } | null>(null);
  const [selection, setSelection] = useState<{ account: string; id: string } | null>(null);
  const requestedMode = preference?.account === account ? preference.mode : saved(`flyary.roleMode:${account}`);
  const requestedGroup = selection?.account === account ? selection.id : saved(`flyary.school:${account}`);
  const group = groups.data?.find(g => g.id === requestedGroup) || groups.data?.[0];
  const canSwitch = !!groups.data?.length;
  const loading = authLoading || (!!user && groups.isPending);
  const mode: RoleMode = requestedMode === "school" && (canSwitch || loading) ? "school" : "pilot";
  const setMode = useCallback((next: RoleMode) => {
    setPreference({ account, mode: next });
    remember(`flyary.roleMode:${account}`, next);
  }, [account]);
  const setSchoolGroupId = useCallback((id: string) => {
    setSelection({ account, id });
    remember(`flyary.school:${account}`, id);
  }, [account]);
  const value = useMemo(() => ({ mode, setMode, canSwitch, loading, schoolGroupId: group?.id || "",
    setSchoolGroupId, canManageSchool: group?.canManage ?? false }), [mode, setMode, canSwitch, loading, group, setSchoolGroupId]);
  return <RoleModeContext.Provider value={value}>{children}</RoleModeContext.Provider>;
}
export const useRoleMode = () => useContext(RoleModeContext);
