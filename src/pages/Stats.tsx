import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, Tooltip, ResponsiveContainer } from "recharts";

interface Flight { id: string; date: string; duration_minutes: number | null; altitude_gain: number | null; distance_km: number | null; glider: string | null; takeoff_location_id: string | null; landing_location_id: string | null; takeoff_name: string | null; }
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
    supabase.from("flights").select("id, date, duration_minutes, altitude_gain, distance_km, glider, takeoff_location_id, landing_location_id, locations!flights_takeoff_location_id_fkey(name)").eq("user_id", user.id).order("date", { ascending: true }).then(({ data }) => {
      if (data) setFlights(data.map((f: any) => ({ ...f, takeoff_name: f.locations?.name || null })));
    });
  }, [user]);

  const filtered = useMemo(() => flights.filter((f) => { const d = new Date(f.date); if (mode === "month") return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth; if (mode === "year") return d.getFullYear() === selectedYear; return true; }), [flights, mode, selectedYear, selectedMonth]);

  const kpis = useMemo(() => {
    const total = filtered.length; const totalMin = filtered.reduce((s, f) => s + (f.duration_minutes || 0), 0); const avgMin = total > 0 ? Math.round(totalMin / total) : 0; const longest = filtered.reduce((m, f) => Math.max(m, f.duration_minutes || 0), 0); const totalDist = filtered.reduce((s, f) => s + (Number(f.distance_km) || 0), 0); const totalAlt = filtered.reduce((s, f) => s + (f.altitude_gain || 0), 0);
    const takeoffCounts: Record<string, number> = {}; filtered.forEach((f) => { if (f.takeoff_name) takeoffCounts[f.takeoff_name] = (takeoffCounts[f.takeoff_name] || 0) + 1; }); const topTakeoff = Object.entries(takeoffCounts).sort((a, b) => b[1] - a[1])[0];
    const gliderCounts: Record<string, number> = {}; filtered.forEach((f) => { if (f.glider) gliderCounts[f.glider] = (gliderCounts[f.glider] || 0) + 1; }); const topGlider = Object.entries(gliderCounts).sort((a, b) => b[1] - a[1])[0];
    return { total, totalMin, avgMin, longest, totalDist, totalAlt, topTakeoff, topGlider };
  }, [filtered]);

  const chartData = useMemo(() => {
    const map: Record<string, { flights: number; minutes: number }> = {};
    if (mode === "all") { flights.forEach((f) => { const y = new Date(f.date).getFullYear().toString(); if (!map[y]) map[y] = { flights: 0, minutes: 0 }; map[y].flights++; map[y].minutes += f.duration_minutes || 0; }); return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0])).map(([label, v]) => ({ label, ...v })); }
    else { for (let i = 0; i < 12; i++) map[monthsShort[i]] = { flights: 0, minutes: 0 }; filtered.forEach((f) => { const m = monthsShort[new Date(f.date).getMonth()]; map[m].flights++; map[m].minutes += f.duration_minutes || 0; }); return monthsShort.map((label) => ({ label, ...map[label] })); }
  }, [flights, filtered, mode, monthsShort]);

  // Cumulative flight hours over time
  const cumulativeData = useMemo(() => {
    if (flights.length === 0) return [];
    const sorted = [...flights].sort((a, b) => a.date.localeCompare(b.date));
    let cumMin = 0;
    const points: { date: string; hours: number }[] = [];
    sorted.forEach(f => {
      cumMin += f.duration_minutes || 0;
      points.push({ date: f.date, hours: Math.round(cumMin / 6) / 10 }); // hours with 1 decimal
    });
    // Sample to max ~50 points for readability
    if (points.length <= 50) return points;
    const step = Math.ceil(points.length / 50);
    return points.filter((_, i) => i % step === 0 || i === points.length - 1);
  }, [flights]);

  // Year comparison data
  const yearCompareData = useMemo(() => {
    if (mode !== "year") return [];
    const prevYear = selectedYear - 1;
    const data = monthsShort.map((label, i) => {
      const currentCount = flights.filter(f => { const d = new Date(f.date); return d.getFullYear() === selectedYear && d.getMonth() === i; }).length;
      const prevCount = flights.filter(f => { const d = new Date(f.date); return d.getFullYear() === prevYear && d.getMonth() === i; }).length;
      return { label, current: currentCount, previous: prevCount };
    });
    return data;
  }, [flights, mode, selectedYear, monthsShort]);

  // Top 5 takeoffs
  const topTakeoffs = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach(f => { if (f.takeoff_name) counts[f.takeoff_name] = (counts[f.takeoff_name] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }));
  }, [filtered]);

  // Activity heatmap data (current year)
  const heatmapData = useMemo(() => {
    const year = mode === "year" ? selectedYear : new Date().getFullYear();
    const map: Record<string, number> = {};
    flights.filter(f => new Date(f.date).getFullYear() === year).forEach(f => {
      map[f.date] = (map[f.date] || 0) + 1;
    });
    return { year, days: map };
  }, [flights, mode, selectedYear]);

  // Altitude trend per month
  const altitudeTrend = useMemo(() => {
    if (mode === "all") return [];
    return monthsShort.map((label, i) => {
      const monthFlights = filtered.filter(f => new Date(f.date).getMonth() === i);
      const avgAlt = monthFlights.length > 0 ? Math.round(monthFlights.reduce((s, f) => s + (f.altitude_gain || 0), 0) / monthFlights.length) : 0;
      return { label, avgAltitude: avgAlt };
    });
  }, [filtered, mode, monthsShort]);

  // Distance trend per month/year
  const distanceTrend = useMemo(() => {
    if (mode === "all") {
      const map: Record<string, number> = {};
      flights.forEach(f => { const y = new Date(f.date).getFullYear().toString(); map[y] = (map[y] || 0) + (Number(f.distance_km) || 0); });
      return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0])).map(([label, km]) => ({ label, km: Math.round(km * 10) / 10 }));
    }
    return monthsShort.map((label, i) => {
      const km = filtered.filter(f => new Date(f.date).getMonth() === i).reduce((s, f) => s + (Number(f.distance_km) || 0), 0);
      return { label, km: Math.round(km * 10) / 10 };
    });
  }, [flights, filtered, mode, monthsShort]);

  // Glider distribution
  const gliderDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach(f => { if (f.glider) counts[f.glider] = (counts[f.glider] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
  }, [filtered]);

  // Weekday distribution
  const weekdayDistribution = useMemo(() => {
    const weekdaysShort = t("stats.weekdaysShort", { returnObjects: true }) as string[];
    const counts = new Array(7).fill(0);
    filtered.forEach(f => {
      const day = new Date(f.date).getDay(); // 0=Sun
      const idx = day === 0 ? 6 : day - 1; // Mon=0..Sun=6
      counts[idx]++;
    });
    return weekdaysShort.map((label, i) => ({ label, flights: counts[i] }));
  }, [filtered, t]);

  const formatDuration = (min: number) => { const h = Math.floor(min / 60); const m = min % 60; return h > 0 ? `${h}h ${m}m` : `${m}m`; };
  const navigatePeriod = (dir: number) => { if (mode === "month") { let m = selectedMonth + dir; let y = selectedYear; if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } setSelectedMonth(m); setSelectedYear(y); } else if (mode === "year") setSelectedYear((y) => y + dir); };
  const chartConfig = { flights: { label: t("stats.flights"), color: "hsl(var(--primary))" }, minutes: { label: "Min", color: "hsl(var(--primary) / 0.6)" } };

  // Heatmap renderer
  const renderHeatmap = () => {
    const { year, days } = heatmapData;
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);
    const weeks: { date: Date; count: number }[][] = [];
    let currentWeek: { date: Date; count: number }[] = [];

    // Pad first week
    const firstDay = startDate.getDay();
    for (let i = 0; i < (firstDay === 0 ? 6 : firstDay - 1); i++) {
      currentWeek.push({ date: new Date(0), count: -1 });
    }

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split("T")[0];
      const dayOfWeek = d.getDay();
      currentWeek.push({ date: new Date(d), count: days[dateStr] || 0 });
      if (dayOfWeek === 0) { // Sunday = end of week
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }
    if (currentWeek.length > 0) weeks.push(currentWeek);

    const getColor = (count: number) => {
      if (count < 0) return "transparent";
      if (count === 0) return "hsl(var(--muted))";
      if (count === 1) return "hsl(var(--primary) / 0.3)";
      if (count === 2) return "hsl(var(--primary) / 0.5)";
      return "hsl(var(--primary) / 0.8)";
    };

    return (
      <div className="overflow-x-auto">
        <div className="flex gap-[2px]" style={{ minWidth: weeks.length * 12 }}>
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[2px]">
              {week.map((day, di) => (
                <div
                  key={di}
                  className="rounded-[2px]"
                  style={{ width: 10, height: 10, backgroundColor: getColor(day.count) }}
                  title={day.count >= 0 ? `${day.date.toLocaleDateString()}: ${day.count} ${t("stats.flights")}` : ""}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto space-y-5">
      <div className="flex items-center gap-3"><Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ChevronLeft className="h-5 w-5" /></Button><h1 className="text-xl font-bold tracking-tight">{t("stats.title")}</h1></div>
      <Tabs value={mode} onValueChange={(v) => setMode(v as FilterMode)}><TabsList className="w-full"><TabsTrigger value="month" className="flex-1">{t("stats.month")}</TabsTrigger><TabsTrigger value="year" className="flex-1">{t("stats.year")}</TabsTrigger><TabsTrigger value="all" className="flex-1">{t("stats.all")}</TabsTrigger></TabsList></Tabs>
      {mode !== "all" && (<div className="flex items-center justify-center gap-4"><Button variant="ghost" size="icon" onClick={() => navigatePeriod(-1)}><ChevronLeft className="h-4 w-4" /></Button><span className="text-sm font-medium min-w-[120px] text-center">{mode === "month" ? `${monthNames[selectedMonth]} ${selectedYear}` : selectedYear}</span><Button variant="ghost" size="icon" onClick={() => navigatePeriod(1)}><ChevronRight className="h-4 w-4" /></Button></div>)}
      
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3">
        {[{ label: t("stats.flights"), value: kpis.total.toString() }, { label: t("stats.totalFlightTime"), value: formatDuration(kpis.totalMin) }, { label: t("stats.avgFlightTime"), value: formatDuration(kpis.avgMin) }, { label: t("stats.longestFlight"), value: formatDuration(kpis.longest) }, { label: t("stats.distance"), value: `${kpis.totalDist.toFixed(1)} km` }, { label: t("stats.altitudeGain"), value: `${kpis.totalAlt.toLocaleString()} m` }].map(({ label, value }) => (<Card key={label} className="border-0 shadow-sm"><CardContent className="p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="text-lg font-semibold tabular-nums">{value}</p></CardContent></Card>))}
      </div>
      {kpis.topTakeoff && <Card className="border-0 shadow-sm"><CardContent className="p-3 flex justify-between"><div><p className="text-xs text-muted-foreground">{t("stats.topTakeoff")}</p><p className="text-sm font-medium">{kpis.topTakeoff[0]}</p></div><p className="text-sm font-semibold tabular-nums self-end">{kpis.topTakeoff[1]}×</p></CardContent></Card>}
      {kpis.topGlider && <Card className="border-0 shadow-sm"><CardContent className="p-3 flex justify-between"><div><p className="text-xs text-muted-foreground">{t("stats.topGlider")}</p><p className="text-sm font-medium">{kpis.topGlider[0]}</p></div><p className="text-sm font-semibold tabular-nums self-end">{kpis.topGlider[1]}×</p></CardContent></Card>}

      {/* Flights & Flight time bar charts */}
      {chartData.length > 0 && (<>
        <div><h2 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wider">{mode === "all" ? t("stats.flightsPerYear") : t("stats.flightsPerMonth")}</h2><Card className="border-0 shadow-sm"><CardContent className="p-3"><ChartContainer config={chartConfig} className="h-[180px] w-full"><BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}><CartesianGrid vertical={false} strokeDasharray="3 3" /><XAxis dataKey="label" tick={{ fontSize: 10 }} interval={mode === "all" ? 0 : 1} /><YAxis allowDecimals={false} tick={{ fontSize: 10 }} /><ChartTooltip content={<ChartTooltipContent />} /><Bar dataKey="flights" fill="var(--color-flights)" radius={[3, 3, 0, 0]} /></BarChart></ChartContainer></CardContent></Card></div>
        <div><h2 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wider">{mode === "all" ? t("stats.flightTimePerYear") : t("stats.flightTimePerMonth")}</h2><Card className="border-0 shadow-sm"><CardContent className="p-3"><ChartContainer config={chartConfig} className="h-[180px] w-full"><BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}><CartesianGrid vertical={false} strokeDasharray="3 3" /><XAxis dataKey="label" tick={{ fontSize: 10 }} interval={mode === "all" ? 0 : 1} /><YAxis allowDecimals={false} tick={{ fontSize: 10 }} /><ChartTooltip content={<ChartTooltipContent />} /><Bar dataKey="minutes" fill="var(--color-minutes)" radius={[3, 3, 0, 0]} /></BarChart></ChartContainer></CardContent></Card></div>
      </>)}

      {/* Year comparison */}
      {mode === "year" && yearCompareData.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wider">{t("stats.yearComparison")}</h2>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-3">
              <ChartContainer config={{ current: { label: `${selectedYear}`, color: "hsl(var(--primary))" }, previous: { label: `${selectedYear - 1}`, color: "hsl(var(--muted-foreground) / 0.4)" } }} className="h-[180px] w-full">
                <BarChart data={yearCompareData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={1} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="previous" fill="var(--color-previous)" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="current" fill="var(--color-current)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Cumulative flight hours */}
      {cumulativeData.length > 1 && mode === "all" && (
        <div>
          <h2 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wider">{t("stats.cumulativeHours")}</h2>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-3">
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={cumulativeData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={d => d.slice(0, 7)} interval={Math.max(1, Math.floor(cumulativeData.length / 6))} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => [`${v}h`, t("stats.totalFlightTime")]} labelFormatter={l => l} />
                  <Line type="monotone" dataKey="hours" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Top 5 Takeoffs horizontal bar */}
      {topTakeoffs.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wider">{t("stats.topTakeoffs")}</h2>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-3 space-y-2">
              {topTakeoffs.map((t, i) => {
                const max = topTakeoffs[0].count;
                return (
                  <div key={t.name} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-4 tabular-nums">{i + 1}.</span>
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-0.5">
                        <span className="text-xs font-medium truncate">{t.name}</span>
                        <span className="text-xs tabular-nums text-muted-foreground">{t.count}</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${(t.count / max) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Altitude trend */}
      {mode !== "all" && altitudeTrend.some(d => d.avgAltitude > 0) && (
        <div>
          <h2 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wider">{t("stats.altitudeTrend")}</h2>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-3">
              <ChartContainer config={{ avgAltitude: { label: t("stats.altitudeGain"), color: "hsl(var(--primary) / 0.7)" } }} className="h-[180px] w-full">
                <BarChart data={altitudeTrend} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={1} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="avgAltitude" fill="var(--color-avgAltitude)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Distance trend */}
      {distanceTrend.some(d => d.km > 0) && (
        <div>
          <h2 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wider">{mode === "all" ? t("stats.distanceTrendYear") : t("stats.distanceTrend")}</h2>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-3">
              <ChartContainer config={{ km: { label: "km", color: "hsl(var(--primary) / 0.5)" } }} className="h-[180px] w-full">
                <BarChart data={distanceTrend} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={mode === "all" ? 0 : 1} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="km" fill="var(--color-km)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Glider distribution */}
      {gliderDistribution.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wider">{t("stats.gliderDistribution")}</h2>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-3 space-y-2">
              {gliderDistribution.map((g, i) => {
                const max = gliderDistribution[0].count;
                return (
                  <div key={g.name} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-4 tabular-nums">{i + 1}.</span>
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-0.5">
                        <span className="text-xs font-medium truncate">{g.name}</span>
                        <span className="text-xs tabular-nums text-muted-foreground">{g.count}</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${(g.count / max) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Weekday distribution */}
      {weekdayDistribution.some(d => d.flights > 0) && (
        <div>
          <h2 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wider">{t("stats.weekdayDistribution")}</h2>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-3">
              <ChartContainer config={{ flights: { label: t("stats.flights"), color: "hsl(var(--primary) / 0.6)" } }} className="h-[180px] w-full">
                <BarChart data={weekdayDistribution} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="flights" fill="var(--color-flights)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {(mode === "year" || mode === "all") && Object.keys(heatmapData.days).length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wider">{t("stats.activityHeatmap")} {heatmapData.year}</h2>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-3">
              {renderHeatmap()}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
