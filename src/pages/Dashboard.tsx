import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Plane, Clock, MapPin, BarChart3, CheckCircle2, XCircle, Users, Target, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import OnboardingDialog from "@/components/OnboardingDialog";
import EmptyState from "@/components/EmptyState";
import ChallengeCard from "@/components/ChallengeCard";
import { useXcontestAutoSync } from "@/hooks/use-xcontest-auto-sync";

interface Stats { totalFlights: number; totalMinutes: number; uniqueTakeoffs: number; uniqueLandings: number; }
interface RecentFlight { id: string; date: string; glider: string | null; duration_minutes: number | null; altitude_gain: number | null; distance_km: number | null; takeoff_location: { name: string } | null; landing_location: { name: string } | null; photoUrl?: string; pilotName?: string; }
interface UpcomingEvent { id: string; title: string; event_date: string; status: string; meeting_point: string | null; group_name: string; event_type: string | null; max_participants: number | null; }
interface SignupRow { event_id: string; user_id: string; signed_up: boolean; }
interface ActiveChallenge { id: string; title: string; description: string | null; challenge_type: string; start_date: string; end_date: string | null; totalGoals: number; myCompleted: number; participantCount: number; }

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
  const { user } = useAuth();
  useXcontestAutoSync();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [stats, setStats] = useState<Stats>({ totalFlights: 0, totalMinutes: 0, uniqueTakeoffs: 0, uniqueLandings: 0 });
  const [recent, setRecent] = useState<RecentFlight[]>([]);
  const [events, setEvents] = useState<UpcomingEvent[]>([]);
  const [signups, setSignups] = useState<SignupRow[]>([]);
  const [challenges, setChallenges] = useState<ActiveChallenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{ pilot_name: string; avatar_url: string }>({ pilot_name: "", avatar_url: "" });
  const [avatarSignedUrl, setAvatarSignedUrl] = useState("");
  const [overdueGliders, setOverdueGliders] = useState<{ name: string; type: string }[]>([]);

  const locale = i18n.language === "fr" ? "fr-CH" : i18n.language === "en" ? "en-GB" : "de-CH";

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      // Profile
      const { data: prof } = await supabase.from("profiles").select("pilot_name, avatar_url").eq("user_id", user.id).single();
      if (prof) {
        setProfile({ pilot_name: prof.pilot_name || "", avatar_url: prof.avatar_url || "" });
        if (prof.avatar_url) {
          if (prof.avatar_url.startsWith("http")) setAvatarSignedUrl(prof.avatar_url);
          else {
            const { data: signed } = await supabase.storage.from("flight-photos").createSignedUrl(prof.avatar_url, 3600);
            if (signed?.signedUrl) setAvatarSignedUrl(signed.signedUrl);
          }
        }
      }

      const { data: flights } = await supabase
        .from("flights")
        .select("id, date, glider, duration_minutes, altitude_gain, distance_km, takeoff_location_id, landing_location_id, locations!flights_takeoff_location_id_fkey(name), land:locations!flights_landing_location_id_fkey(name)")
        .eq("user_id", user.id)
        .order("date", { ascending: false });

      if (flights) {
        const takeoffIds = new Set(flights.map(f => f.takeoff_location_id).filter(Boolean));
        const landingIds = new Set(flights.map(f => f.landing_location_id).filter(Boolean));
        setStats({ totalFlights: flights.length, totalMinutes: flights.reduce((s, f) => s + (f.duration_minutes || 0), 0), uniqueTakeoffs: takeoffIds.size, uniqueLandings: landingIds.size });

        const recentFlights = flights.slice(0, 5).map((f: any) => ({ ...f, takeoff_location: f.locations, landing_location: f.land }));
        
        // Fetch first photo for each recent flight
        const flightIds = recentFlights.map(f => f.id);
        if (flightIds.length > 0) {
          const { data: photos } = await supabase.from("flight_photos").select("flight_id, storage_path").in("flight_id", flightIds);
          if (photos && photos.length > 0) {
            const firstPhotos: Record<string, string> = {};
            photos.forEach(p => { if (!firstPhotos[p.flight_id]) firstPhotos[p.flight_id] = p.storage_path; });
            const paths = Object.values(firstPhotos);
            const signedUrls: Record<string, string> = {};
            for (const path of paths) {
              const { data: signed } = await supabase.storage.from("flight-photos").createSignedUrl(path, 3600);
              if (signed?.signedUrl) signedUrls[path] = signed.signedUrl;
            }
            recentFlights.forEach(f => {
              const p = firstPhotos[f.id];
              if (p && signedUrls[p]) f.photoUrl = signedUrls[p];
            });
          }
        }
        setRecent(recentFlights);
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

        // Load active challenges
        const today = new Date().toISOString().split("T")[0];
        const { data: challengesData } = await supabase.from("challenges" as any).select("*").in("group_id", groupIds);
        if (challengesData && challengesData.length > 0) {
          const activeChallenges = (challengesData as any[]).filter(c => !c.end_date || c.end_date >= today);
          const challengeIds = activeChallenges.map(c => c.id);
          
          const { data: allGoals } = await supabase.from("challenge_goals" as any).select("id, challenge_id").in("challenge_id", challengeIds);
          const { data: myProgressData } = await supabase.from("challenge_progress" as any).select("challenge_id, goal_id").eq("user_id", user.id).in("challenge_id", challengeIds);
          const { data: allProgressData } = await supabase.from("challenge_progress" as any).select("challenge_id, user_id").in("challenge_id", challengeIds);

          const goalsByChallenge: Record<string, number> = {};
          (allGoals as any[] || []).forEach(g => { goalsByChallenge[g.challenge_id] = (goalsByChallenge[g.challenge_id] || 0) + 1; });

          const myCompletedByChallenge: Record<string, number> = {};
          (myProgressData as any[] || []).forEach(p => { myCompletedByChallenge[p.challenge_id] = (myCompletedByChallenge[p.challenge_id] || 0) + 1; });

          const participantsByChallenge: Record<string, Set<string>> = {};
          (allProgressData as any[] || []).forEach(p => {
            if (!participantsByChallenge[p.challenge_id]) participantsByChallenge[p.challenge_id] = new Set();
            participantsByChallenge[p.challenge_id].add(p.user_id);
          });

          setChallenges(activeChallenges.map(c => ({
            id: c.id,
            title: c.title,
            description: c.description,
            challenge_type: c.challenge_type,
            start_date: c.start_date,
            end_date: c.end_date,
            totalGoals: goalsByChallenge[c.id] || 0,
            myCompleted: myCompletedByChallenge[c.id] || 0,
            participantCount: participantsByChallenge[c.id]?.size || 0,
          })));
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

  const initials = profile.pilot_name ? profile.pilot_name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) : user?.email?.[0]?.toUpperCase() || "?";

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto space-y-5">
      <OnboardingDialog />

      {/* Header with avatar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/profile")} className="relative p-[2px] rounded-full bg-gradient-to-tr from-primary via-secondary to-accent">
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
          <Button size="icon" variant="ghost" onClick={() => navigate("/stats")} className="h-9 w-9 rounded-full"><BarChart3 className="h-5 w-5" /></Button>
          <Button size="icon" onClick={() => navigate("/flights/new")} className="h-9 w-9 rounded-full"><Plus className="h-5 w-5" /></Button>
        </div>
      </div>

      {/* Compact stats row */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { icon: Plane, value: stats.totalFlights.toString(), label: t("dashboard.flights") },
          { icon: Clock, value: formatDuration(stats.totalMinutes), label: t("dashboard.flightTime") },
          { icon: MapPin, value: stats.uniqueTakeoffs.toString(), label: t("dashboard.takeoffs") },
          { icon: MapPin, value: stats.uniqueLandings.toString(), label: t("dashboard.landings") },
        ].map(({ icon: Icon, value, label }) => (
          <div key={label} className="rounded-xl bg-card p-3 text-center">
            <p className="text-base font-semibold tabular-nums">{value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Events */}
      {events.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wider">{t("dashboard.upcomingEvents")}</h2>
          <div className="space-y-2">
            {events.map((e) => {
              const mySignup = signups.find(s => s.event_id === e.id && s.user_id === user?.id);
              const isSignedUp = mySignup?.signed_up ?? false;
              const totalSignedUp = signups.filter(s => s.event_id === e.id && s.signed_up).length;
              return (
                <Card key={e.id} className="border-0 shadow-sm hover:bg-muted/50 cursor-pointer transition-colors">
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

      {/* Active Challenges */}
      {challenges.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wider">{t("dashboard.activeChallenges")}</h2>
          <div className="space-y-2">
            {challenges.map(c => (
              <ChallengeCard key={c.id} challenge={c} />
            ))}
          </div>
        </div>
      )}

      {/* Recent flights — Instagram-card style */}
      <div>
        <h2 className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wider">{t("dashboard.recentFlights")}</h2>
        {recent.length === 0 ? (
          <EmptyState
            icon={Plane}
            title={t("dashboard.noFlights")}
            description={t("dashboard.noFlightsDesc")}
            actionLabel={t("dashboard.firstFlight")}
            onAction={() => navigate("/flights/new")}
          />
        ) : (
          <div className="space-y-4">
            {recent.map((f) => (
              <Card key={f.id} className="border-0 shadow-sm overflow-hidden cursor-pointer active:scale-[0.98] transition-transform" onClick={() => navigate(`/flights/${f.id}`)}>
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
