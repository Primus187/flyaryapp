import { useCallback, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Plane, MapPin, BarChart3, Check, AlertTriangle, RefreshCw, Target, ChevronRight, Flame, EyeOff } from "lucide-react";
import { useRoleMode } from "@/contexts/RoleModeContext";
import RoleModeSwitcher from "@/components/RoleModeSwitcher";
import MessagesButton from "@/components/chat/MessagesButton";
import { usePilotStreak } from "@/hooks/use-pilot-streak";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import OnboardingDialog from "@/components/OnboardingDialog";
import NextStepCard from "@/components/NextStepCard";
import SchoolFlightImportCard from "@/components/SchoolFlightImportCard";
import PushPromptCard from "@/components/PushPromptCard";
import ChallengeCard from "@/components/ChallengeCard";
import GoalCard from "@/components/GoalCard";
import GoalFormDialog from "@/components/GoalFormDialog";
import SectionHeading from "@/components/layout/SectionHeading";
import { useXcontestAutoSync } from "@/hooks/use-xcontest-auto-sync";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { usePilotGoals } from "@/hooks/use-pilot-goals";
import { useSwipeAction } from "@/hooks/use-swipe-action";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { useSiteName } from "@/lib/official-sites-store";
import { cn } from "@/lib/utils";

/** Home-screen event row: swipe left to hide it from the home screen. */
function SwipeableEventCard({ children, onHide, hideLabel }: { children: React.ReactNode; onHide: () => void; hideLabel: string }) {
  const { offset, onTouchStart, onTouchMove, onTouchEnd } = useSwipeAction({ onSwipeLeft: onHide });
  return (
    <div className="relative overflow-hidden rounded-card">
      <div className="absolute inset-y-0 right-0 flex items-center gap-1.5 bg-muted-foreground text-background px-4 text-xs font-bold">
        <EyeOff className="h-4 w-4" />{hideLabel}
      </div>
      <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        style={{ transform: `translateX(${offset}px)`, transition: offset === 0 ? "transform 0.2s" : "none" }}>
        {children}
      </div>
    </div>
  );
}

/** Day and month as a large date block, as used in lists across the app. */
function DateBlock({ date, locale }: { date: string; locale: string }) {
  const d = new Date(date);
  return (
    <div className="w-10 shrink-0">
      <p className="text-2xl leading-[26px] stat-value">{String(d.getDate()).padStart(2, "0")}</p>
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        {d.toLocaleDateString(locale, { month: "short" }).replace(".", "")}
      </p>
    </div>
  );
}

