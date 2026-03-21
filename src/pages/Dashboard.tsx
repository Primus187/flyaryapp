import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Plane, Clock, MapPin, BarChart3, Calendar, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Stats { totalFlights: number; totalMinutes: number; uniqueTakeoffs: number; uniqueLandings: number; }
interface RecentFlight { id: string; date: string; glider: string | null; duration_minutes: number | null; altitude_gain: number | null; takeoff_location: { name: string } | null; }
interface UpcomingEvent { id: string; title: string; event_date: string; status: string; meeting_point: string | null; group_name: string; isSignedUp: boolean; }

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [stats, setStats] = useState<Stats>({ totalFlights: 0, totalMinutes: 0, uniqueTakeoffs: 0, uniqueLandings: 0 });
  const [recent, setRecent] = useState<RecentFlight[]>([]);
  const [events, setEvents] = useState<UpcomingEvent[]>([]);

  const locale = i18n.language === "fr" ? "fr-CH" : i18n.language === "en" ? "en-GB" : "de-CH";

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const { data: flights } = await supabase
        .from("flights")
        .select("id, date, glider, duration_minutes, altitude_gain, distance_km, takeoff_location_id, landing_location_id, locations!flights_takeoff_location_id_fkey(name)")
        .eq("user_id", user.id)
        .order("date", { ascending: false });

      if (flights) {
        const takeoffIds = new Set(flights.map(f => f.takeoff_location_id).filter(Boolean));
        const landingIds = new Set(flights.map(f => f.landing_location_id).filter(Boolean));
        setStats({ totalFlights: flights.length, totalMinutes: flights.reduce((s, f) => s + (f.duration_minutes || 0), 0), uniqueTakeoffs: takeoffIds.size, uniqueLandings: landingIds.size });
        setRecent(flights.slice(0, 5).map((f: any) => ({ ...f, takeoff_location: f.locations })));
      }

      const { data: memberships } = await supabase.from("group_members").select("group_id, groups(name)").eq("user_id", user.id);
      if (memberships && memberships.length > 0) {
        const groupIds = memberships.map(m => m.group_id);
        const groupNames: Record<string, string> = {};
        memberships.forEach((m: any) => { groupNames[m.group_id] = m.groups?.name || ""; });
        const { data: upcomingEvents } = await supabase.from("flight_events").select("id, title, event_date, status, meeting_point, group_id").in("group_id", groupIds).gte("event_date", new Date().toISOString()).order("event_date", { ascending: true }).limit(3);
        if (upcomingEvents && upcomingEvents.length > 0) {
          const eventIds = upcomingEvents.map(e => e.id);
          const { data: signups } = await supabase.from("event_signups").select("event_id, signed_up").eq("user_id", user.id).in("event_id", eventIds);
          const signupMap: Record<string, boolean> = {};
          signups?.forEach(s => { signupMap[s.event_id] = s.signed_up; });
          setEvents(upcomingEvents.map(e => ({ ...e, group_name: groupNames[e.group_id] || "", isSignedUp: signupMap[e.id] ?? false })));
        }
      }
    };
    fetchData();
  }, [user]);

  const formatDuration = (min: number) => { const h = Math.floor(min / 60); const m = min % 60; return h > 0 ? `${h}h ${m}m` : `${m}m`; };

  const statusLabel: Record<string, string> = { announced: t("events.statusAnnounced"), confirmed: t("events.statusConfirmed"), cancelled: t("events.statusCancelled") };
  const statusColor = (s: string) => s === "confirmed" ? "bg-green-100 text-green-800 hover:bg-green-100/80 dark:bg-green-900/30 dark:text-green-400" : s === "cancelled" ? "bg-red-100 text-red-800 hover:bg-red-100/80 dark:bg-red-900/30 dark:text-red-400" : "bg-blue-100 text-blue-800 hover:bg-blue-100/80 dark:bg-blue-900/30 dark:text-blue-400";

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">{t("dashboard.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("dashboard.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => navigate("/stats")} className="gap-1.5"><BarChart3 className="h-4 w-4" /> {t("dashboard.stats")}</Button>
          <Button size="sm" onClick={() => navigate("/flights/new")} className="gap-1.5"><Plus className="h-4 w-4" /> {t("dashboard.newFlight")}</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          { icon: Plane, label: t("dashboard.flights"), value: stats.totalFlights.toString() },
          { icon: Clock, label: t("dashboard.flightTime"), value: formatDuration(stats.totalMinutes) },
          { icon: MapPin, label: t("dashboard.takeoffs"), value: stats.uniqueTakeoffs.toString() },
          { icon: MapPin, label: t("dashboard.landings"), value: stats.uniqueLandings.toString() },
        ].map(({ icon: Icon, label, value }) => (
          <Card key={label} className="border-0 shadow-sm bg-card/80 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center"><Icon className="h-3.5 w-3.5 text-primary" /></div>
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
              <p className="text-lg font-semibold tabular-nums">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {events.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">{t("dashboard.upcomingEvents")}</h2>
          <div className="space-y-2">
            {events.map((e) => (
              <Card key={e.id} className="border-0 shadow-sm cursor-pointer active:scale-[0.98] transition-transform" onClick={() => navigate(`/events/${e.id}`)}>
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-primary shrink-0" />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="font-medium text-sm">{e.title}</p>
                        {e.isSignedUp && <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(e.event_date).toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" })}
                        {e.meeting_point ? ` · ${e.meeting_point}` : ""}
                      </p>
                    </div>
                  </div>
                  <Badge className={statusColor(e.status) + " text-[10px] shrink-0"}>{statusLabel[e.status] || e.status}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">{t("dashboard.recentFlights")}</h2>
        {recent.length === 0 ? (
          <Card className="border-dashed border-2">
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground text-sm mb-3">{t("dashboard.noFlights")}</p>
              <Button variant="outline" size="sm" onClick={() => navigate("/flights/new")}>{t("dashboard.firstFlight")}</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {recent.map((f) => (
              <Card key={f.id} className="border-0 shadow-sm cursor-pointer active:scale-[0.98] transition-transform" onClick={() => navigate(`/flights/${f.id}`)}>
                <CardContent className="p-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{f.takeoff_location?.name || "–"}</p>
                    <p className="text-xs text-muted-foreground">{new Date(f.date).toLocaleDateString(locale)} · {f.glider || "–"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium tabular-nums">{f.duration_minutes ? formatDuration(f.duration_minutes) : "–"}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">{f.altitude_gain ? `+${f.altitude_gain}m` : ""}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
