import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Plane, Clock, MapPin, BarChart3, Calendar, CheckCircle2, XCircle, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import OnboardingDialog from "@/components/OnboardingDialog";
import EmptyState from "@/components/EmptyState";

interface Stats { totalFlights: number; totalMinutes: number; uniqueTakeoffs: number; uniqueLandings: number; }
interface RecentFlight { id: string; date: string; glider: string | null; duration_minutes: number | null; altitude_gain: number | null; distance_km: number | null; takeoff_location: { name: string } | null; landing_location: { name: string } | null; }
interface UpcomingEvent { id: string; title: string; event_date: string; status: string; meeting_point: string | null; group_name: string; event_type: string | null; max_participants: number | null; }
interface SignupRow { event_id: string; user_id: string; signed_up: boolean; }

function DashboardSkeleton() {
  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div><Skeleton className="h-8 w-32 mb-1" /><Skeleton className="h-4 w-24" /></div>
        <div className="flex gap-2"><Skeleton className="h-9 w-20 rounded-md" /><Skeleton className="h-9 w-20 rounded-md" /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map(i => (
          <Card key={i} className="border-0 shadow-sm"><CardContent className="p-4"><Skeleton className="h-4 w-16 mb-2" /><Skeleton className="h-6 w-12" /></CardContent></Card>
        ))}
      </div>
      <div><Skeleton className="h-4 w-28 mb-3" />{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-lg mb-2" />)}</div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [stats, setStats] = useState<Stats>({ totalFlights: 0, totalMinutes: 0, uniqueTakeoffs: 0, uniqueLandings: 0 });
  const [recent, setRecent] = useState<RecentFlight[]>([]);
  const [events, setEvents] = useState<UpcomingEvent[]>([]);
  const [signups, setSignups] = useState<SignupRow[]>([]);
  const [loading, setLoading] = useState(true);

  const locale = i18n.language === "fr" ? "fr-CH" : i18n.language === "en" ? "en-GB" : "de-CH";

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const { data: flights } = await supabase
        .from("flights")
        .select("id, date, glider, duration_minutes, altitude_gain, distance_km, takeoff_location_id, landing_location_id, locations!flights_takeoff_location_id_fkey(name), land:locations!flights_landing_location_id_fkey(name)")
        .eq("user_id", user.id)
        .order("date", { ascending: false });

      if (flights) {
        const takeoffIds = new Set(flights.map(f => f.takeoff_location_id).filter(Boolean));
        const landingIds = new Set(flights.map(f => f.landing_location_id).filter(Boolean));
        setStats({ totalFlights: flights.length, totalMinutes: flights.reduce((s, f) => s + (f.duration_minutes || 0), 0), uniqueTakeoffs: takeoffIds.size, uniqueLandings: landingIds.size });
        setRecent(flights.slice(0, 5).map((f: any) => ({ ...f, takeoff_location: f.locations, landing_location: f.land })));
      }

      const { data: memberships } = await supabase.from("group_members").select("group_id, groups(name)").eq("user_id", user.id);
      if (memberships && memberships.length > 0) {
        const groupIds = memberships.map(m => m.group_id);
        const groupNames: Record<string, string> = {};
        memberships.forEach((m: any) => { groupNames[m.group_id] = m.groups?.name || ""; });
        const { data: upcomingEvents } = await supabase.from("flight_events").select("id, title, event_date, status, meeting_point, group_id, event_type, max_participants").in("group_id", groupIds).gte("event_date", new Date().toISOString()).order("event_date", { ascending: true }).limit(3);
        if (upcomingEvents && upcomingEvents.length > 0) {
          const eventIds = upcomingEvents.map(e => e.id);
          const { data: sups } = await supabase.from("event_signups").select("event_id, user_id, signed_up").in("event_id", eventIds);
          if (sups) setSignups(sups);
          setEvents(upcomingEvents.map(e => ({ ...e, group_name: groupNames[e.group_id] || "" })));
        }
      }
      setLoading(false);
    };
    fetchData();
  }, [user]);

  const toggleSignup = async (eventId: string) => {
    if (!user) return;
    const existing = signups.find(s => s.event_id === eventId && s.user_id === user.id);
    if (existing) {
      const newVal = !existing.signed_up;
      await supabase.from("event_signups").update({ signed_up: newVal, updated_at: new Date().toISOString() }).eq("event_id", eventId).eq("user_id", user.id);
      setSignups(prev => prev.map(s => s.event_id === eventId && s.user_id === user.id ? { ...s, signed_up: newVal } : s));
    } else {
      await supabase.from("event_signups").insert({ event_id: eventId, user_id: user.id, signed_up: true });
      setSignups(prev => [...prev, { event_id: eventId, user_id: user.id, signed_up: true }]);
    }
  };

  const formatDuration = (min: number) => { const h = Math.floor(min / 60); const m = min % 60; return h > 0 ? `${h}h ${m}m` : `${m}m`; };

  const statusLabel: Record<string, string> = { announced: t("events.statusAnnounced"), confirmed: t("events.statusConfirmed"), cancelled: t("events.statusCancelled") };
  const statusColor = (s: string) => s === "confirmed" ? "bg-green-100 text-green-800 hover:bg-green-100/80 dark:bg-green-900/30 dark:text-green-400" : s === "cancelled" ? "bg-red-100 text-red-800 hover:bg-red-100/80 dark:bg-red-900/30 dark:text-red-400" : "bg-blue-100 text-blue-800 hover:bg-blue-100/80 dark:bg-blue-900/30 dark:text-blue-400";

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto space-y-6">
      <OnboardingDialog />
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
            {events.map((e) => {
              const mySignup = signups.find(s => s.event_id === e.id && s.user_id === user?.id);
              const isSignedUp = mySignup?.signed_up ?? false;
              const totalSignedUp = signups.filter(s => s.event_id === e.id && s.signed_up).length;
              return (
                <Card key={e.id} className="border-0 shadow-sm hover:bg-accent/50 cursor-pointer transition-colors">
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
              );
            })}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">{t("dashboard.recentFlights")}</h2>
        {recent.length === 0 ? (
          <EmptyState
            icon={Plane}
            title={t("dashboard.noFlights")}
            description={t("dashboard.noFlightsDesc")}
            actionLabel={t("dashboard.firstFlight")}
            onAction={() => navigate("/flights/new")}
          />
        ) : (
          <div className="space-y-2">
            {recent.map((f) => (
              <Card key={f.id} className="border-0 shadow-sm cursor-pointer active:scale-[0.98] transition-transform" onClick={() => navigate(`/flights/${f.id}`)}>
                <CardContent className="p-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-sm">{f.takeoff_location?.name || "–"}</p>
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
