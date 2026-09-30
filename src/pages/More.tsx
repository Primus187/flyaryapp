import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { useRoleMode } from "@/contexts/RoleModeContext";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import SectionHeading from "@/components/layout/SectionHeading";
import ListRow from "@/components/layout/ListRow";
import RoleModeSwitcher from "@/components/RoleModeSwitcher";
import { canOpenSchoolSection } from "@/lib/school-sections";
import { APP_VERSION, forceAppUpdate } from "@/lib/app-update";
import { toast } from "sonner";
import { useAppAdmin } from "@/hooks/use-app-admin";
import { fetchOpsOverview, openItems } from "@/lib/ops-overview";
import { Badge } from "@/components/ui/badge";
import FeedbackDialog from "@/components/FeedbackDialog";
import {
  User, Users, Settings, LogOut, RefreshCw, Map, GraduationCap, MapPin, Scale, Trophy, Search,
  CloudSun, Calendar, BarChart3, MessageCircle, Package, Wallet, Receipt, ClipboardList, MessageSquare, Bell, Store, ShieldCheck, ChevronRight } from "lucide-react";

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
      { path: "/messages", icon: MessageCircle, labelKey: "chat.messages" },
      { path: "/market", icon: Store, labelKey: "market.title" },
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
      { path: "/messages", icon: MessageCircle, labelKey: "chat.messages" },
      { path: "/school/communication", icon: MessageSquare, labelKey: "chat.communication" },
      { path: "/school/availability", icon: Calendar, labelKey: "school.availability.title" },
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
      { path: "/school/shop", icon: Store, labelKey: "market.shop.title" },
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
  const { mode, canSwitch, canManageSchool, canShopSchool, setMode } = useRoleMode();
  const isAppAdmin = useAppAdmin();
  const [opsOpen, setOpsOpen] = useState(0);

  useEffect(() => {
    if (isAppAdmin) fetchOpsOverview().then((o) => setOpsOpen(openItems(o))).catch(() => setOpsOpen(0));
  }, [isAppAdmin]);

  const groups = mode === "school" ? schoolGroups.map(group => ({ ...group,
    tiles: group.tiles.filter(tile => canOpenSchoolSection(tile.path.split("/")[2], canManageSchool, canShopSchool)),
  })).filter(group => group.tiles.length) : pilotGroups;

  const [feedbackOpen, setFeedbackOpen] = useState(false);

  return (
    <PageContainer className="space-y-6">
      <PageHeader title={t("more.title")} />

      <RoleModeSwitcher />

      {mode === "school" ? (
        <ListRow
          icon={GraduationCap}
          label={t("more.school")}
          description={t("more.schoolHint")}
          onClick={() => { setMode("school"); navigate("/school"); }}
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
            onClick={() => setFeedbackOpen(true)}
          />
          <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} mode={mode} />
          <ListRow icon={Scale} label={t("more.legal")} onClick={() => navigate("/legal")} />
          {isAppAdmin && (
            <ListRow icon={ShieldCheck} label={t("ops.title")} description={t("ops.moreHint")} onClick={() => navigate("/admin")}
              trailing={<span className="flex shrink-0 items-center gap-1">{opsOpen > 0 && <Badge>{opsOpen}</Badge>}<ChevronRight className="h-4 w-4 text-muted-foreground" /></span>} />
          )}
          <ListRow
            icon={RefreshCw}
            label={t("more.updateApp")}
            description={t("more.updateAppHint")}
            onClick={async () => { if (!(await forceAppUpdate())) toast.error(t("more.updateAppOffline")); }}
          />
          <ListRow icon={LogOut} label={t("more.signOut")} onClick={signOut} destructive />
        </div>
        <p className="pt-2 text-center text-[11px] text-muted-foreground">Flyary · {t("more.version")} {APP_VERSION}</p>
      </section>
    </PageContainer>
  );
}
