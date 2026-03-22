import React, { useEffect, useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import FeedCard, { type FeedFlight } from "@/components/FeedCard";
import FeedEventCard, { type FeedEvent } from "@/components/FeedEventCard";
import FeedAchievementCard, { type FeedAchievement } from "@/components/FeedAchievementCard";
import EmptyState from "@/components/EmptyState";
import { Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

type FeedItem =
  | { type: "flight"; date: string; data: FeedFlight }
  | { type: "event"; date: string; data: FeedEvent }
  | { type: "achievement"; date: string; data: FeedAchievement };

function FeedSkeleton() {
  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto space-y-4">
      <Skeleton className="h-6 w-20" />
      {[1, 2].map(i => (
        <div key={i} className="space-y-2">
          <div className="flex items-center gap-3"><Skeleton className="h-8 w-8 rounded-full" /><Skeleton className="h-4 w-24" /></div>
          <Skeleton className="aspect-square w-full rounded-xl" />
          <Skeleton className="h-4 w-32" />
        </div>
      ))}
    </div>
  );
}

export default function Feed() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);
  const isPulling = useRef(false);

  const fetchFeed = useCallback(async () => {
    if (!user) return;

    const { data: memberships } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("user_id", user.id);

    if (!memberships || memberships.length === 0) {
      setLoading(false);
      return;
    }

    const groupIds = memberships.map(m => m.group_id);

    const { data: groups } = await supabase
      .from("groups")
      .select("id, name")
      .in("id", groupIds);
    const groupMap: Record<string, string> = {};
    groups?.forEach(g => { groupMap[g.id] = g.name; });

    const [flightsRes, eventsRes, achievementsRes] = await Promise.all([
      fetchFlights(user.id, groupIds, groupMap),
      fetchEvents(user.id, groupIds, groupMap),
      fetchAchievements(user.id, groupIds, groupMap),
    ]);

    const allItems: FeedItem[] = [
      ...flightsRes.map(f => ({ type: "flight" as const, date: f.created_at, data: f })),
      ...eventsRes.map(e => ({ type: "event" as const, date: e.created_at || e.event_date, data: e })),
      ...achievementsRes.map(a => ({ type: "achievement" as const, date: a.created_at, data: a })),
    ];

    allItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setItems(allItems);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchFeed(); }, [fetchFeed]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchFeed();
    setRefreshing(false);
    setPullDistance(0);
  }, [fetchFeed]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const scrollTop = scrollRef.current?.scrollTop ?? window.scrollY;
    if (scrollTop <= 0) {
      touchStartY.current = e.touches[0].clientY;
      isPulling.current = true;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling.current) return;
    const diff = e.touches[0].clientY - touchStartY.current;
    if (diff > 0) {
      setPullDistance(Math.min(diff * 0.5, 80));
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (pullDistance > 50 && !refreshing) {
      handleRefresh();
    } else {
      setPullDistance(0);
    }
    isPulling.current = false;
  }, [pullDistance, refreshing, handleRefresh]);

  
  const handleLikeToggle = async (itemType: "flight" | "event" | "achievement", itemId: string) => {
    if (!user) return;

    const colName = itemType === "flight" ? "flight_id" : itemType === "event" ? "event_id" : "achievement_id";

    const item = items.find(i => i.data.id === itemId);
    if (!item) return;

    const likes = (item.data as any).likes || [];
    const isLiked = likes.some((l: any) => l.user_id === user.id);

    if (isLiked) {
      await supabase.from("feed_likes").delete().eq(colName, itemId).eq("user_id", user.id);
    } else {
      await supabase.from("feed_likes").insert({ [colName]: itemId, user_id: user.id } as any);
    }

    setItems(prev => prev.map(i => {
      if (i.data.id !== itemId) return i;
      const currentLikes = (i.data as any).likes || [];
      const newLikes = isLiked
        ? currentLikes.filter((l: any) => l.user_id !== user.id)
        : [...currentLikes, { user_id: user.id }];
      return { ...i, data: { ...i.data, likes: newLikes } } as FeedItem;
    }));
  };

  // ── Generic comment ──
  const handleComment = async (itemType: "flight" | "event" | "achievement", itemId: string, message: string) => {
    if (!user) return;

    const colName = itemType === "flight" ? "flight_id" : itemType === "event" ? "event_id" : "achievement_id";

    const { data } = await supabase.from("feed_comments")
      .insert({ [colName]: itemId, user_id: user.id, message } as any)
      .select("id, created_at").single();

    if (data) {
      const { data: prof } = await supabase.from("profiles").select("pilot_name").eq("user_id", user.id).single();
      setItems(prev => prev.map(i => {
        if (i.data.id !== itemId) return i;
        const currentComments = (i.data as any).comments || [];
        return {
          ...i, data: {
            ...i.data, comments: [...currentComments, {
              id: data.id, user_id: user.id, message, created_at: data.created_at,
              pilot_name: prof?.pilot_name || "Pilot"
            }]
          }
        } as FeedItem;
      }));
    }
  };

  const handleEventSignup = async (eventId: string) => {
    if (!user) return;
    const item = items.find(i => i.type === "event" && i.data.id === eventId);
    if (!item || item.type !== "event") return;

    if (item.data.user_signed_up) {
      await supabase.from("event_signups").delete().eq("event_id", eventId).eq("user_id", user.id);
      setItems(prev => prev.map(i => i.type === "event" && i.data.id === eventId
        ? { ...i, data: { ...i.data, user_signed_up: false, signup_count: i.data.signup_count - 1 } }
        : i));
    } else {
      await supabase.from("event_signups").upsert({ event_id: eventId, user_id: user.id, signed_up: true });
      setItems(prev => prev.map(i => i.type === "event" && i.data.id === eventId
        ? { ...i, data: { ...i.data, user_signed_up: true, signup_count: i.data.signup_count + 1 } }
        : i));
    }
  };

  if (loading) return <FeedSkeleton />;

  return (
    <div
      ref={scrollRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="px-4 pt-6 pb-4 max-w-lg mx-auto space-y-4"
    >
      {/* Pull-to-refresh indicator */}
      <div
        className="flex items-center justify-center overflow-hidden transition-all duration-200"
        style={{ height: pullDistance > 0 || refreshing ? Math.max(pullDistance, refreshing ? 40 : 0) : 0 }}
      >
        <div className={`text-muted-foreground ${refreshing ? 'animate-spin' : ''}`}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
        </div>
      </div>

      <h1 className="text-lg font-bold tracking-tight">{t("feed.title")}</h1>

      {items.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t("feed.noFlights")}
          description={t("feed.noFlightsDesc")}
          actionLabel={t("groups.joinGroup")}
          onAction={() => navigate("/groups")}
        />
      ) : (
        <div className="space-y-4">
          {items.map(item => {
            if (item.type === "flight") {
              return <FeedCard key={`f-${item.data.id}`} flight={item.data}
                onLikeToggle={(id) => handleLikeToggle("flight", id)}
                onComment={(id, msg) => handleComment("flight", id, msg)} />;
            }
            if (item.type === "event") {
              return <FeedEventCard key={`e-${item.data.id}`} event={item.data}
                onSignup={handleEventSignup}
                onLikeToggle={(id) => handleLikeToggle("event", id)}
                onComment={(id, msg) => handleComment("event", id, msg)} />;
            }
            if (item.type === "achievement") {
              return <FeedAchievementCard key={`a-${item.data.id}`} achievement={item.data}
                onLikeToggle={(id) => handleLikeToggle("achievement", id)}
                onComment={(id, msg) => handleComment("achievement", id, msg)} />;
            }
            return null;
          })}
        </div>
      )}
    </div>
  );
}

