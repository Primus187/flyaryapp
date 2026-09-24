import { useLocation, useNavigate } from "react-router-dom";
import { Home, Compass, BookOpen, LayoutGrid, Plus, CalendarDays, Users, MessageCircle, CalendarClock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useRoleMode } from "@/contexts/RoleModeContext";
import { useChatInbox } from "@/hooks/use-chat";
import { totalUnread } from "@/lib/chat";
import { UnreadDot } from "@/components/chat/MessagesButton";

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { mode, canSwitch, canManageSchool } = useRoleMode();
  const unread = totalUnread(useChatInbox().data || []);

  const tabs = [
    { path: "/", icon: Home, label: t("nav.home", "Home") },
    { path: "/feed", icon: Compass, label: t("nav.feed", "Feed") },
    { path: "/flights", icon: BookOpen, label: t("nav.logbook") },
    { path: "/more", icon: LayoutGrid, label: t("nav.more") },
  ];

  const handleNav = (path: string) => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try { navigator.vibrate(8); } catch { /* noop */ }
    }
    navigate(path);
  };

  if (canSwitch && (mode === "school" || location.pathname.startsWith("/school"))) {
    const schoolTabs = [
      { path: "/school", icon: Home, label: t("nav.home") },
      { path: "/school/days", icon: CalendarDays, label: t("school.flightDays") },
      canManageSchool ? { path: "/school/students", icon: Users, label: t("school.students") }
        : { path: "/school/availability", icon: CalendarClock, label: t("school.availability.title") },
      { path: "/messages", icon: MessageCircle, label: t("chat.messages") },
      { path: "/more", icon: LayoutGrid, label: t("nav.more") },
    ];
    return <nav aria-label={t("journeys.schoolNavigation")} className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card/95 backdrop-blur-xl safe-area-bottom">
      <div className="flex h-16 max-w-lg mx-auto">{schoolTabs.map(({ path, icon: Icon, label }) => {
        const active = location.pathname === path || ((path === "/school/students" || path === "/messages") && location.pathname.startsWith(`${path}/`));
        return <button key={path} type="button" onClick={() => handleNav(path)} aria-current={active ? "page" : undefined}
          className={cn("flex-1 min-w-0 px-1 flex flex-col items-center justify-center gap-1", active ? "text-primary" : "text-muted-foreground")}>
          <span className="relative"><Icon className="h-5 w-5" />{path === "/messages" && unread > 0 && <UnreadDot count={unread} className="-top-1.5 -right-2.5" />}</span><span className="text-[11px] text-center leading-tight">{label}</span>
        </button>;
      })}</div>
    </nav>;
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/30 bg-card/95 backdrop-blur-xl safe-area-bottom">
      <div className="relative flex items-end justify-around h-16 max-w-lg mx-auto px-2">
        {/* Left tabs */}
        {tabs.slice(0, 2).map((tab) => {
          const isActive = tab.path === "/" ? location.pathname === "/" : location.pathname.startsWith(tab.path);
          const Icon = tab.icon;
          return (
            <button
              key={tab.path}
              type="button"
              onClick={() => handleNav(tab.path)}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors active:scale-95",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className="h-5 w-5" strokeWidth={isActive ? 2.2 : 1.7} />
              <span className={cn("text-[10px] leading-none", isActive ? "font-semibold" : "font-medium")}>
                {tab.label}
              </span>
            </button>
          );
        })}

        {/* Central FAB */}
        <div className="flex-1 flex justify-center">
          <button
            type="button"
            onClick={() => handleNav("/flights/new")}
            aria-label={t("dashboard.firstFlight")}
            className="-mt-6 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 flex items-center justify-center active:scale-95 transition-transform ring-4 ring-background"
          >
            <Plus className="h-6 w-6" strokeWidth={2.5} />
          </button>
        </div>

        {/* Right tabs */}
        {tabs.slice(2).map((tab) => {
          const isActive = location.pathname.startsWith(tab.path);
          const Icon = tab.icon;
          return (
            <button
              key={tab.path}
              type="button"
              onClick={() => handleNav(tab.path)}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors active:scale-95",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className="h-5 w-5" strokeWidth={isActive ? 2.2 : 1.7} />
              <span className={cn("text-[10px] leading-none", isActive ? "font-semibold" : "font-medium")}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
