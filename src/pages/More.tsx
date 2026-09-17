import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { useRoleMode } from "@/contexts/RoleModeContext";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import SectionHeading from "@/components/layout/SectionHeading";
import ListRow from "@/components/layout/ListRow";
import RoleModeSwitcher from "@/components/RoleModeSwitcher";
import {
  User, Users, Settings, LogOut, Map, GraduationCap, MapPin, Scale, Trophy, Search,
  CloudSun, Calendar, BarChart3, MessageCircle, Package, Wallet, Receipt, ClipboardList, MessageSquare, Bell,
} from "lucide-react";

type Tile = { path: string; icon: any; labelKey: string };
type Group = { titleKey: string; tiles: Tile[] };

const pilotGroups: Group[] = [
  {
    titleKey: "more.sectionFly",
    tiles: [
      { path: "/events", icon: Calendar, labelKey: "nav.events" },
      { path: "/locations", icon: MapPin, labelKey: "nav.locations" },
      { path: "/weather", icon: CloudSun, labelKey: "more.weather" },
      { path: "/map", icon: Map, labelKey: "more.map" },
    ],
  },
  {
    titleKey: "more.sectionMe",
    tiles: [
      { path: "/profile", icon: User, labelKey: "more.profile" },
      { path: "/training", icon: GraduationCap, labelKey: "more.training" },
      { path: "/stats", icon: BarChart3, labelKey: "more.stats" },
    ],
  },
  {
    titleKey: "more.sectionCommunity",
    tiles: [
      { path: "/search", icon: Search, labelKey: "more.search" },
      { path: "/leaderboard", icon: Trophy, labelKey: "more.leaderboard" },
      { path: "/groups", icon: Users, labelKey: "more.groups" },
    ],
  },
];

const schoolGroups: Group[] = [
  {
    titleKey: "school.hub.operations",
    tiles: [
      { path: "/school/days", icon: Calendar, labelKey: "school.flightDays" },
      { path: "/school/chat", icon: MessageCircle, labelKey: "events.chat" },
    ],
  },
  {
    titleKey: "school.hub.people",
    tiles: [
      { path: "/school/people", icon: Users, labelKey: "school.people.title" },
      { path: "/school/students", icon: ClipboardList, labelKey: "school.students" },
    ],
  },
  {
    titleKey: "school.hub.admin",
    tiles: [
      { path: "/school/equipment", icon: Package, labelKey: "school.equipment.title" },
      { path: "/school/credits", icon: Wallet, labelKey: "school.credits.title" },
      { path: "/school/billing", icon: Receipt, labelKey: "school.billing.title" },
      { path: "/school/stats", icon: BarChart3, labelKey: "school.stats.title" },
    ],
  },
];

export default function More() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const { mode, canSwitch } = useRoleMode();

  const groups = mode === "school" ? schoolGroups : pilotGroups;

  const sendFeedback = () => {
    const info = [
      `Version: ${(import.meta as any).env?.VITE_APP_VERSION || "dev"}`,
      `Modus: ${mode}`,
      `Seite: ${window.location.pathname}`,
      `Gerät: ${navigator.userAgent}`,
    ].join("\n");
    const subject = encodeURIComponent("Flyary Feedback");
    const body = encodeURIComponent(`\n\n---\n${info}\n`);
    window.location.href = `mailto:tobias.a.bolliger@gmail.com?subject=${subject}&body=${body}`;
  };

  return (
    <PageContainer className="space-y-6">
      <PageHeader title={t("more.title")} />

      <RoleModeSwitcher />

      {mode === "school" ? (
        <ListRow
          icon={GraduationCap}
          label={t("more.school")}
          description={t("more.schoolHint")}
          onClick={() => navigate("/school")}
        />
      ) : canSwitch ? (
        <ListRow
          icon={GraduationCap}
          label={t("more.schoolOpen")}
          description={t("more.schoolHint")}
          onClick={() => navigate("/school")}
        />
      ) : null}

      {groups.map((group) => (
        <section key={group.titleKey}>
          <SectionHeading title={t(group.titleKey)} />
          <div className="grid grid-cols-3 gap-3">
            {group.tiles.map(({ path, icon: Icon, labelKey }) => (
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
      ))}

      <section>
        <SectionHeading title={t("more.settings")} />
        <div className="space-y-2">
          <ListRow icon={Settings} label={t("more.settings")} onClick={() => navigate("/settings")} />
          <ListRow
            icon={Bell}
            label={t("push.pageTitle")}
            description={t("push.pageSubtitle")}
            onClick={() => navigate("/notifications")}
          />
          <ListRow
            icon={MessageSquare}
            label={t("more.feedback")}
            description={t("more.feedbackHint")}
            onClick={sendFeedback}
          />
          <ListRow icon={Scale} label={t("more.legal")} onClick={() => navigate("/legal")} />
          <ListRow icon={LogOut} label={t("more.signOut")} onClick={signOut} destructive />
        </div>
      </section>
    </PageContainer>
  );
}