// ── helpers ──

async function fetchFlights(userId: string, groupIds: string[], groupMap: Record<string, string>): Promise<FeedFlight[]> {
  const { data: groupFlights } = await supabase
    .from("flights")
    .select("id, date, glider, duration_minutes, altitude_gain, distance_km, user_id, group_id, created_at, takeoff_location_id, landing_location_id, locations!flights_takeoff_location_id_fkey(name, latitude, longitude), land:locations!flights_landing_location_id_fkey(name, latitude, longitude)")
    .in("group_id", groupIds)
    .eq("published_to_feed", true)
    .order("created_at", { ascending: false })
    .limit(20);

  if (!groupFlights || groupFlights.length === 0) return [];

  const pilotIds = [...new Set(groupFlights.map(f => f.user_id))];
  if (!pilotIds.includes(userId)) pilotIds.push(userId);
  const { data: profiles } = await supabase.from("profiles").select("user_id, pilot_name, avatar_url").in("user_id", pilotIds);

  const profileMap: Record<string, { pilot_name: string; avatar_url: string }> = {};
  if (profiles) {
    for (const p of profiles) {
      let avatarUrl = "";
      if (p.avatar_url) {
        if (p.avatar_url.startsWith("http")) avatarUrl = p.avatar_url;
        else {
          const { data: signed } = await supabase.storage.from("flight-photos").createSignedUrl(p.avatar_url, 3600);
          if (signed?.signedUrl) avatarUrl = signed.signedUrl;
        }
      }
      profileMap[p.user_id] = { pilot_name: p.pilot_name || "Pilot", avatar_url: avatarUrl };
    }
  }

  const flightIds = groupFlights.map(f => f.id);

  const [photosRes, likesRes, commentsRes, tracksRes] = await Promise.all([
    supabase.from("flight_photos").select("flight_id, storage_path").in("flight_id", flightIds),
    supabase.from("feed_likes").select("flight_id, user_id").in("flight_id", flightIds),
    supabase.from("feed_comments").select("id, flight_id, user_id, message, created_at").in("flight_id", flightIds).order("created_at", { ascending: true }),
    supabase.from("igc_tracks").select("flight_id, track_data").in("flight_id", flightIds),
  ]);

  const photos = photosRes.data;
  const likes = likesRes.data;
  const comments = commentsRes.data;
  const tracks = tracksRes.data;

  const photoMap: Record<string, string[]> = {};
  if (photos && photos.length > 0) {
    const paths = [...new Set(photos.map(p => p.storage_path))];
    const signedMap: Record<string, string> = {};
    for (const path of paths) {
      const { data: signed } = await supabase.storage.from("flight-photos").createSignedUrl(path, 3600);
      if (signed?.signedUrl) signedMap[path] = signed.signedUrl;
    }
    photos.forEach(p => {
      if (!photoMap[p.flight_id]) photoMap[p.flight_id] = [];
      if (signedMap[p.storage_path]) photoMap[p.flight_id].push(signedMap[p.storage_path]);
    });
  }

  const trackMap: Record<string, [number, number][]> = {};
  if (tracks) {
    for (const t of tracks) {
      if (t.track_data && Array.isArray(t.track_data)) {
        trackMap[t.flight_id] = (t.track_data as [number, number][]).slice(0, 500);
      }
    }
  }

  const commenterIds = [...new Set((comments || []).map(c => c.user_id).filter(id => !profileMap[id]))];
  if (commenterIds.length > 0) {
    const { data: cp } = await supabase.from("profiles").select("user_id, pilot_name").in("user_id", commenterIds);
    cp?.forEach(p => { profileMap[p.user_id] = { pilot_name: p.pilot_name || "Pilot", avatar_url: "" }; });
  }

  return groupFlights.map((f: any) => ({
    id: f.id,
    date: f.date,
    created_at: f.created_at,
    glider: f.glider,
    duration_minutes: f.duration_minutes,
    altitude_gain: f.altitude_gain,
    distance_km: f.distance_km,
    takeoff_name: f.locations?.name || null,
    landing_name: f.land?.name || null,
    user_id: f.user_id,
    pilot_name: profileMap[f.user_id]?.pilot_name || "Pilot",
    avatar_url: profileMap[f.user_id]?.avatar_url || "",
    group_name: groupMap[f.group_id] || "",
    photoUrls: photoMap[f.id] || [],
    trackPoints: trackMap[f.id] || [],
    takeoff: f.locations?.latitude ? { latitude: f.locations.latitude, longitude: f.locations.longitude, name: f.locations.name } : null,
    landing: f.land?.latitude ? { latitude: f.land.latitude, longitude: f.land.longitude, name: f.land.name } : null,
    likes: (likes || []).filter(l => l.flight_id === f.id),
    comments: (comments || []).filter(c => c.flight_id === f.id).map(c => ({
      ...c,
      pilot_name: profileMap[c.user_id]?.pilot_name || "Pilot",
    })),
  }));
}

