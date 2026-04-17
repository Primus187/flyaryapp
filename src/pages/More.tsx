import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { User, Users, Upload, Settings, LogOut, Map, GraduationCap, MapPin, Scale, Trophy, Search, CloudSun, Calendar } from "lucide-react";

type Tile = { path: string; icon: any; labelKey: string };

const pilotTiles: Tile[] = [
  { path: "/profile", icon: User, labelKey: "more.profile" },
  { path: "/search", icon: Search, labelKey: "more.search" },
  { path: "/leaderboard", icon: Trophy, labelKey: "more.leaderboard" },
];

const toolsTiles: Tile[] = [
  { path: "/events", icon: Calendar, labelKey: "nav.events" },
  { path: "/locations", icon: MapPin, labelKey: "nav.locations" },
  { path: "/weather", icon: CloudSun, labelKey: "more.weather" },
  { path: "/map", icon: Map, labelKey: "more.map" },
  { path: "/training", icon: GraduationCap, labelKey: "more.training" },
  { path: "/groups", icon: Users, labelKey: "more.groups" },
];

const adminTiles: Tile[] = [
  { path: "/import", icon: Upload, labelKey: "more.importFlights" },
  { path: "/import-locations", icon: MapPin, labelKey: "more.importLocations" },
  { path: "/settings", icon: Settings, labelKey: "more.settings" },
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

  const pilotSection = isSchoolAdmin
    ? [{ path: "/school", icon: GraduationCap, labelKey: "more.school" }, ...pilotTiles]
    : pilotTiles;

  const renderSection = (title: string, tiles: Tile[]) => (
    <section>
      <h2 className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wider px-1">{title}</h2>
      <div className="grid grid-cols-3 gap-3">
        {tiles.map(({ path, icon: Icon, labelKey }) => (
          <button
            key={path}
            type="button"
            onClick={() => navigate(path)}
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-card border border-border/50 shadow-sm hover:bg-muted/50 active:scale-[0.97] transition-all"
          >
            <Icon className="h-6 w-6 text-primary" />
            <span className="text-xs font-medium text-foreground text-center leading-tight">{t(labelKey)}</span>
          </button>
        ))}
      </div>
    </section>
  );

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("more.title")}</h1>

      {renderSection(t("more.sectionPilot", "Pilot"), pilotSection)}
      {renderSection(t("more.sectionTools", "Tools"), toolsTiles)}
      {renderSection(t("more.sectionAdmin", "Verwaltung"), adminTiles)}

      <section>
        <h2 className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wider px-1">
          {t("more.sectionLegal", "Rechtliches")}
        </h2>
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => navigate("/legal")}
            className="w-full flex items-center gap-3 p-3 rounded-xl bg-card border border-border/50 shadow-sm hover:bg-muted/50 active:scale-[0.99] transition-all"
          >
            <Scale className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium">{t("more.legal")}</span>
          </button>
          <button
            type="button"
            onClick={signOut}
            className="w-full flex items-center gap-3 p-3 rounded-xl text-destructive hover:bg-destructive/10 active:scale-[0.99] transition-all"
          >
            <LogOut className="h-5 w-5" />
            <span className="text-sm font-medium">{t("more.signOut")}</span>
          </button>
        </div>
      </section>
    </div>
  );
}
