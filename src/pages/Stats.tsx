import { useEffect, useState, useMemo, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import RankedList from "@/components/stats/RankedList";
import ActivityHeatmap from "@/components/stats/ActivityHeatmap";

// Lazy-load Recharts-based charts (recharts is ~150 KB gzipped)
const StatsBarChart = lazy(() => import("@/components/stats/StatsBarChart"));
const YearComparisonChart = lazy(() => import("@/components/stats/YearComparisonChart"));
const CumulativeHoursChart = lazy(() => import("@/components/stats/CumulativeHoursChart"));

const ChartFallback = () => <Skeleton className="h-64 w-full rounded-2xl" />;

interface Flight {
  id: string;
  date: string;
  duration_minutes: number | null;
  altitude_gain: number | null;
  distance_km: number | null;
  glider: string | null;
  takeoff_location_id: string | null;
  landing_location_id: string | null;
  takeoff_name: string | null;
}

type FilterMode = "month" | "year" | "all";

export default function Stats() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [flights, setFlights] = useState<Flight[]>([]);
  const [mode, setMode] = useState<FilterMode>("year");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());

  const monthNames = t("stats.months", { returnObjects: true }) as string[];
  const monthsShort = t("stats.monthsShort", { returnObjects: true }) as string[];

  useEffect(() => {
    if (!user) return;
    supabase
      .from("flights")
      .select("id, date, duration_minutes, altitude_gain, distance_km, glider, takeoff_location_id, landing_location_id, locations!flights_takeoff_location_id_fkey(name)")
      .eq("user_id", user.id)
      .order("date", { ascending: true })
      .then(({ data }) => {
        if (data) setFlights(data.map((f: any) => ({ ...f, takeoff_name: f.locations?.name || null })));
      });
  }, [user]);

  const filtered = useMemo(() => {
    return flights.filter((f) => {
      const d = new Date(f.date);
      if (mode === "month") return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth;
      if (mode === "year") return d.getFullYear() === selectedYear;
      return true;
    });
  }, [flights, mode, selectedYear, selectedMonth]);

  const kpis = useMemo(() => {
    const total = filtered.length;
    const totalMin = filtered.reduce((s, f) => s + (f.duration_minutes || 0), 0);
    const avgMin = total > 0 ? Math.round(totalMin / total) : 0;
    const longest = filtered.reduce((m, f) => Math.max(m, f.duration_minutes || 0), 0);
    const totalDist = filtered.reduce((s, f) => s + (Number(f.distance_km) || 0), 0);
    const totalAlt = filtered.reduce((s, f) => s + (f.altitude_gain || 0), 0);
    const takeoffCounts: Record<string, number> = {};
    filtered.forEach((f) => { if (f.takeoff_name) takeoffCounts[f.takeoff_name] = (takeoffCounts[f.takeoff_name] || 0) + 1; });
    const topTakeoff = Object.entries(takeoffCounts).sort((a, b) => b[1] - a[1])[0];
    const gliderCounts: Record<string, number> = {};
    filtered.forEach((f) => { if (f.glider) gliderCounts[f.glider] = (gliderCounts[f.glider] || 0) + 1; });
    const topGlider = Object.entries(gliderCounts).sort((a, b) => b[1] - a[1])[0];
    return { total, totalMin, avgMin, longest, totalDist, totalAlt, topTakeoff, topGlider };
  }, [filtered]);

  const chartData = useMemo(() => {
    const map: Record<string, { flights: number; minutes: number }> = {};
    if (mode === "all") {
      flights.forEach((f) => { const y = new Date(f.date).getFullYear().toString(); if (!map[y]) map[y] = { flights: 0, minutes: 0 }; map[y].flights++; map[y].minutes += f.duration_minutes || 0; });
      return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0])).map(([label, v]) => ({ label, ...v }));
    }
    for (let i = 0; i < 12; i++) map[monthsShort[i]] = { flights: 0, minutes: 0 };
    filtered.forEach((f) => { const m = monthsShort[new Date(f.date).getMonth()]; map[m].flights++; map[m].minutes += f.duration_minutes || 0; });
    return monthsShort.map((label) => ({ label, ...map[label] }));
  }, [flights, filtered, mode, monthsShort]);

  const cumulativeData = useMemo(() => {
    if (flights.length === 0) return [];
    const sorted = [...flights].sort((a, b) => a.date.localeCompare(b.date));
    let cumMin = 0;
    const points: { date: string; hours: number }[] = [];
    sorted.forEach(f => { cumMin += f.duration_minutes || 0; points.push({ date: f.date, hours: Math.round(cumMin / 6) / 10 }); });
    if (points.length <= 50) return points;
    const step = Math.ceil(points.length / 50);
    return points.filter((_, i) => i % step === 0 || i === points.length - 1);
  }, [flights]);

  const yearCompareData = useMemo(() => {
    if (mode !== "year") return [];
    const prevYear = selectedYear - 1;
    return monthsShort.map((label, i) => ({
      label,
      current: flights.filter(f => { const d = new Date(f.date); return d.getFullYear() === selectedYear && d.getMonth() === i; }).length,
      previous: flights.filter(f => { const d = new Date(f.date); return d.getFullYear() === prevYear && d.getMonth() === i; }).length,
    }));
  }, [flights, mode, selectedYear, monthsShort]);

  const topTakeoffs = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach(f => { if (f.takeoff_name) counts[f.takeoff_name] = (counts[f.takeoff_name] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }));
  }, [filtered]);

  const heatmapData = useMemo(() => {
    const year = mode === "year" ? selectedYear : new Date().getFullYear();
    const map: Record<string, number> = {};
    flights.filter(f => new Date(f.date).getFullYear() === year).forEach(f => { map[f.date] = (map[f.date] || 0) + 1; });
    return { year, days: map };
  }, [flights, mode, selectedYear]);

  const altitudeTrend = useMemo(() => {
    if (mode === "all") return [];
    return monthsShort.map((label, i) => {
      const mf = filtered.filter(f => new Date(f.date).getMonth() === i);
      return { label, avgAltitude: mf.length > 0 ? Math.round(mf.reduce((s, f) => s + (f.altitude_gain || 0), 0) / mf.length) : 0 };
    });
  }, [filtered, mode, monthsShort]);

  const distanceTrend = useMemo(() => {
    if (mode === "all") {
      const map: Record<string, number> = {};
      flights.forEach(f => { const y = new Date(f.date).getFullYear().toString(); map[y] = (map[y] || 0) + (Number(f.distance_km) || 0); });
      return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0])).map(([label, km]) => ({ label, km: Math.round(km * 10) / 10 }));
    }
    return monthsShort.map((label, i) => ({
      label,
      km: Math.round(filtered.filter(f => new Date(f.date).getMonth() === i).reduce((s, f) => s + (Number(f.distance_km) || 0), 0) * 10) / 10,
    }));
  }, [flights, filtered, mode, monthsShort]);

  const gliderDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach(f => { if (f.glider) counts[f.glider] = (counts[f.glider] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
  }, [filtered]);

  const weekdayDistribution = useMemo(() => {
    const weekdaysShort = t("stats.weekdaysShort", { returnObjects: true }) as string[];
    const counts = new Array(7).fill(0);
    filtered.forEach(f => { const day = new Date(f.date).getDay(); counts[day === 0 ? 6 : day - 1]++; });
    return weekdaysShort.map((label, i) => ({ label, flights: counts[i] }));
  }, [filtered, t]);

  const formatDuration = (min: number) => { const h = Math.floor(min / 60); const m = min % 60; return h > 0 ? `${h}h ${m}m` : `${m}m`; };

  const navigatePeriod = (dir: number) => {
    if (mode === "month") {
      let m = selectedMonth + dir, y = selectedYear;
      if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; }
      setSelectedMonth(m); setSelectedYear(y);
    } else if (mode === "year") setSelectedYear(y => y + dir);
  };

  const chartConfig = { flights: { label: t("stats.flights"), color: "hsl(var(--primary))" }, minutes: { label: "Min", color: "hsl(var(--primary) / 0.6)" } };

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ChevronLeft className="h-5 w-5" /></Button>
        <h1 className="text-xl font-bold tracking-tight">{t("stats.title")}</h1>
      </div>

      <Tabs value={mode} onValueChange={(v) => setMode(v as FilterMode)}>
        <TabsList className="w-full">
          <TabsTrigger value="month" className="flex-1">{t("stats.month")}</TabsTrigger>
          <TabsTrigger value="year" className="flex-1">{t("stats.year")}</TabsTrigger>
          <TabsTrigger value="all" className="flex-1">{t("stats.all")}</TabsTrigger>
        </TabsList>
      </Tabs>

      {mode !== "all" && (
        <div className="flex items-center justify-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigatePeriod(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm font-medium min-w-[120px] text-center">{mode === "month" ? `${monthNames[selectedMonth]} ${selectedYear}` : selectedYear}</span>
          <Button variant="ghost" size="icon" onClick={() => navigatePeriod(1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: t("stats.flights"), value: kpis.total.toString() },
          { label: t("stats.totalFlightTime"), value: formatDuration(kpis.totalMin) },
          { label: t("stats.avgFlightTime"), value: formatDuration(kpis.avgMin) },
          { label: t("stats.longestFlight"), value: formatDuration(kpis.longest) },
          { label: t("stats.distance"), value: `${kpis.totalDist.toFixed(1)} km` },
          { label: t("stats.altitudeGain"), value: `${kpis.totalAlt.toLocaleString()} m` },
        ].map(({ label, value }) => (
          <Card key={label} className="border-0 shadow-sm">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-lg font-semibold tabular-nums">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {kpis.topTakeoff && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 flex justify-between">
            <div><p className="text-xs text-muted-foreground">{t("stats.topTakeoff")}</p><p className="text-sm font-medium">{kpis.topTakeoff[0]}</p></div>
            <p className="text-sm font-semibold tabular-nums self-end">{kpis.topTakeoff[1]}×</p>
          </CardContent>
        </Card>
      )}
      {kpis.topGlider && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 flex justify-between">
            <div><p className="text-xs text-muted-foreground">{t("stats.topGlider")}</p><p className="text-sm font-medium">{kpis.topGlider[0]}</p></div>
            <p className="text-sm font-semibold tabular-nums self-end">{kpis.topGlider[1]}×</p>
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      {chartData.length > 0 && (
        <>
          <StatsBarChart title={mode === "all" ? t("stats.flightsPerYear") : t("stats.flightsPerMonth")} data={chartData} dataKey="flights" config={chartConfig} xInterval={mode === "all" ? 0 : 1} />
          <StatsBarChart title={mode === "all" ? t("stats.flightTimePerYear") : t("stats.flightTimePerMonth")} data={chartData} dataKey="minutes" config={chartConfig} xInterval={mode === "all" ? 0 : 1} />
        </>
      )}

      {mode === "year" && yearCompareData.length > 0 && (
        <YearComparisonChart title={t("stats.yearComparison")} data={yearCompareData} currentLabel={`${selectedYear}`} previousLabel={`${selectedYear - 1}`} />
      )}

      {cumulativeData.length > 1 && mode === "all" && (
        <CumulativeHoursChart title={t("stats.cumulativeHours")} data={cumulativeData} tooltipLabel={t("stats.totalFlightTime")} />
      )}

      <RankedList title={t("stats.topTakeoffs")} items={topTakeoffs} />

      {mode !== "all" && altitudeTrend.some(d => d.avgAltitude > 0) && (
        <StatsBarChart title={t("stats.altitudeTrend")} data={altitudeTrend} dataKey="avgAltitude" config={{ avgAltitude: { label: t("stats.altitudeGain"), color: "hsl(var(--primary) / 0.7)" } }} />
      )}

      {distanceTrend.some(d => d.km > 0) && (
        <StatsBarChart title={mode === "all" ? t("stats.distanceTrendYear") : t("stats.distanceTrend")} data={distanceTrend} dataKey="km" config={{ km: { label: "km", color: "hsl(var(--primary) / 0.5)" } }} xInterval={mode === "all" ? 0 : 1} />
      )}

      <RankedList title={t("stats.gliderDistribution")} items={gliderDistribution} />

      {weekdayDistribution.some(d => d.flights > 0) && (
        <StatsBarChart title={t("stats.weekdayDistribution")} data={weekdayDistribution} dataKey="flights" config={{ flights: { label: t("stats.flights"), color: "hsl(var(--primary) / 0.6)" } }} xInterval={0} />
      )}

      {(mode === "year" || mode === "all") && Object.keys(heatmapData.days).length > 0 && (
        <ActivityHeatmap title={`${t("stats.activityHeatmap")} ${heatmapData.year}`} year={heatmapData.year} days={heatmapData.days} />
      )}
    </div>
  );
}
