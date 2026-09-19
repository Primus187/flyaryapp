import { useEffect, useState } from "react";
import { useQuery, QueryClient } from "@tanstack/react-query";
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
  event_category: string | null;
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

function parseStatsRow(row: any): DashboardStats & { totalAltitude: number; totalDistance: number } {
  return {
    totalFlights: Number(row?.total_flights || 0),
    totalMinutes: Number(row?.total_minutes || 0),
    uniqueTakeoffs: Number(row?.unique_takeoffs || 0),
    uniqueLandings: Number(row?.unique_landings || 0),
    totalAltitude: Number(row?.total_altitude || 0),
    totalDistance: Number(row?.total_distance || 0),
  };
}

async function fetchDashboardData(userId: string, onProgress?: (pct: number) => void): Promise<DashboardData> {
  const currentYear = new Date().getFullYear();
  const prevYear = currentYear - 1;

  // === BATCH 1: Everything that doesn't depend on other results ===
  const [statsRes, currentYearRes, prevYearRes, profileRes, recentRes, membershipsRes, glidersRes] = await Promise.all([
    supabase.rpc("get_pilot_stats", { _user_id: userId }),
    supabase.rpc("get_pilot_stats", { _user_id: userId, _year: currentYear }),
    supabase.rpc("get_pilot_stats", { _user_id: userId, _year: prevYear }),
    supabase.from("profiles").select("pilot_name, avatar_url").eq("user_id", userId).single(),
    supabase.from("flights")
      .select("id, date, glider, duration_minutes, altitude_gain, distance_km, takeoff_location_id, landing_location_id, locations!flights_takeoff_location_id_fkey(name), land:locations!flights_landing_location_id_fkey(name)")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .limit(5),
    supabase.from("group_members").select("group_id, groups(name)").eq("user_id", userId),
    supabase.from("pilot_gliders").select("manufacturer, model, next_check_date, reserve_repack_date").eq("user_id", userId),
  ]);

  // Parse stats
  const statsRow = statsRes.data?.[0];
  const stats: DashboardStats = {
    totalFlights: Number(statsRow?.total_flights || 0),
    totalMinutes: Number(statsRow?.total_minutes || 0),
    uniqueTakeoffs: Number(statsRow?.unique_takeoffs || 0),
    uniqueLandings: Number(statsRow?.unique_landings || 0),
  };

  const yearComparison: YearComparison = {
    currentYear,
    current: parseStatsRow(currentYearRes.data?.[0]),
    previous: parseStatsRow(prevYearRes.data?.[0]),
  };

  // Profile
  const prof = profileRes.data;
  const profile: DashboardProfile = { pilot_name: prof?.pilot_name || "", avatar_url: prof?.avatar_url || "" };

  // Recent flights
  const recentFlights: RecentFlight[] = (recentRes.data || []).map((f: any) => ({
    ...f,
    takeoff_location: f.locations,
    landing_location: f.land,
  }));

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

  onProgress?.(60);

  // === BATCH 2: Avatar, flight photos, and group-dependent data — all in parallel ===
  const flightIds = recentFlights.map(f => f.id);
  const memberships = membershipsRes.data;
  const groupIds = memberships?.map(m => m.group_id) || [];
  const groupNames: Record<string, string> = {};
  memberships?.forEach((m: any) => { groupNames[m.group_id] = m.groups?.name || ""; });

  const batch2Promises: PromiseLike<any>[] = [
    // 0: avatar signed URL
    prof?.avatar_url ? getSignedUrl("flight-photos", prof.avatar_url) : Promise.resolve(""),
    // 1: flight photos
    flightIds.length > 0
      ? supabase.from("flight_photos").select("flight_id, storage_path").in("flight_id", flightIds).then(r => r)
      : Promise.resolve({ data: null }),
    // 2: events
    groupIds.length > 0
      ? supabase.from("flight_events").select("id, title, event_date, status, meeting_point, group_id, event_type, event_category, max_participants")
          .in("group_id", groupIds)
          .gte("event_date", new Date().toISOString())
          .order("event_date", { ascending: true })
          .limit(3).then(r => r)
      : Promise.resolve({ data: null }),
    // 3: challenges
    groupIds.length > 0
      ? supabase.from("challenges").select("*").in("group_id", groupIds).then(r => r)
      : Promise.resolve({ data: null }),
  ];

  const [avatarSignedUrl, photosRes, eventsRes, challengesRes] = await Promise.all(batch2Promises);

  // Process flight photos
  if (photosRes.data && photosRes.data.length > 0) {
    const firstPhotos: Record<string, string> = {};
    photosRes.data.forEach((p: any) => { if (!firstPhotos[p.flight_id]) firstPhotos[p.flight_id] = p.storage_path; });
    const signedMap = await getSignedUrls("flight-photos", Object.values(firstPhotos));
    recentFlights.forEach(f => {
      const p = firstPhotos[f.id];
      if (p && signedMap[p]) f.photoUrl = signedMap[p];
    });
  }

  // Process events & signups
  let events: UpcomingEvent[] = [];
  let signups: SignupRow[] = [];
  if (eventsRes.data && eventsRes.data.length > 0) {
    const eventIds = eventsRes.data.map((e: any) => e.id);
    const { data: sups } = await supabase.from("event_signups").select("event_id, user_id, signed_up").in("event_id", eventIds);
    if (sups) signups = sups;
    events = eventsRes.data.map((e: any) => ({ ...e, group_name: groupNames[e.group_id] || "" }));
  }

  // Process challenges
  let challenges: ActiveChallenge[] = [];
  if (challengesRes.data && challengesRes.data.length > 0) {
    const today = new Date().toISOString().split("T")[0];
    const activeChallenges = (challengesRes.data as any[]).filter(c => !c.end_date || c.end_date >= today);
    const challengeIds = activeChallenges.map(c => c.id);

    if (challengeIds.length > 0) {
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

  onProgress?.(100);
  return { stats, yearComparison, recent: recentFlights, events, signups, challenges, profile, avatarSignedUrl, overdueGliders };
}

export function prefetchDashboard(userId: string, queryClient: QueryClient, onProgress?: (pct: number) => void) {
  return queryClient.prefetchQuery({
    queryKey: ["dashboard", userId],
    queryFn: () => fetchDashboardData(userId, onProgress),
    staleTime: 5 * 60 * 1000,
  });
}

export function useDashboardData() {
  const { user } = useAuth();
  
  const [signups, setSignups] = useState<SignupRow[]>([]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["dashboard", user?.id],
    queryFn: () => fetchDashboardData(user!.id),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (data?.signups) setSignups(data.signups);
  }, [data?.signups]);

  const toggleSignup = async (eventId: string) => {
    if (!user) return;
    const existing = signups.find(s => s.event_id === eventId && s.user_id === user.id);
    let error: any = null;
    if (existing) {
      const newVal = !existing.signed_up;
      ({ error } = await supabase.from("event_signups").update({ signed_up: newVal, updated_at: new Date().toISOString() }).eq("event_id", eventId).eq("user_id", user.id));
      if (!error) setSignups(prev => prev.map(s => s.event_id === eventId && s.user_id === user.id ? { ...s, signed_up: newVal } : s));
    } else {
      ({ error } = await supabase.from("event_signups").insert({ event_id: eventId, user_id: user.id, signed_up: true }));
      if (!error) setSignups(prev => [...prev, { event_id: eventId, user_id: user.id, signed_up: true }]);
    }
    if (error) {
      toast({
        title: i18n.t("common.error"),
        description: /deadline/i.test(error.message) ? i18n.t("events.deadlinePassed") : error.message,
        variant: "destructive",
      });
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