async function fetchEvents(userId: string, groupIds: string[], groupMap: Record<string, string>): Promise<FeedEvent[]> {
  const { data: events } = await supabase
    .from("flight_events")
    .select("id, title, description, event_date, event_type, meeting_point, max_participants, status, group_id, created_at")
    .in("group_id", groupIds)
    .gte("event_date", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .order("created_at", { ascending: false })
    .limit(10);

  if (!events || events.length === 0) return [];

  const eventIds = events.map(e => e.id);

  const [signupsRes, likesRes, commentsRes] = await Promise.all([
    supabase.from("event_signups").select("event_id, user_id, signed_up").in("event_id", eventIds).eq("signed_up", true),
    supabase.from("feed_likes").select("event_id, user_id").in("event_id", eventIds),
    supabase.from("feed_comments").select("id, event_id, user_id, message, created_at").in("event_id", eventIds).order("created_at", { ascending: true }),
  ]);

  const signups = signupsRes.data;
  const likes = likesRes.data;
  const comments = commentsRes.data;

  // Resolve commenter names
  const allUserIds = [...new Set([...(comments || []).map(c => c.user_id)])];
  const profileMap: Record<string, string> = {};
  if (allUserIds.length > 0) {
    const { data: profs } = await supabase.from("profiles").select("user_id, pilot_name").in("user_id", allUserIds);
    profs?.forEach(p => { profileMap[p.user_id] = p.pilot_name || "Pilot"; });
  }

  return events.map(e => ({
    id: e.id,
    title: e.title,
    description: e.description,
    event_date: e.event_date,
    event_type: e.event_type,
    meeting_point: e.meeting_point,
    max_participants: e.max_participants,
    status: e.status,
    group_name: groupMap[e.group_id] || "",
    created_at: (e as any).created_at || e.event_date,
    signup_count: (signups || []).filter(s => s.event_id === e.id).length,
    user_signed_up: (signups || []).some(s => s.event_id === e.id && s.user_id === userId),
    likes: (likes || []).filter(l => l.event_id === e.id).map(l => ({ user_id: l.user_id })),
    comments: (comments || []).filter(c => c.event_id === e.id).map(c => ({
      id: c.id, user_id: c.user_id, message: c.message, created_at: c.created_at,
      pilot_name: profileMap[c.user_id] || "Pilot",
    })),
  }));
}

async function fetchAchievements(userId: string, groupIds: string[], groupMap: Record<string, string>): Promise<FeedAchievement[]> {
  const { data: achievements } = await supabase
    .from("feed_achievements")
    .select("id, user_id, challenge_id, goal_id, achievement_type, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  if (!achievements || achievements.length === 0) return [];

  // Filter to only achievements from user's groups
  const challengeIds = [...new Set(achievements.map(a => a.challenge_id))];
  const { data: challenges } = await supabase
    .from("challenges")
    .select("id, title, group_id")
    .in("id", challengeIds)
    .in("group_id", groupIds);

  if (!challenges || challenges.length === 0) return [];

  const challengeMap: Record<string, { title: string; group_id: string }> = {};
  challenges.forEach(c => { challengeMap[c.id] = { title: c.title, group_id: c.group_id }; });

  const validAchievements = achievements.filter(a => challengeMap[a.challenge_id]);

  // Get goal labels
  const goalIds = validAchievements.filter(a => a.goal_id).map(a => a.goal_id!);
  const goalMap: Record<string, string> = {};
  if (goalIds.length > 0) {
    const { data: goals } = await supabase.from("challenge_goals").select("id, label").in("id", goalIds);
    goals?.forEach(g => { goalMap[g.id] = g.label || ""; });
  }

  // Get challenge progress counts
  const progressMap: Record<string, { total: number; completed: number }> = {};
  for (const cId of challengeIds) {
    if (!challengeMap[cId]) continue;
    const { data: goals } = await supabase.from("challenge_goals").select("id").eq("challenge_id", cId);
    const total = goals?.length || 0;
    // Count completed goals per achievement's user
    progressMap[cId] = { total, completed: 0 };
  }

  // Get pilot profiles
  const pilotIds = [...new Set(validAchievements.map(a => a.user_id))];
  const profileMap: Record<string, { pilot_name: string; avatar_url: string }> = {};
  if (pilotIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("user_id, pilot_name, avatar_url").in("user_id", pilotIds);
    if (profiles) {
      for (const p of profiles) {
        let avatarUrl = "";
        if (p.avatar_url) {
          if (p.avatar_url.startsWith("http")) avatarUrl = p.avatar_url;
          else {
            const { data: signed } = await supabase.storage.from("flight-photos").createSignedUrl(p.avatar_url, 3600);
            if (signed?.signedUrl) avatarUrl = signed.signedUrl;
          }
        }
        profileMap[p.user_id] = { pilot_name: p.pilot_name || "Pilot", avatar_url: avatarUrl };
      }
    }
  }

  // Get user progress per challenge
  for (const a of validAchievements) {
    if (progressMap[a.challenge_id]) {
      const { data: prog } = await supabase.from("challenge_progress").select("id").eq("challenge_id", a.challenge_id).eq("user_id", a.user_id);
      progressMap[a.challenge_id].completed = prog?.length || 0;
    }
  }

  // Get likes and comments
  const achIds = validAchievements.map(a => a.id);
  const [likesRes, commentsRes] = await Promise.all([
    supabase.from("feed_likes").select("achievement_id, user_id").in("achievement_id", achIds),
    supabase.from("feed_comments").select("id, achievement_id, user_id, message, created_at").in("achievement_id", achIds).order("created_at", { ascending: true }),
  ]);

  const likes = likesRes.data;
  const comments = commentsRes.data;

  // Resolve commenter names
  const commenterIds = [...new Set((comments || []).map(c => c.user_id).filter(id => !profileMap[id]))];
  if (commenterIds.length > 0) {
    const { data: cp } = await supabase.from("profiles").select("user_id, pilot_name").in("user_id", commenterIds);
    cp?.forEach(p => { profileMap[p.user_id] = { pilot_name: p.pilot_name || "Pilot", avatar_url: "" }; });
  }

  return validAchievements.map(a => ({
    id: a.id,
    user_id: a.user_id,
    challenge_id: a.challenge_id,
    goal_id: a.goal_id,
    achievement_type: a.achievement_type,
    created_at: a.created_at,
    pilot_name: profileMap[a.user_id]?.pilot_name || "Pilot",
    avatar_url: profileMap[a.user_id]?.avatar_url || "",
    challenge_title: challengeMap[a.challenge_id]?.title || "",
    goal_label: a.goal_id ? (goalMap[a.goal_id] || null) : null,
    group_name: groupMap[challengeMap[a.challenge_id]?.group_id] || "",
    total_goals: progressMap[a.challenge_id]?.total || 0,
    completed_goals: progressMap[a.challenge_id]?.completed || 0,
    likes: (likes || []).filter(l => l.achievement_id === a.id).map(l => ({ user_id: l.user_id })),
    comments: (comments || []).filter(c => c.achievement_id === a.id).map(c => ({
      id: c.id, user_id: c.user_id, message: c.message, created_at: c.created_at,
      pilot_name: profileMap[c.user_id]?.pilot_name || "Pilot",
    })),
  }));
}
