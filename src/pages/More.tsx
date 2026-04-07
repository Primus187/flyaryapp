import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { User, Users, Upload, Settings, LogOut, Map, GraduationCap, MapPin, Scale, Trophy, Search, CloudSun } from "lucide-react";

const baseTiles = [
  { path: "/search", icon: Search, labelKey: "more.search" },
  { path: "/profile", icon: User, labelKey: "more.profile" },
  { path: "/training", icon: GraduationCap, labelKey: "more.training" },
  { path: "/map", icon: Map, labelKey: "more.map" },
  { path: "/groups", icon: Users, labelKey: "more.groups" },
  { path: "/leaderboard", icon: Trophy, labelKey: "more.leaderboard" },
  { path: "/import", icon: Upload, labelKey: "more.importFlights" },
  { path: "/import-locations", icon: MapPin, labelKey: "more.importLocations" },
  { path: "/settings", icon: Settings, labelKey: "more.settings" },
  { path: "/legal", icon: Scale, labelKey: "more.legal" },
];

export default function More() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { signOut, user } = useAuth();
  const [isSchoolAdmin, setIsSchoolAdmin] = useState(false);

  useEffect(() => {
    if (!user) return;
    const check = async () => {
      const { data: adminMemberships } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", user.id)
        .eq("role", "admin");
      if (!adminMemberships?.length) return;
      const { data: schools } = await supabase
        .from("groups")
        .select("id")
        .in("id", adminMemberships.map((m) => m.group_id))
        .eq("group_type", "school")
        .limit(1);
      setIsSchoolAdmin((schools?.length ?? 0) > 0);
    };
    check();
  }, [user]);

  const tiles = isSchoolAdmin
    ? [{ path: "/school", icon: GraduationCap, labelKey: "more.school" }, ...baseTiles]
    : baseTiles;

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("more.title")}</h1>

      <div className="grid grid-cols-3 gap-3">
        {tiles.map(({ path, icon: Icon, labelKey }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-card border border-border/50 shadow-sm hover:bg-muted/50 active:scale-[0.97] transition-all"
          >
            <Icon className="h-6 w-6 text-primary" />
            <span className="text-xs font-medium text-foreground text-center leading-tight">{t(labelKey)}</span>
          </button>
        ))}
      </div>

      <button
        onClick={signOut}
        className="w-full flex items-center justify-center gap-2 p-3 rounded-xl text-destructive hover:bg-destructive/10 active:scale-[0.97] transition-all"
      >
        <LogOut className="h-4 w-4" />
        <span className="text-sm font-medium">{t("more.signOut")}</span>
      </button>
    </div>
  );
}
