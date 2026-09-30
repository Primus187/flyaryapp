import { Suspense, useCallback, useState } from "react";
import { Navigate, NavLink, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BadgeCheck, Bug, GraduationCap, HardDrive, KeyRound, LayoutDashboard, MessageSquare, Store, UserPlus, type LucideIcon } from "lucide-react";
import LoadingState from "@/components/layout/LoadingState";
import AdminMfaGate from "@/components/admin/AdminMfaGate";
import { useAdminRole, useOpsAdminState } from "@/hooks/use-app-admin";
import { cn } from "@/lib/utils";

/** Sections of the Betriebsbereich; the marketplace moderation keeps its own page for school moderators. */
const ADMIN_NAV: { path: string; icon: LucideIcon; labelKey: string }[] = [
  { path: "/admin", icon: LayoutDashboard, labelKey: "ops.nav.overview" },
  { path: "/admin/access", icon: UserPlus, labelKey: "ops.nav.access" },
  { path: "/admin/schools", icon: GraduationCap, labelKey: "ops.nav.schools" },
  { path: "/admin/feedback", icon: MessageSquare, labelKey: "ops.nav.feedback" },
  { path: "/admin/errors", icon: Bug, labelKey: "ops.nav.errors" },
  { path: "/admin/backups", icon: HardDrive, labelKey: "ops.nav.backups" },
  { path: "/market/moderation", icon: Store, labelKey: "ops.nav.market" },
  { path: "/admin/sites", icon: BadgeCheck, labelKey: "ops.nav.sites" },
  { path: "/admin/security", icon: KeyRound, labelKey: "ops.nav.security" },
];

/**
 * Betriebsbereich (/admin, migration 0083): only for Flyary admins; everyone else goes to the start page.
 * The database checks every admin action itself (is_ops_admin); this only keeps the pages out of sight.
 * Since migration 0088 admin rights need the second factor: an admin without a confirmed session gets the
 * code prompt (or the first setup) instead of the pages.
 * Wide screens get a side navigation, phones use the overview page as menu.
 */
export default function AdminLayout() {
  const { t } = useTranslation();
  const [refresh, setRefresh] = useState(0);
  const role = useAdminRole();
  const isAdmin = useOpsAdminState(refresh);
  const verified = useCallback(() => setRefresh((n) => n + 1), []);
  if (role === null || isAdmin === null) return <LoadingState />;
  if (!role) return <Navigate to="/" replace />;
  if (!isAdmin) return <AdminMfaGate onVerified={verified} />;

  return (
    <div className="lg:mx-auto lg:flex lg:max-w-5xl lg:gap-4 lg:px-4">
      <nav className="hidden lg:block lg:w-52 lg:shrink-0 lg:space-y-1 lg:pt-6" aria-label={t("ops.title")}>
        <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("ops.title")}</p>
        {ADMIN_NAV.map(({ path, icon: Icon, labelKey }) => (
          <NavLink key={path} to={path} end
            className={({ isActive }) => cn("flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
              isActive ? "bg-primary/10 font-medium text-primary" : "text-foreground hover:bg-muted/60")}>
            <Icon className="h-4 w-4 shrink-0" />{t(labelKey)}
          </NavLink>
        ))}
      </nav>
      <div className="min-w-0 flex-1 lg:[&>*]:mx-0 lg:[&>*]:max-w-3xl">
        <Suspense fallback={<LoadingState />}>
          <Outlet />
        </Suspense>
      </div>
    </div>
  );
}
