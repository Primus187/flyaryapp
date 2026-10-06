import { useCallback, useEffect, useMemo, useState } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { performanceRpc, type FlightListPage } from "@/lib/performance-api";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plane, Plus, Loader2, Trash2, BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import EmptyState from "@/components/layout/EmptyState";
import FlightThumbnailMap from "@/components/FlightThumbnailMap";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { useSwipeAction } from "@/hooks/use-swipe-action";
import { useToast } from "@/hooks/use-toast";
import PageHeader from "@/components/layout/PageHeader";
import SchoolFlightImportCard from "@/components/SchoolFlightImportCard";
import { useSiteName } from "@/lib/official-sites-store";
import SubmitFlightsDialog from "@/components/SubmitFlightsDialog";
import PassengerRequestsCard from "@/components/PassengerRequestsCard";
import { isConfirmedDeleteError } from "@/lib/flight-confirmation";

type QuickFilter = "all" | "season" | "track";

function FlightsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><Skeleton className="h-8 w-28" /><Skeleton className="h-9 w-20 rounded-md" /></div>
      <Skeleton className="h-10 w-full rounded-md" />
      <div className="flex gap-2"><Skeleton className="h-7 w-20 rounded-full" /><Skeleton className="h-7 w-24 rounded-full" /><Skeleton className="h-7 w-20 rounded-full" /></div>
      {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
    </div>
  );
}

function SwipeableFlightCard({ children, onDelete }: { children: React.ReactNode; onDelete: () => void }) {
  const { offset, onTouchStart, onTouchMove, onTouchEnd } = useSwipeAction({ onSwipeLeft: onDelete });
  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-y-0 right-0 flex items-center justify-center bg-destructive text-destructive-foreground px-4">
        <Trash2 className="h-5 w-5" />
      </div>
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{ transform: `translateX(${offset}px)`, transition: offset === 0 ? "transform 0.2s" : "none" }}
      >
        {children}
      </div>
    </div>
  );
}

