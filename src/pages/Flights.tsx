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
import { Search, Plane, Plus, Filter, Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import EmptyState from "@/components/layout/EmptyState";
import FlightThumbnailMap from "@/components/FlightThumbnailMap";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { useSwipeAction } from "@/hooks/use-swipe-action";
import { useToast } from "@/hooks/use-toast";
import PageHeader from "@/components/layout/PageHeader";

type QuickFilter = "all" | "season" | "track";

function FlightsSkeleton() {
  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto space-y-4">
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
    <div className="relative overflow-hidden rounded-lg">
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
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
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
      const { data, error } = await supabase.from("group_members").select("group_id, groups(id, name)").eq("user_id", user!.id);
      if (error) throw error;
      return (data || []).flatMap((row) => row.groups ? [row.groups] : []);
    },
  });
  const groups = groupQuery.data || [];
  const flights = useMemo(() => list.data?.pages.flatMap((page) => page.rows) || [], [list.data]);
  const filtered = flights;
  const counts = list.data?.pages[0].counts || { all: 0, season: 0, track: 0 };
  const loading = list.isPending;
  const loadFlights = async () => { await Promise.all([list.refetch(), groupQuery.refetch()]); };

  const handleDeleteFlight = useCallback(async (flightId: string) => {
    if (!confirm(t("flights.deleteFlight"))) return;
    const { error } = await supabase.from("flights").delete().eq("id", flightId);
    if (error) {

      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
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


  const chipBase = "px-3 py-1 rounded-full text-xs font-medium border transition-colors active:scale-95 whitespace-nowrap flex items-center gap-1.5";
  const chipActive = "bg-primary text-primary-foreground border-primary";
  const chipIdle = "bg-card text-foreground border-border/60 hover:bg-muted/50";

  return (
    <div
      className="px-4 pt-6 pb-4 max-w-lg mx-auto space-y-4 relative"
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
          <Button size="sm" onClick={() => navigate("/flights/new")}>
            <Plus className="h-4 w-4 mr-1" />
            {t("dashboard.newFlight")}
          </Button>
        }
      />

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder={t("flights.searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        {groups.length > 0 && (
          <Select value={groupFilter} onValueChange={setGroupFilter}>
            <SelectTrigger className="w-[140px]">
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
      <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1 scrollbar-none">
        <button type="button" onClick={() => setQuickFilter("all")} className={cn(chipBase, quickFilter === "all" ? chipActive : chipIdle)}>
          <Filter className="h-3 w-3" />
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
              <div className="sticky top-0 z-10 -mx-4 px-4 py-1.5 bg-gradient-to-b from-background via-background/95 to-background/80 backdrop-blur-sm">
                <div className="flex items-baseline justify-between">
                  <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {formatMonth(monthKey)}
                  </h2>
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {items.length} {items.length === 1 ? t("flights.flightSingular", "Flug") : t("flights.flightPlural", "Flüge")}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                {items.map((f) => {
                  const thumbPoints = f.thumbnail?.length >= 2 ? f.thumbnail : null;
                  return (
                    <SwipeableFlightCard key={f.id} onDelete={() => handleDeleteFlight(f.id)}>
                    <Card className="border-0 shadow-sm cursor-pointer active:scale-[0.98] transition-transform" onClick={() => navigate(`/flights/${f.id}`)}>
                      <CardContent className="p-3">
                        <div className="flex gap-3">
                          {thumbPoints && (
                            <FlightThumbnailMap points={thumbPoints} size={64} className="shrink-0 rounded-xl" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <p className="font-medium text-sm truncate">{f.takeoff_location?.name || t("common.unknown")}</p>
                                  {f.has_track && !thumbPoints && <span className="text-[9px] font-semibold uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded">IGC</span>}
                                </div>
                                {f.landing_location?.name && <p className="text-xs text-muted-foreground truncate">→ {f.landing_location.name}</p>}
                              </div>
                              <span className="text-xs text-muted-foreground shrink-0">
                                {new Date(f.date).toLocaleDateString(locale, { day: "2-digit", month: "short" })}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-muted-foreground">
                              {f.duration_minutes && <span>⏱ {formatDuration(f.duration_minutes)}</span>}
                              {f.altitude_gain && <span>↑ {f.altitude_gain}m</span>}
                              {f.distance_km && <span>↔ {Number(f.distance_km).toFixed(1)}km</span>}
                              {f.glider && <span className="truncate max-w-[120px]">🪂 {f.glider}</span>}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
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
