import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { useSchoolAccess } from "@/hooks/use-school-access";
import {
  User, Users, Settings, LogOut, Map, GraduationCap, MapPin, Scale, Trophy, Search,
  CloudSun, Calendar, BarChart3, ChevronRight,
} from "lucide-react";

type Tile = { path: string; icon: any; labelKey: string };

const flyTiles: Tile[] = [
  { path: "/events", icon: Calendar, labelKey: "nav.events" },
  { path: "/locations", icon: MapPin, labelKey: "nav.locations" },
  { path: "/weather", icon: CloudSun, labelKey: "more.weather" },
  { path: "/map", icon: Map, labelKey: "more.map" },
];

const meTiles: Tile[] = [
  { path: "/profile", icon: User, labelKey: "more.profile" },
  { path: "/training", icon: GraduationCap, labelKey: "more.training" },
  { path: "/stats", icon: BarChart3, labelKey: "more.stats" },
];

const communityTiles: Tile[] = [
  { path: "/search", icon: Search, labelKey: "more.search" },
  { path: "/leaderboard", icon: Trophy, labelKey: "more.leaderboard" },
  { path: "/groups", icon: Users, labelKey: "more.groups" },
];

export default function More() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const { hasSchoolAccess } = useSchoolAccess();

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

      {hasSchoolAccess && (
        <button
          type="button"
          onClick={() => navigate("/school")}
          className="w-full flex items-center gap-4 p-4 rounded-2xl bg-primary/10 border border-primary/25 shadow-sm hover:bg-primary/15 active:scale-[0.99] transition-all text-left"
        >
          <div className="h-11 w-11 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
            <GraduationCap className="h-6 w-6 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{t("more.school")}</p>
            <p className="text-xs text-muted-foreground">{t("more.schoolHint")}</p>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
        </button>
      )}

      {renderSection(t("more.sectionFly"), flyTiles)}
      {renderSection(t("more.sectionMe"), meTiles)}
      {renderSection(t("more.sectionCommunity"), communityTiles)}

      <section>
        <h2 className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wider px-1">
          {t("more.settings")}
        </h2>
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => navigate("/settings")}
            className="w-full flex items-center gap-3 p-3 rounded-xl bg-card border border-border/50 shadow-sm hover:bg-muted/50 active:scale-[0.99] transition-all"
          >
            <Settings className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium">{t("more.settings")}</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />
          </button>
          <button
            type="button"
            onClick={() => navigate("/legal")}
            className="w-full flex items-center gap-3 p-3 rounded-xl bg-card border border-border/50 shadow-sm hover:bg-muted/50 active:scale-[0.99] transition-all"
          >
            <Scale className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium">{t("more.legal")}</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />
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