/** Season progress towards the flights goal; without a goal just the count. */
function SeasonRing({ value, progress, label }: { value: number; progress: number | null; label: string }) {
  const circumference = 2 * Math.PI * 44;
  return (
    <div className="relative h-[104px] w-[104px] shrink-0">
      <svg width="104" height="104" viewBox="0 0 104 104" fill="none" aria-hidden="true">
        <circle cx="52" cy="52" r="44" strokeWidth="10" className="stroke-secondary" />
        {progress !== null && progress > 0 && (
          <circle cx="52" cy="52" r="44" strokeWidth="10" strokeLinecap="round" className="stroke-primary"
            strokeDasharray={`${(Math.min(progress, 100) / 100) * circumference} ${circumference}`} transform="rotate(-90 52 52)" />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[32px] leading-[34px] stat-value">{value}</span>
        <span className="text-[11px] font-semibold text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}

function StatTile({ value, unit, label }: { value: string; unit?: string; label: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-background px-3 py-2.5">
      <p className="truncate text-lg stat-value">{value}{unit && <span className="text-[11px] font-semibold text-muted-foreground"> {unit}</span>}</p>
      <p className="truncate text-[11px] font-semibold text-muted-foreground">{label}</p>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="px-5 pt-5 pb-4 max-w-lg mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-11 w-11 rounded-lg" />
          <div><Skeleton className="h-3 w-16 mb-1.5" /><Skeleton className="h-5 w-32" /></div>
        </div>
        <Skeleton className="h-11 w-11 rounded-lg" />
      </div>
      {[1, 2, 3].map(i => <Skeleton key={i} className="h-56 w-full rounded-card" />)}
    </div>
  );
}

export default function Dashboard() {
  useXcontestAutoSync();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const siteName = useSiteName();
  const { goals, addGoal, deleteGoal } = usePilotGoals();
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const {
    stats, yearComparison, recent, events, signups, challenges, loading, error,
    profile, avatarSignedUrl, overdueGliders, toggleSignup, hideEvent, unhideEvent, refetch, user,
  } = useDashboardData();
  const { toast } = useToast();
  const hideFromHome = async (eventId: string) => {
    if (!(await hideEvent(eventId))) return;
    toast({ title: t("dashboard.eventHidden"), description: t("dashboard.eventHiddenHint"),
      action: <ToastAction altText={t("common.undo")} onClick={() => void unhideEvent(eventId)}>{t("common.undo")}</ToastAction> });
  };
  const { streak } = usePilotStreak(user?.id);
  const { mode, loading: roleLoading } = useRoleMode();

  // Pull-to-refresh
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const touchStartY = useRef(0);
  const isPulling = useRef(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
    setPullDistance(0);
  }, [refetch]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (window.scrollY <= 0) {
      touchStartY.current = e.touches[0].clientY;
      isPulling.current = true;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling.current) return;
    const diff = e.touches[0].clientY - touchStartY.current;
    if (diff > 0) setPullDistance(Math.min(diff * 0.5, 80));
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (pullDistance > 50 && !refreshing) handleRefresh();
    else setPullDistance(0);
    isPulling.current = false;
  }, [pullDistance, refreshing, handleRefresh]);

  const locale = i18n.language === "fr" ? "fr-CH" : i18n.language === "en" ? "en-GB" : "de-CH";
  const formatDuration = (min: number) => { const h = Math.floor(min / 60); const m = min % 60; return h > 0 ? `${h}h ${m}m` : `${m}m`; };
  const statusLabel: Record<string, string> = { announced: t("events.statusAnnounced"), confirmed: t("events.statusConfirmed"), cancelled: t("events.statusCancelled") };
  const statusVariant = (s: string) => s === "confirmed" ? "success" as const : s === "cancelled" ? "destructive" as const : "default" as const;
  const initials = profile.pilot_name ? profile.pilot_name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) : user?.email?.[0]?.toUpperCase() || "?";

  if (roleLoading) return <DashboardSkeleton />;
  if (mode === "school") return <Navigate to="/school" replace />;

  if (loading) return <DashboardSkeleton />;

  if (error) {
    return (
      <div className="px-5 pt-6 pb-4 max-w-lg mx-auto flex flex-col items-center gap-4 text-center">
        <AlertTriangle className="h-10 w-10 text-destructive" />
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button onClick={() => refetch()} variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" /> {t("common.retry", "Retry")}
        </Button>
      </div>
    );
  }

  return (
    <div
      className="px-5 pt-5 pb-4 max-w-lg mx-auto space-y-[18px]"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull-to-refresh indicator */}
      <div
        className="flex items-center justify-center overflow-hidden transition-all duration-200"
        style={{ height: pullDistance > 0 || refreshing ? Math.max(pullDistance, refreshing ? 40 : 0) : 0 }}
      >
        <div className={`text-muted-foreground ${refreshing ? 'animate-spin' : ''}`}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
        </div>
      </div>

      <OnboardingDialog />

      {/* Header with avatar */}
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <button onClick={() => navigate("/profile")} className="shrink-0" aria-label={t("nav.profile")}>
            <Avatar className="h-11 w-11 rounded-lg">
              <AvatarImage src={avatarSignedUrl} />
              <AvatarFallback className="rounded-lg bg-hero text-sm font-extrabold text-hero-foreground">{initials}</AvatarFallback>
            </Avatar>
          </button>
          <div className="min-w-0">
            <p className="eyebrow">{t("dashboard.subtitle")}</p>
            <h1 className="truncate text-[22px] leading-7 font-extrabold tracking-tight">{profile.pilot_name || t("dashboard.title")}</h1>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <MessagesButton />
          <Button size="icon" variant="outline" onClick={() => navigate("/stats")} aria-label={t("more.stats")}><BarChart3 className="h-5 w-5" /></Button>
        </div>
      </header>

      <RoleModeSwitcher />

      <NextStepCard
        hasProfileName={Boolean(profile.pilot_name)}
        flightCount={stats.totalFlights}
        goalCount={goals.length}
        onAddGoal={() => setGoalDialogOpen(true)}
      />

      <PushPromptCard />

      <SchoolFlightImportCard />

      {/* Maintenance warnings */}
      {overdueGliders.length > 0 && (
        <button onClick={() => navigate("/profile")} className="flex w-full items-center gap-3 rounded-2xl border border-warning/40 bg-warning-soft px-3.5 py-3 text-left text-warning-soft-foreground" aria-label={t("dashboard.maintenanceWarning")}>
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold">{t("dashboard.maintenanceWarning")}</span>
            {overdueGliders.map((g, i) => (
              <span key={i} className="block truncate text-[13px] font-medium">
                {g.name} · {g.type === "check" ? t("profile.checkOverdue") : t("profile.reserveOverdue")}
              </span>
            ))}
          </span>
          <ChevronRight className="h-4 w-4 shrink-0" />
        </button>
      )}

      {/* Events */}
      {events.length > 0 && (
        <section>
          <SectionHeading title={t("dashboard.upcomingEvents")} />
          <div className="space-y-2">
            {events.map((e) => {
              const mySignup = signups.find(s => s.event_id === e.id && s.user_id === user?.id);
              const isSignedUp = mySignup?.signed_up ?? false;
              const totalSignedUp = signups.filter(s => s.event_id === e.id && s.signed_up).length;
              return (
                <SwipeableEventCard key={e.id} onHide={() => void hideFromHome(e.id)} hideLabel={t("dashboard.hide")}>
                <article>
                  <Card className="cursor-pointer">
                    <CardContent className="flex items-start gap-3 p-3.5" onClick={() => navigate(`/events/${e.id}`)}>
                      <DateBlock date={e.event_date} locale={locale} />
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="truncate text-[15px] font-bold">{e.title}</p>
                        <p className="truncate text-[13px] font-medium text-muted-foreground">
                          {new Date(e.event_date).toLocaleDateString(locale, { weekday: "short" })}
                          {e.event_category && ` · ${t(`events.categories.${e.event_category}`, { defaultValue: e.event_category })}`}
                          {e.group_name && ` · ${e.group_name}`}
                        </p>
                        <p className="truncate text-[13px] font-medium text-muted-foreground">
                          {e.meeting_point && `${e.meeting_point} · `}{totalSignedUp}{e.max_participants ? `/${e.max_participants}` : ""} {t("events.signedUp")}
                        </p>
                        <Badge variant={statusVariant(e.status)}>{statusLabel[e.status] || e.status}</Badge>
                      </div>
                      {e.status !== "cancelled" && (
                        <Button variant={isSignedUp ? "default" : "outline"} size="sm"
                          className={cn("shrink-0 gap-1.5", isSignedUp ? "bg-success text-success-foreground hover:bg-success/90" : "border-primary text-link")}
                          onClick={(ev) => { ev.stopPropagation(); toggleSignup(e.id); }}>
                          {isSignedUp && <Check className="h-4 w-4" strokeWidth={2.6} />}{isSignedUp ? t("events.signedUpLabel") : t("events.signUp")}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </article>
                </SwipeableEventCard>
              );
            })}
          </div>
        </section>
      )}

      {/* Season card */}
      {(() => {
        const seasonYear = yearComparison?.currentYear ?? new Date().getFullYear();
        const cur = yearComparison?.current;
        const prev = yearComparison?.previous;
        const seasonFlights = cur?.totalFlights ?? 0;
        const seasonMinutes = cur?.totalMinutes ?? 0;
        const flightDiff = prev && prev.totalFlights > 0
          ? Math.round(((seasonFlights - prev.totalFlights) / prev.totalFlights) * 100)
          : seasonFlights > 0 ? 100 : 0;
        const distance = cur?.totalDistance ?? 0;
        const altitude = cur?.totalAltitude ?? 0;
        const flightsGoal = goals.find(g => g.goal_type === "flights");
        const remaining = flightsGoal ? Math.max(0, flightsGoal.target_value - seasonFlights) : null;

        return (
          <section aria-label={`${t("dashboard.flights")} ${seasonYear}`}>
            <Card className="rounded-3xl">
              <CardContent className="space-y-4 p-[18px]">
                <div className="flex items-center gap-[18px]">
                  <SeasonRing value={seasonFlights} progress={flightsGoal ? flightsGoal.progress : null} label={t("dashboard.flights")} />
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <p className="eyebrow">{t("dashboard.season", "Saison")} {seasonYear}</p>
                      {flightDiff !== 0 && seasonFlights > 0 && (
                        <Badge variant={flightDiff > 0 ? "success" : "destructive"} className="tabular-nums">
                          {flightDiff > 0 ? "+" : "−"}{Math.abs(flightDiff)} %
                        </Badge>
                      )}
                    </div>
                    {remaining !== null && (
                      <p className="text-lg leading-6 font-extrabold tracking-tight">
                        {remaining > 0 ? t("dashboard.goalRemaining", { count: remaining }) : t("dashboard.goalReached")}
                      </p>
                    )}
                    {streak > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2.5 py-1 text-xs font-bold tabular-nums text-warning-soft-foreground">
                        <Flame className="h-3.5 w-3.5" />{streak}{t("dashboard.streakSuffix", "w")}
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <StatTile value={formatDuration(seasonMinutes)} label={t("dashboard.flightTime")} />
                  <StatTile value={distance.toFixed(0)} unit="km" label={t("stats.distance")} />
                  <StatTile value={altitude.toLocaleString(locale, { maximumFractionDigits: 0 })} unit="m" label={t("stats.altitudeGain")} />
                </div>

                <div className="space-y-3 border-t pt-3.5">
                  <div className="flex items-center justify-between gap-3 text-[13px] font-medium text-muted-foreground">
                    <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" /><span className="font-bold tabular-nums text-foreground">{stats.uniqueTakeoffs}</span> {t("dashboard.takeoffs")}</span>
                    {stats.totalFlights > seasonFlights && (
                      <span>{t("dashboard.allTime", "Total")}: <span className="font-bold tabular-nums text-foreground">{stats.totalFlights} · {formatDuration(stats.totalMinutes)}</span></span>
                    )}
                  </div>
                  <Button className="w-full gap-2" onClick={() => navigate("/stats")}>
                    <BarChart3 className="h-4 w-4" /> {t("dashboard.allStats")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </section>
        );
      })()}

      {/* Active Challenges */}
      {challenges.length > 0 && (
        <section>
          <SectionHeading title={t("dashboard.activeChallenges")} />
          <div className="space-y-2">
            {challenges.map(c => (
              <ChallengeCard key={c.id} challenge={c} />
            ))}
          </div>
        </section>
      )}

      {/* Season Goals */}
      <section>
        <SectionHeading title={t("goals.myGoals")} action={
          <Button variant="ghost" size="sm" className="h-8 gap-1 px-1 text-[13px] text-link hover:bg-transparent" onClick={() => setGoalDialogOpen(true)}>
            <Plus className="h-4 w-4" /> {t("goals.addGoal")}
          </Button>
        } />
        {goals.length > 0 ? (
          <div className="space-y-2">
            {goals.map((g) => (
              <GoalCard key={g.id} goal={g} onDelete={deleteGoal} />
            ))}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="p-4 text-center">
              <Target className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-[13px] font-medium text-muted-foreground">{t("goals.noGoals")}</p>
            </CardContent>
          </Card>
        )}
      </section>

      <GoalFormDialog open={goalDialogOpen} onOpenChange={setGoalDialogOpen} onSubmit={addGoal} />

      <section>
        <SectionHeading title={t("dashboard.recentFlights")} />
        {recent.length === 0 ? (
          <Card>
            <CardContent className="p-5">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-11 h-11 rounded-lg bg-accent flex items-center justify-center shrink-0">
                  <Plane className="h-5 w-5 text-accent-foreground" />
                </div>
                <div>
                  <p className="text-[15px] font-bold">{t("dashboard.noFlights")}</p>
                  <p className="text-[13px] font-medium text-muted-foreground mt-0.5">{t("dashboard.noFlightsDesc")}</p>
                </div>
              </div>
              <Button variant="outline" onClick={() => navigate("/import")} className="gap-2 justify-start w-full">
                <Plane className="h-4 w-4" /> {t("dashboard.importExisting")}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {recent.map((f) => (
              <article key={f.id}>
                <Card className="overflow-hidden cursor-pointer active:scale-[0.98] transition-transform" onClick={() => navigate(`/flights/${f.id}`)}>
                  {f.photoUrl && (
                    <div className="aspect-[16/9] w-full overflow-hidden bg-muted">
                      <img src={f.photoUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                    </div>
                  )}
                  <CardContent className="space-y-2.5 px-4 pb-3.5 pt-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 truncate text-base font-bold">
                        {siteName(f.takeoff_location?.name) || "–"}{f.landing_location?.name && ` → ${siteName(f.landing_location.name)}`}
                      </p>
                      <span className="shrink-0 text-[13px] font-medium text-muted-foreground">{new Date(f.date).toLocaleDateString(locale)}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {f.duration_minutes && <div><p className="text-base stat-value">{formatDuration(f.duration_minutes)}</p><p className="text-[11px] font-semibold text-muted-foreground">{t("dashboard.flightTime")}</p></div>}
                      {f.altitude_gain && <div><p className="text-base stat-value">{f.altitude_gain} m</p><p className="text-[11px] font-semibold text-muted-foreground">{t("stats.altitudeGain")}</p></div>}
                      {f.distance_km && <div><p className="text-base stat-value">{Number(f.distance_km).toFixed(1)} km</p><p className="text-[11px] font-semibold text-muted-foreground">{t("stats.distance")}</p></div>}
                    </div>
                    {f.glider && <p className="truncate text-[13px] font-medium text-muted-foreground">{f.glider}</p>}
                  </CardContent>
                </Card>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
