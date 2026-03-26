import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getSignedUrl, getSignedUrls } from "@/lib/signed-url-cache";

export interface DashboardStats {
  totalFlights: number;
  totalMinutes: number;
  uniqueTakeoffs: number;
  uniqueLandings: number;
}

export interface RecentFlight {
  id: string;
  date: string;
  glider: string | null;
  duration_minutes: number | null;
  altitude_gain: number | null;
  distance_km: number | null;
  takeoff_location: { name: string } | null;
  landing_location: { name: string } | null;
  photoUrl?: string;
}

export interface UpcomingEvent {
  id: string;
  title: string;
  event_date: string;
  status: string;
  meeting_point: string | null;
  group_name: string;
  event_type: string | null;
  max_participants: number | null;
}

export interface SignupRow {
  event_id: string;
  user_id: string;
  signed_up: boolean;
}

export interface ActiveChallenge {
  id: string;
  title: string;
  description: string | null;
  challenge_type: string;
  start_date: string;
  end_date: string | null;
  totalGoals: number;
  myCompleted: number;
  participantCount: number;
}

export interface GliderWarning {
  name: string;
  type: string;
}

export interface DashboardProfile {
  pilot_name: string;
  avatar_url: string;
}

export function useDashboardData() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({ totalFlights: 0, totalMinutes: 0, uniqueTakeoffs: 0, uniqueLandings: 0 });
  const [recent, setRecent] = useState<RecentFlight[]>([]);
  const [events, setEvents] = useState<UpcomingEvent[]>([]);
  const [signups, setSignups] = useState<SignupRow[]>([]);
  const [challenges, setChallenges] = useState<ActiveChallenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<DashboardProfile>({ pilot_name: "", avatar_url: "" });
  const [avatarSignedUrl, setAvatarSignedUrl] = useState("");
  const [overdueGliders, setOverdueGliders] = useState<GliderWarning[]>([]);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      // Parallel independent queries
      const [profileRes, flightsRes, membershipsRes, glidersRes] = await Promise.all([
        supabase.from("profiles").select("pilot_name, avatar_url").eq("user_id", user.id).single(),
        supabase.from("flights")
          .select("id, date, glider, duration_minutes, altitude_gain, distance_km, takeoff_location_id, landing_location_id, locations!flights_takeoff_location_id_fkey(name), land:locations!flights_landing_location_id_fkey(name)")
          .eq("user_id", user.id)
          .order("date", { ascending: false }),
        supabase.from("group_members").select("group_id, groups(name)").eq("user_id", user.id),
        supabase.from("pilot_gliders").select("manufacturer, model, next_check_date, reserve_repack_date").eq("user_id", user.id),
      ]);

      // Profile
      const prof = profileRes.data;
      if (prof) {
        setProfile({ pilot_name: prof.pilot_name || "", avatar_url: prof.avatar_url || "" });
        if (prof.avatar_url) {
          const url = await getSignedUrl("flight-photos", prof.avatar_url);
          setAvatarSignedUrl(url);
        }
      }

      // Flights & stats
      const flights = flightsRes.data;
      if (flights) {
        const takeoffIds = new Set(flights.map(f => f.takeoff_location_id).filter(Boolean));
        const landingIds = new Set(flights.map(f => f.landing_location_id).filter(Boolean));
        setStats({
          totalFlights: flights.length,
          totalMinutes: flights.reduce((s, f) => s + (f.duration_minutes || 0), 0),
          uniqueTakeoffs: takeoffIds.size,
          uniqueLandings: landingIds.size,
        });

        const recentFlights: RecentFlight[] = flights.slice(0, 5).map((f: any) => ({
          ...f,
          takeoff_location: f.locations,
          landing_location: f.land,
        }));

        // Batch fetch photos for recent flights
        const flightIds = recentFlights.map(f => f.id);
        if (flightIds.length > 0) {
          const { data: photos } = await supabase.from("flight_photos").select("flight_id, storage_path").in("flight_id", flightIds);
          if (photos && photos.length > 0) {
            const firstPhotos: Record<string, string> = {};
            photos.forEach(p => { if (!firstPhotos[p.flight_id]) firstPhotos[p.flight_id] = p.storage_path; });
            const signedMap = await getSignedUrls("flight-photos", Object.values(firstPhotos));
            recentFlights.forEach(f => {
              const p = firstPhotos[f.id];
              if (p && signedMap[p]) f.photoUrl = signedMap[p];
            });
          }
        }
        setRecent(recentFlights);
      }

      // Glider maintenance warnings
      if (glidersRes.data) {
        const now = new Date();
        const warnings: GliderWarning[] = [];
        (glidersRes.data as any[]).forEach(g => {
          const name = `${g.manufacturer} ${g.model}`;
          if (g.next_check_date && new Date(g.next_check_date) < now) warnings.push({ name, type: "check" });
          if (g.reserve_repack_date && new Date(g.reserve_repack_date) < now) warnings.push({ name, type: "reserve" });
        });
        setOverdueGliders(warnings);
      }

      // Group-dependent data (events + challenges)
      const memberships = membershipsRes.data;
      if (memberships && memberships.length > 0) {
        const groupIds = memberships.map(m => m.group_id);
        const groupNames: Record<string, string> = {};
        memberships.forEach((m: any) => { groupNames[m.group_id] = m.groups?.name || ""; });

        const [eventsRes, challengesRes] = await Promise.all([
          supabase.from("flight_events").select("id, title, event_date, status, meeting_point, group_id, event_type, max_participants")
            .in("group_id", groupIds)
            .gte("event_date", new Date().toISOString())
            .order("event_date", { ascending: true })
            .limit(3),
          supabase.from("challenges").select("*").in("group_id", groupIds),
        ]);

        // Events
        if (eventsRes.data && eventsRes.data.length > 0) {
          const eventIds = eventsRes.data.map(e => e.id);
          const { data: sups } = await supabase.from("event_signups").select("event_id, user_id, signed_up").in("event_id", eventIds);
          if (sups) setSignups(sups);
          setEvents(eventsRes.data.map(e => ({ ...e, group_name: groupNames[e.group_id] || "" })));
        }

        // Challenges
        if (challengesRes.data && challengesRes.data.length > 0) {
          const today = new Date().toISOString().split("T")[0];
          const activeChallenges = (challengesRes.data as any[]).filter(c => !c.end_date || c.end_date >= today);
          const challengeIds = activeChallenges.map(c => c.id);

          const [goalsRes, myProgressRes, allProgressRes] = await Promise.all([
            supabase.from("challenge_goals").select("id, challenge_id").in("challenge_id", challengeIds),
            supabase.from("challenge_progress").select("challenge_id, goal_id").eq("user_id", user.id).in("challenge_id", challengeIds),
            supabase.from("challenge_progress").select("challenge_id, user_id").in("challenge_id", challengeIds),
          ]);

          const goalsByChallenge: Record<string, number> = {};
          (goalsRes.data || []).forEach((g: any) => { goalsByChallenge[g.challenge_id] = (goalsByChallenge[g.challenge_id] || 0) + 1; });

          const myCompletedByChallenge: Record<string, number> = {};
          (myProgressRes.data || []).forEach((p: any) => { myCompletedByChallenge[p.challenge_id] = (myCompletedByChallenge[p.challenge_id] || 0) + 1; });

          const participantsByChallenge: Record<string, Set<string>> = {};
          (allProgressRes.data || []).forEach((p: any) => {
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
    } catch (err: any) {
      setError(err.message || "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

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

  return {
    stats, recent, events, signups, challenges, loading, error, profile, avatarSignedUrl, overdueGliders,
    toggleSignup, refetch: fetchData, user,
  };
}
