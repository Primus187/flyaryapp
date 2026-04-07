import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getSignedUrl, getSignedUrls } from "@/lib/signed-url-cache";

export interface DashboardStats {
  totalFlights: number;
  totalMinutes: number;
  uniqueTakeoffs: number;
  uniqueLandings: number;
}

export interface YearComparison {
  currentYear: number;
  current: DashboardStats & { totalAltitude: number; totalDistance: number };
  previous: DashboardStats & { totalAltitude: number; totalDistance: number };
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

interface DashboardData {
  stats: DashboardStats;
  yearComparison: YearComparison | null;
  recent: RecentFlight[];
  events: UpcomingEvent[];
  signups: SignupRow[];
  challenges: ActiveChallenge[];
  profile: DashboardProfile;
  avatarSignedUrl: string;
  overdueGliders: GliderWarning[];
}

async function fetchDashboardData(userId: string): Promise<DashboardData> {
  const currentYear = new Date().getFullYear();
  const prevYear = currentYear - 1;

  // Parallel: stats (current + prev year), profile, recent flights, memberships, gliders
  const [statsRes, prevStatsRes, profileRes, recentRes, membershipsRes, glidersRes] = await Promise.all([
    supabase.rpc("get_pilot_stats", { _user_id: userId }),
    supabase.rpc("get_pilot_stats", { _user_id: userId, _year: currentYear }),
    supabase.from("profiles").select("pilot_name, avatar_url").eq("user_id", userId).single(),
    supabase.from("flights")
      .select("id, date, glider, duration_minutes, altitude_gain, distance_km, takeoff_location_id, landing_location_id, locations!flights_takeoff_location_id_fkey(name), land:locations!flights_landing_location_id_fkey(name)")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .limit(5),
    supabase.from("group_members").select("group_id, groups(name)").eq("user_id", userId),
    supabase.from("pilot_gliders").select("manufacturer, model, next_check_date, reserve_repack_date").eq("user_id", userId),
  ]);

  // Stats from RPC
  const statsRow = statsRes.data?.[0];
  const stats: DashboardStats = {
    totalFlights: Number(statsRow?.total_flights || 0),
    totalMinutes: Number(statsRow?.total_minutes || 0),
    uniqueTakeoffs: Number(statsRow?.unique_takeoffs || 0),
    uniqueLandings: Number(statsRow?.unique_landings || 0),
  };

  // Year comparison: fetch current year stats (already have) + prev year
  const currentYearRow = prevStatsRes.data?.[0];
  const prevYearRes = await supabase.rpc("get_pilot_stats", { _user_id: userId, _year: prevYear });
  const prevYearRow = prevYearRes.data?.[0];

  const yearComparison: YearComparison = {
    currentYear,
    current: {
      totalFlights: Number(currentYearRow?.total_flights || 0),
      totalMinutes: Number(currentYearRow?.total_minutes || 0),
      uniqueTakeoffs: Number(currentYearRow?.unique_takeoffs || 0),
      uniqueLandings: Number(currentYearRow?.unique_landings || 0),
      totalAltitude: Number(currentYearRow?.total_altitude || 0),
      totalDistance: Number(currentYearRow?.total_distance || 0),
    },
    previous: {
      totalFlights: Number(prevYearRow?.total_flights || 0),
      totalMinutes: Number(prevYearRow?.total_minutes || 0),
      uniqueTakeoffs: Number(prevYearRow?.unique_takeoffs || 0),
      uniqueLandings: Number(prevYearRow?.unique_landings || 0),
      totalAltitude: Number(prevYearRow?.total_altitude || 0),
      totalDistance: Number(prevYearRow?.total_distance || 0),
    },
  };

  // Profile
  const prof = profileRes.data;
  let avatarSignedUrl = "";
  const profile: DashboardProfile = { pilot_name: prof?.pilot_name || "", avatar_url: prof?.avatar_url || "" };
  if (prof?.avatar_url) {
    avatarSignedUrl = await getSignedUrl("flight-photos", prof.avatar_url);
  }

  // Recent flights with photos
  const recentFlights: RecentFlight[] = (recentRes.data || []).map((f: any) => ({
    ...f,
    takeoff_location: f.locations,
    landing_location: f.land,
  }));

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

  // Glider warnings
  const overdueGliders: GliderWarning[] = [];
  if (glidersRes.data) {
    const now = new Date();
    (glidersRes.data as any[]).forEach(g => {
      const name = `${g.manufacturer} ${g.model}`;
      if (g.next_check_date && new Date(g.next_check_date) < now) overdueGliders.push({ name, type: "check" });
      if (g.reserve_repack_date && new Date(g.reserve_repack_date) < now) overdueGliders.push({ name, type: "reserve" });
    });
  }

  // Events & challenges (group-dependent)
  let events: UpcomingEvent[] = [];
  let signups: SignupRow[] = [];
  let challenges: ActiveChallenge[] = [];

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

    if (eventsRes.data && eventsRes.data.length > 0) {
      const eventIds = eventsRes.data.map(e => e.id);
      const { data: sups } = await supabase.from("event_signups").select("event_id, user_id, signed_up").in("event_id", eventIds);
      if (sups) signups = sups;
      events = eventsRes.data.map(e => ({ ...e, group_name: groupNames[e.group_id] || "" }));
    }

    if (challengesRes.data && challengesRes.data.length > 0) {
      const today = new Date().toISOString().split("T")[0];
      const activeChallenges = (challengesRes.data as any[]).filter(c => !c.end_date || c.end_date >= today);
      const challengeIds = activeChallenges.map(c => c.id);

      const [goalsRes, myProgressRes, allProgressRes] = await Promise.all([
        supabase.from("challenge_goals").select("id, challenge_id").in("challenge_id", challengeIds),
        supabase.from("challenge_progress").select("challenge_id, goal_id").eq("user_id", userId).in("challenge_id", challengeIds),
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

      challenges = activeChallenges.map(c => ({
        id: c.id,
        title: c.title,
        description: c.description,
        challenge_type: c.challenge_type,
        start_date: c.start_date,
        end_date: c.end_date,
        totalGoals: goalsByChallenge[c.id] || 0,
        myCompleted: myCompletedByChallenge[c.id] || 0,
        participantCount: participantsByChallenge[c.id]?.size || 0,
      }));
    }
  }

  return { stats, yearComparison, recent: recentFlights, events, signups, challenges, profile, avatarSignedUrl, overdueGliders };
}

export function useDashboardData() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [signups, setSignups] = useState<SignupRow[]>([]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["dashboard", user?.id],
    queryFn: () => fetchDashboardData(user!.id),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  // Sync signups from query data
  useEffect(() => {
    if (data?.signups) setSignups(data.signups);
  }, [data?.signups]);

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
    stats: data?.stats || { totalFlights: 0, totalMinutes: 0, uniqueTakeoffs: 0, uniqueLandings: 0 },
    yearComparison: data?.yearComparison || null,
    recent: data?.recent || [],
    events: data?.events || [],
    signups,
    challenges: data?.challenges || [],
    loading: isLoading,
    error: error ? (error as Error).message : null,
    profile: data?.profile || { pilot_name: "", avatar_url: "" },
    avatarSignedUrl: data?.avatarSignedUrl || "",
    overdueGliders: data?.overdueGliders || [],
    toggleSignup,
    refetch,
    user,
  };
}