export default function Flights() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const siteName = useSiteName();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [submitOpen, setSubmitOpen] = useState(false);
  const currentYear = new Date().getFullYear();
  const locale = i18n.language === "fr" ? "fr-CH" : i18n.language === "en" ? "en-GB" : "de-CH";
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);
  const list = useInfiniteQuery({
    queryKey: ["flight-list", user?.id, debouncedSearch, groupFilter, quickFilter, currentYear],
    enabled: !!user,
    staleTime: 0,
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => performanceRpc<FlightListPage>("list_flights_page", {
      _offset: pageParam, _limit: 40, _search: debouncedSearch, _group: groupFilter, _filter: quickFilter, _year: currentYear, _viewer_id: user!.id,
    }, signal),
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((sum, page) => sum + page.rows.length, 0);
      return last.rows.length && loaded < last.total ? loaded : undefined;
    },
  });
  const groupQuery = useQuery({
    queryKey: ["flight-groups", user?.id], enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("group_members").select("group_id, groups(id, name, group_type)").eq("user_id", user!.id);
      if (error) throw error;
      return (data || []).flatMap((row) => row.groups ? [row.groups] : []);
    },
  });
  const groups = groupQuery.data || [];
  const inSchool = groups.some((g) => g.group_type === "school");
  const flights = useMemo(() => list.data?.pages.flatMap((page) => page.rows) || [], [list.data]);
  const filtered = flights;
  const counts = list.data?.pages[0].counts || { all: 0, season: 0, track: 0 };
  const loading = list.isPending;
  const loadFlights = async () => { await Promise.all([list.refetch(), groupQuery.refetch()]); };

  const handleDeleteFlight = useCallback(async (flightId: string) => {
    if (!confirm(t("flights.deleteFlight"))) return;
    const { error } = await supabase.from("flights").delete().eq("id", flightId);
    if (error) {
      // A confirmed training flight is cancelled on its detail page instead (migration 0074).
      toast({ title: t("common.error"), description: isConfirmedDeleteError(error) ? t("confirmations.deleteRefused") : error.message, variant: "destructive" });
    } else {
      await queryClient.invalidateQueries({ queryKey: ["flight-list", user?.id] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard", user?.id] });
      toast({ title: t("flights.flightDeleted") });
    }
  }, [queryClient, user?.id, t, toast]);

  const { pullDistance, refreshing, onTouchStart, onTouchMove, onTouchEnd } = usePullToRefresh(loadFlights);

  // Group by year-month (e.g. "2026-04")
  const grouped = useMemo(() => {
    const map = new Map<string, (typeof flights)[number][]>();
    for (const f of filtered) {
      const d = new Date(f.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const arr = map.get(key);
      if (arr) arr.push(f); else map.set(key, [f]);
    }
    return Array.from(map.entries()); // already date-desc thanks to source order
  }, [filtered]);

  const formatMonth = (key: string) => {
    const [y, m] = key.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString(locale, { month: "long", year: "numeric" });
  };
  const formatDuration = (min: number) => { const h = Math.floor(min / 60); const m = min % 60; return h > 0 ? `${h}h ${m}m` : `${m}m`; };


  const chipBase = "h-10 px-3.5 rounded-full text-[13px] border transition-colors active:scale-95 whitespace-nowrap flex items-center gap-1.5";
  const chipActive = "bg-accent text-accent-foreground border-primary font-bold";
  const chipIdle = "bg-card text-foreground border-border font-semibold hover:bg-accent";

  return (
    <div
      className="px-5 pt-5 pb-4 max-w-lg mx-auto space-y-4 relative"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{ transform: pullDistance ? `translateY(${pullDistance}px)` : undefined, transition: pullDistance ? "none" : "transform 0.2s" }}
    >
      {(refreshing || pullDistance > 0) && (
        <div className="absolute left-1/2 -translate-x-1/2 top-2 flex items-center justify-center pointer-events-none">
          <Loader2 className={cn("h-5 w-5 text-primary", refreshing && "animate-spin")} style={{ opacity: Math.min(1, pullDistance / 60) || (refreshing ? 1 : 0) }} />
        </div>
      )}
      <PageHeader
        title={t("flights.title")}
        action={
          <Button onClick={() => navigate("/flights/new")}>
            <Plus className="h-4 w-4 mr-1" />
            {t("dashboard.newFlight")}
          </Button>
        }
      />

      <SchoolFlightImportCard />
      <PassengerRequestsCard locale={locale} />
      {inSchool && (
        <Button variant="outline" className="h-12 w-full justify-start gap-2.5 border-primary/30 bg-accent text-accent-foreground hover:bg-accent" onClick={() => setSubmitOpen(true)}>
          <BadgeCheck className="h-4 w-4" />{t("confirmations.submitTitle")}
        </Button>
      )}
      <SubmitFlightsDialog open={submitOpen} onOpenChange={setSubmitOpen} locale={locale} />

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-muted-foreground" />
          <Input placeholder={t("flights.searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 bg-card" />
        </div>
        {groups.length > 0 && (
          <Select value={groupFilter} onValueChange={setGroupFilter}>
            <SelectTrigger className="w-[140px] bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.all")}</SelectItem>
              {groups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
              <SelectItem value="none">{t("flights.noGroup")}</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Quick filter chips */}
      <div className="flex gap-2 overflow-x-auto -mx-5 px-5 pb-1 no-scrollbar">
        <button type="button" onClick={() => setQuickFilter("all")} className={cn(chipBase, quickFilter === "all" ? chipActive : chipIdle)}>
          {t("flights.filterAll", "Alle")}
          <span className="opacity-70 tabular-nums">{counts.all}</span>
        </button>
        <button type="button" onClick={() => setQuickFilter("season")} className={cn(chipBase, quickFilter === "season" ? chipActive : chipIdle)}>
          {t("flights.filterSeason", "Saison")} {currentYear}
          <span className="opacity-70 tabular-nums">{counts.season}</span>
        </button>
        <button type="button" onClick={() => setQuickFilter("track")} className={cn(chipBase, quickFilter === "track" ? chipActive : chipIdle)}>
          {t("flights.filterWithTrack", "Mit Track")}
          <span className="opacity-70 tabular-nums">{counts.track}</span>
        </button>
      </div>

      {loading ? <FlightsSkeleton /> : list.isError && !flights.length ? (
        <div role="alert" className="space-y-3"><p>{t("performance.loadFailed")}</p><Button onClick={() => void loadFlights()}>{t("performance.retry")}</Button></div>
      ) : filtered.length === 0 ? (
        counts.all === 0 ? (
          <EmptyState
            icon={Plane}
            title={t("dashboard.noFlights")}
            description={t("emptyState.flightsDesc")}
            actionLabel={t("dashboard.firstFlight")}
            onAction={() => navigate("/flights/new")}
          />
        ) : (
          <EmptyState icon={Plane} title={t("flights.noFlights")} />
        )
      ) : (
        <div className="space-y-4">
          {grouped.map(([monthKey, items]) => (
            <section key={monthKey} className="space-y-2">
              <div className="sticky top-0 z-10 -mx-5 px-5 py-2 bg-background">
                <div className="flex items-baseline justify-between">
                  <h2 className="eyebrow">
                    {formatMonth(monthKey)}
                  </h2>
                  <span className="text-xs font-semibold text-muted-foreground tabular-nums">
                    {items.length} {items.length === 1 ? t("flights.flightSingular", "Flug") : t("flights.flightPlural", "Flüge")}
                  </span>
                </div>
              </div>
              <div className="overflow-hidden rounded-card border bg-card divide-y">
                {items.map((f) => {
                  const thumbPoints = f.thumbnail?.length >= 2 ? f.thumbnail : null;
                  const date = new Date(f.date);
                  const figures = [
                    f.duration_minutes && formatDuration(f.duration_minutes),
                    f.altitude_gain && `${f.altitude_gain} m`,
                    f.distance_km && `${Number(f.distance_km).toFixed(1)} km`,
                  ].filter(Boolean).join(" · ");
                  return (
                    <SwipeableFlightCard key={f.id} onDelete={() => handleDeleteFlight(f.id)}>
                      <div className="flex cursor-pointer items-center gap-3.5 bg-card px-4 py-3 transition-colors active:bg-accent" onClick={() => navigate(`/flights/${f.id}`)}>
                        <div className="w-9 shrink-0">
                          <p className="text-2xl leading-[26px] font-extrabold tracking-tight tabular-nums">{String(date.getDate()).padStart(2, "0")}</p>
                          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{date.toLocaleDateString(locale, { month: "short" }).replace(".", "")}</p>
                        </div>
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-[15px] font-bold">
                              {siteName(f.takeoff_location?.name) || t("common.unknown")}{f.landing_location?.name && ` → ${siteName(f.landing_location.name)}`}
                            </p>
                            {f.has_track && !thumbPoints && <span className="shrink-0 rounded-md bg-accent px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-accent-foreground">IGC</span>}
                          </div>
                          {figures && <p className="text-[13px] font-semibold tabular-nums">{figures}</p>}
                          {f.glider && <p className="truncate text-xs font-medium text-muted-foreground">{f.glider}</p>}
                        </div>
                        {thumbPoints && (
                          <FlightThumbnailMap points={thumbPoints} size={56} className="shrink-0 rounded-xl" />
                        )}
                      </div>
                    </SwipeableFlightCard>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
      {list.isError && flights.length > 0 && <p role="alert" className="text-sm text-destructive">{t("performance.loadFailed")}</p>}
      {list.hasNextPage && <Button variant="outline" className="w-full" disabled={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>{t("performance.loadMore")}</Button>}
    </div>
  );
}
