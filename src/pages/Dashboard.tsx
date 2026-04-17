import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Plane, Clock, MapPin, BarChart3, CheckCircle2, XCircle, Users, AlertTriangle, RefreshCw, Target, TrendingUp, TrendingDown, Mountain, Route, Flame } from "lucide-react";
import { usePilotStreak } from "@/hooks/use-pilot-streak";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import OnboardingDialog from "@/components/OnboardingDialog";
import EmptyState from "@/components/EmptyState";
import ChallengeCard from "@/components/ChallengeCard";
import GoalCard from "@/components/GoalCard";
import GoalFormDialog from "@/components/GoalFormDialog";
import { useXcontestAutoSync } from "@/hooks/use-xcontest-auto-sync";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { usePilotGoals } from "@/hooks/use-pilot-goals";

function DashboardSkeleton() {
  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div><Skeleton className="h-5 w-24 mb-1" /><Skeleton className="h-3 w-16" /></div>
        </div>
        <Skeleton className="h-9 w-9 rounded-full" />
      </div>
      <div className="grid grid-cols-4 gap-2">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
      </div>
      {[1, 2, 3].map(i => <Skeleton key={i} className="h-64 w-full rounded-2xl" />)}
    </div>
  );
}

export default function Dashboard() {
  useXcontestAutoSync();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { goals, addGoal, deleteGoal } = usePilotGoals();
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const {
    stats, yearComparison, recent, events, signups, challenges, loading, error,
    profile, avatarSignedUrl, overdueGliders, toggleSignup, refetch, user,
  } = useDashboardData();
  const { streak } = usePilotStreak(user?.id);

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
  const statusColor = (s: string) => s === "confirmed" ? "bg-green-100 text-green-800 hover:bg-green-100/80 dark:bg-green-900/30 dark:text-green-400" : s === "cancelled" ? "bg-red-100 text-red-800 hover:bg-red-100/80 dark:bg-red-900/30 dark:text-red-400" : "bg-blue-100 text-blue-800 hover:bg-blue-100/80 dark:bg-blue-900/30 dark:text-blue-400";
  const initials = profile.pilot_name ? profile.pilot_name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) : user?.email?.[0]?.toUpperCase() || "?";

  if (loading) return <DashboardSkeleton />;

  if (error) {
    return (
      <div className="px-4 pt-6 pb-4 max-w-lg mx-auto flex flex-col items-center gap-4 text-center">
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
      className="px-4 pt-6 pb-4 max-w-lg mx-auto space-y-5"
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
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/profile")} className="relative p-[2px] rounded-full bg-gradient-to-tr from-primary via-secondary to-accent" aria-label={t("nav.profile")}>
            <Avatar className="h-10 w-10 border-2 border-background">
              <AvatarImage src={avatarSignedUrl} />
              <AvatarFallback className="text-sm bg-muted">{initials}</AvatarFallback>
            </Avatar>
          </button>
          <div>
            <h1 className="text-lg font-bold tracking-tight">{profile.pilot_name || t("dashboard.title")}</h1>
            <p className="text-xs text-muted-foreground">{t("dashboard.subtitle")}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="icon" variant="ghost" onClick={() => navigate("/stats")} className="h-9 w-9 rounded-full" aria-label={t("nav.stats")}><BarChart3 className="h-5 w-5" /></Button>
          <Button size="icon" onClick={() => navigate("/flights/new")} className="h-9 w-9 rounded-full" aria-label={t("dashboard.firstFlight")}><Plus className="h-5 w-5" /></Button>
        </div>
      </header>

      {/* Hero season stat card */}
      {(() => {
        const seasonYear = yearComparison?.currentYear ?? new Date().getFullYear();
        const cur = yearComparison?.current;
        const prev = yearComparison?.previous;
        const seasonFlights = cur?.totalFlights ?? 0;
        const seasonMinutes = cur?.totalMinutes ?? 0;
        const seasonHours = Math.floor(seasonMinutes / 60);
        const seasonMins = seasonMinutes % 60;
        const flightDiff = prev && prev.totalFlights > 0
          ? Math.round(((seasonFlights - prev.totalFlights) / prev.totalFlights) * 100)
          : seasonFlights > 0 ? 100 : 0;
        const distance = cur?.totalDistance ?? 0;
        const altitude = cur?.totalAltitude ?? 0;

        return (
          <section aria-label={`${t("dashboard.flights")} ${seasonYear}`}>
            <Card className="border-0 shadow-sm overflow-hidden bg-gradient-to-br from-primary/10 via-card to-card">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {t("dashboard.season", "Saison")} {seasonYear}
                  </p>
                  {flightDiff !== 0 && seasonFlights > 0 && (
                    <span className={`flex items-center gap-1 text-xs font-semibold tabular-nums ${flightDiff > 0 ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
                      {flightDiff > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                      {flightDiff > 0 ? "+" : ""}{flightDiff}%
                    </span>
                  )}
                </div>

                <div className="flex items-end gap-6 mb-4">
                  <div>
                    <p className="text-3xl font-bold tabular-nums leading-none">{seasonFlights}</p>
                    <p className="text-[11px] text-muted-foreground mt-1.5 uppercase tracking-wide">{t("dashboard.flights")}</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold tabular-nums leading-none">
                      {seasonHours}<span className="text-xl">h</span>
                      {seasonMins > 0 && <span className="text-xl"> {seasonMins}m</span>}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1.5 uppercase tracking-wide">{t("dashboard.flightTime")}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-muted-foreground border-t border-border/40 pt-3">
                  <span className="flex items-center gap-1.5"><Route className="h-3.5 w-3.5" /><span className="tabular-nums font-medium text-foreground">{distance.toFixed(0)}</span> km</span>
                  <span className="flex items-center gap-1.5"><Mountain className="h-3.5 w-3.5" /><span className="tabular-nums font-medium text-foreground">{altitude.toFixed(0)}</span> m</span>
                  <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /><span className="tabular-nums font-medium text-foreground">{stats.uniqueTakeoffs}</span></span>
                </div>

                {stats.totalFlights > seasonFlights && (
                  <p className="text-[10px] text-muted-foreground mt-3 text-right">
                    {t("dashboard.allTime", "Total")}: <span className="tabular-nums font-medium">{stats.totalFlights}</span> · {formatDuration(stats.totalMinutes)}
                  </p>
                )}
              </CardContent>
            </Card>
          </section>
        );
      })()}

      {/* Maintenance warnings */}
      {overdueGliders.length > 0 && (
        <button onClick={() => navigate("/profile")} className="w-full" aria-label={t("dashboard.maintenanceWarning")}>
          <Card className="border border-destructive/30 bg-destructive/5 shadow-sm">
            <CardContent className="p-3 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div className="text-left">
                <p className="text-sm font-medium text-destructive">{t("dashboard.maintenanceWarning")}</p>
                {overdueGliders.map((g, i) => (
                  <p key={i} className="text-xs text-muted-foreground">
                    {g.name} — {g.type === "check" ? t("profile.checkOverdue") : t("profile.reserveOverdue")}
                  </p>
                ))}
              </div>
            </CardContent>
          </Card>
        </button>
      )}

      {/* Events */}
      {events.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wider">{t("dashboard.upcomingEvents")}</h2>
          <div className="space-y-2">
            {events.map((e) => {
              const mySignup = signups.find(s => s.event_id === e.id && s.user_id === user?.id);
              const isSignedUp = mySignup?.signed_up ?? false;
              const totalSignedUp = signups.filter(s => s.event_id === e.id && s.signed_up).length;
              return (
                <article key={e.id}>
                  <Card className="border-0 shadow-sm hover:bg-muted/50 cursor-pointer transition-colors">
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2" onClick={() => navigate(`/events/${e.id}`)}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="font-medium text-sm truncate">{e.title}</p>
                            <Badge className={`text-[10px] shrink-0 ${statusColor(e.status)}`}>{statusLabel[e.status] || e.status}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {new Date(e.event_date).toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                            {e.event_type && ` · ${e.event_type}`}
                            {e.group_name && ` · ${e.group_name}`}
                          </p>
                          {e.meeting_point && <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><MapPin className="h-3 w-3" /> {e.meeting_point}</p>}
                          <p className="text-xs text-muted-foreground mt-0.5"><Users className="h-3 w-3 inline mr-1" />{totalSignedUp}{e.max_participants ? `/${e.max_participants}` : ""} {t("events.signedUp")}</p>
                        </div>
                        {e.status !== "cancelled" && (
                          <Button variant={isSignedUp ? "default" : "outline"} size="sm" className={`shrink-0 gap-1 ${isSignedUp ? "bg-green-600 hover:bg-green-700" : ""}`} onClick={(ev) => { ev.stopPropagation(); toggleSignup(e.id); }}>
                            {isSignedUp ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}{isSignedUp ? t("events.signedUpLabel") : t("events.signUp")}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* Active Challenges */}
      {challenges.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wider">{t("dashboard.activeChallenges")}</h2>
          <div className="space-y-2">
            {challenges.map(c => (
              <ChallengeCard key={c.id} challenge={c} />
            ))}
          </div>
        </section>
      )}

      {/* Season Goals */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("goals.myGoals")}</h2>
          <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={() => setGoalDialogOpen(true)}>
            <Plus className="h-3 w-3" /> {t("goals.addGoal")}
          </Button>
        </div>
        {goals.length > 0 ? (
          <div className="space-y-2">
            {goals.map((g) => (
              <GoalCard key={g.id} goal={g} onDelete={deleteGoal} />
            ))}
          </div>
        ) : (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 text-center">
              <Target className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">{t("goals.noGoals")}</p>
            </CardContent>
          </Card>
        )}
      </section>

      <GoalFormDialog open={goalDialogOpen} onOpenChange={setGoalDialogOpen} onSubmit={addGoal} />


      <section>
        <h2 className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wider">{t("dashboard.recentFlights")}</h2>
        {recent.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Plane className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{t("dashboard.noFlights")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t("dashboard.noFlightsDesc")}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2">
                <Button onClick={() => navigate("/flights/new")} className="gap-2 justify-start">
                  <Plus className="h-4 w-4" /> {t("dashboard.firstFlight")}
                </Button>
                <Button variant="outline" onClick={() => navigate("/import")} className="gap-2 justify-start">
                  <Plane className="h-4 w-4" /> {t("dashboard.importExisting")}
                </Button>
                <Button variant="outline" onClick={() => navigate("/profile")} className="gap-2 justify-start">
                  <RefreshCw className="h-4 w-4" /> {t("dashboard.connectXcontest")}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {recent.map((f) => (
              <article key={f.id}>
                <Card className="border-0 shadow-sm overflow-hidden cursor-pointer active:scale-[0.98] transition-transform" onClick={() => navigate(`/flights/${f.id}`)}>
                  {f.photoUrl && (
                    <div className="aspect-[16/9] w-full overflow-hidden bg-muted">
                      <img src={f.photoUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                    </div>
                  )}
                  <CardContent className="p-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-sm">{f.takeoff_location?.name || "–"}</p>
                        {f.landing_location?.name && <p className="text-xs text-muted-foreground">→ {f.landing_location.name}</p>}
                      </div>
                      <span className="text-xs text-muted-foreground">{new Date(f.date).toLocaleDateString(locale)}</span>
                    </div>
                    <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                      {f.duration_minutes && <span>⏱ {formatDuration(f.duration_minutes)}</span>}
                      {f.altitude_gain && <span>↑ {f.altitude_gain}m</span>}
                      {f.distance_km && <span>↔ {Number(f.distance_km).toFixed(1)}km</span>}
                      {f.glider && <span>🪂 {f.glider}</span>}
                    </div>
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
