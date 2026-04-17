import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plane, Plus, Filter, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import EmptyState from "@/components/EmptyState";
import FlightThumbnailMap from "@/components/FlightThumbnailMap";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";

interface Flight {
  id: string;
  date: string;
  glider: string | null;
  duration_minutes: number | null;
  altitude_gain: number | null;
  distance_km: number | null;
  group_id: string | null;
  has_track: boolean;
  takeoff_location: { name: string } | null;
  landing_location: { name: string } | null;
}
interface Group { id: string; name: string; }

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

export default function Flights() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [flights, setFlights] = useState<Flight[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [tracks, setTracks] = useState<Record<string, [number, number][]>>({});
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [loading, setLoading] = useState(true);
  const locale = i18n.language === "fr" ? "fr-CH" : i18n.language === "en" ? "en-GB" : "de-CH";

  const loadFlights = useCallback(async () => {
    if (!user) return;
    const [flightsRes, groupsRes] = await Promise.all([
      supabase
        .from("flights")
        .select("id, date, glider, duration_minutes, altitude_gain, distance_km, group_id, locations!flights_takeoff_location_id_fkey(name), land:locations!flights_landing_location_id_fkey(name), igc_tracks(id)")
        .eq("user_id", user.id)
        .order("date", { ascending: false }),
      supabase.from("group_members").select("group_id, groups(id, name)").eq("user_id", user.id),
    ]);
    if (flightsRes.data) {
      setFlights(
        flightsRes.data.map((f: any) => ({
          ...f,
          takeoff_location: f.locations,
          landing_location: f.land,
          has_track: Array.isArray(f.igc_tracks) && f.igc_tracks.length > 0,
        })),
      );
    }
    if (groupsRes.data) setGroups(groupsRes.data.map((gm: any) => gm.groups).filter(Boolean));
    setLoading(false);
  }, [user]);

  useEffect(() => { loadFlights(); }, [loadFlights]);

  const { pullDistance, refreshing, onTouchStart, onTouchMove, onTouchEnd } = usePullToRefresh(loadFlights);

  // Batch-fetch all IGC tracks for thumbnails (heavily downsampled to 40 points each)
  useEffect(() => {
    const trackedFlightIds = flights.filter(f => f.has_track).map(f => f.id);
    if (trackedFlightIds.length === 0) return;
    let cancelled = false;
    supabase
      .from("igc_tracks")
      .select("flight_id, track_data")
      .in("flight_id", trackedFlightIds)
      .then(({ data }) => {
        if (cancelled || !data) return;
        const map: Record<string, [number, number][]> = {};
        for (const row of data as any[]) {
          const raw = row.track_data;
          const arr: any[] | null = Array.isArray(raw) ? raw : (raw?.points && Array.isArray(raw.points) ? raw.points : null);
          if (!arr || arr.length < 2) continue;
          // Downsample to ~40 points for tiny thumbnail
          const step = Math.max(1, Math.floor(arr.length / 40));
          const points: [number, number][] = [];
          for (let i = 0; i < arr.length; i += step) {
            const p = arr[i];
            const lat = Array.isArray(p) ? p[0] : p.lat;
            const lng = Array.isArray(p) ? p[1] : p.lng;
            if (typeof lat === "number" && typeof lng === "number") points.push([lat, lng]);
          }
          if (points.length >= 2) map[row.flight_id] = points;
        }
        setTracks(map);
      });
    return () => { cancelled = true; };
  }, [flights]);

  const currentYear = new Date().getFullYear();

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return flights.filter((f) => {
      const matchesSearch = !q
        || f.takeoff_location?.name?.toLowerCase().includes(q)
        || f.landing_location?.name?.toLowerCase().includes(q)
        || f.glider?.toLowerCase().includes(q)
        || f.date.includes(q);
      const matchesGroup = groupFilter === "all" || (groupFilter === "none" ? f.group_id === null : f.group_id === groupFilter);
      const matchesQuick =
        quickFilter === "all" ? true
        : quickFilter === "season" ? new Date(f.date).getFullYear() === currentYear
        : quickFilter === "track" ? f.has_track
        : true;
      return matchesSearch && matchesGroup && matchesQuick;
    });
  }, [flights, search, groupFilter, quickFilter, currentYear]);

  // Group by year-month (e.g. "2026-04")
  const grouped = useMemo(() => {
    const map = new Map<string, Flight[]>();
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

  const counts = useMemo(() => ({
    all: flights.length,
    season: flights.filter(f => new Date(f.date).getFullYear() === currentYear).length,
    track: flights.filter(f => f.has_track).length,
  }), [flights, currentYear]);

  if (loading) return <FlightsSkeleton />;

  const chipBase = "px-3 py-1 rounded-full text-xs font-medium border transition-colors active:scale-95 whitespace-nowrap flex items-center gap-1.5";
  const chipActive = "bg-primary text-primary-foreground border-primary";
  const chipIdle = "bg-card text-foreground border-border/60 hover:bg-muted/50";

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t("flights.title")}</h1>
        <Button size="sm" onClick={() => navigate("/flights/new")}>
          <Plus className="h-4 w-4 mr-1" />
          {t("dashboard.newFlight")}
        </Button>
      </div>

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

      {filtered.length === 0 ? (
        flights.length === 0 ? (
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
                  const thumbPoints = tracks[f.id];
                  return (
                    <Card key={f.id} className="border-0 shadow-sm cursor-pointer active:scale-[0.98] transition-transform" onClick={() => navigate(`/flights/${f.id}`)}>
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
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
