import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import FeedCard, { type FeedFlight } from "@/components/FeedCard";
import FeedEventCard, { type FeedEvent } from "@/components/FeedEventCard";
import FeedChallengeCard, { type FeedChallenge } from "@/components/FeedChallengeCard";
import EmptyState from "@/components/EmptyState";
import { Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

type FeedItem =
  | { type: "flight"; date: string; data: FeedFlight }
  | { type: "event"; date: string; data: FeedEvent }
  | { type: "challenge"; date: string; data: FeedChallenge };

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

    const [flightsRes, eventsRes, challengesRes] = await Promise.all([
      fetchFlights(user.id, groupIds, groupMap),
      fetchEvents(user.id, groupIds, groupMap),
      fetchChallenges(user.id, groupIds, groupMap),
    ]);

    const allItems: FeedItem[] = [
      ...flightsRes.map(f => ({ type: "flight" as const, date: f.created_at, data: f })),
      ...eventsRes.map(e => ({ type: "event" as const, date: e.event_date, data: e })),
      ...challengesRes.map(c => ({ type: "challenge" as const, date: c.created_at || c.start_date, data: c })),
    ];

    allItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setItems(allItems);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchFeed(); }, [fetchFeed]);

  const handleLikeToggle = async (flightId: string) => {
    if (!user) return;
    const item = items.find(i => i.type === "flight" && i.data.id === flightId);
    if (!item || item.type !== "flight") return;
    const flight = item.data;

    const isLiked = flight.likes.some(l => l.user_id === user.id);
    if (isLiked) {
      await supabase.from("feed_likes").delete().eq("flight_id", flightId).eq("user_id", user.id);
      setItems(prev => prev.map(i => i.type === "flight" && i.data.id === flightId
        ? { ...i, data: { ...i.data, likes: i.data.likes.filter(l => l.user_id !== user.id) } }
        : i));
    } else {
      await supabase.from("feed_likes").insert({ flight_id: flightId, user_id: user.id });
      setItems(prev => prev.map(i => i.type === "flight" && i.data.id === flightId
        ? { ...i, data: { ...i.data, likes: [...i.data.likes, { user_id: user.id }] } }
        : i));
    }
  };

  const handleComment = async (flightId: string, message: string) => {
    if (!user) return;
    const { data } = await supabase.from("feed_comments").insert({ flight_id: flightId, user_id: user.id, message }).select("id, created_at").single();
    if (data) {
      const { data: prof } = await supabase.from("profiles").select("pilot_name").eq("user_id", user.id).single();
      setItems(prev => prev.map(i => i.type === "flight" && i.data.id === flightId ? {
        ...i, data: {
          ...i.data,
          comments: [...i.data.comments, { id: data.id, user_id: user.id, message, created_at: data.created_at, pilot_name: prof?.pilot_name || "Du" }]
        }
      } : i));
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
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto space-y-4">
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
              return <FeedCard key={`f-${item.data.id}`} flight={item.data} onLikeToggle={handleLikeToggle} onComment={handleComment} />;
            }
            if (item.type === "event") {
              return <FeedEventCard key={`e-${item.data.id}`} event={item.data} onSignup={handleEventSignup} />;
            }
            if (item.type === "challenge") {
              return <FeedChallengeCard key={`c-${item.data.id}`} challenge={item.data} />;
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

  // Load photos, likes, comments, igc tracks in parallel
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

  // Build photo map
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

  // Build track map
  const trackMap: Record<string, [number, number][]> = {};
  if (tracks) {
    for (const t of tracks) {
      if (t.track_data && Array.isArray(t.track_data)) {
        trackMap[t.flight_id] = (t.track_data as [number, number][]).slice(0, 500);
      }
    }
  }

  // Resolve commenter profiles
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
  const { data: signups } = await supabase
    .from("event_signups")
    .select("event_id, user_id, signed_up")
    .in("event_id", eventIds)
    .eq("signed_up", true);

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
    signup_count: (signups || []).filter(s => s.event_id === e.id).length,
    user_signed_up: (signups || []).some(s => s.event_id === e.id && s.user_id === userId),
  }));
}

async function fetchChallenges(userId: string, groupIds: string[], groupMap: Record<string, string>): Promise<FeedChallenge[]> {
  const today = new Date().toISOString().split("T")[0];

  const { data: challenges } = await supabase
    .from("challenges")
    .select("id, title, description, start_date, end_date, group_id, created_at")
    .in("group_id", groupIds)
    .or(`end_date.is.null,end_date.gte.${today}`)
    .order("created_at", { ascending: false })
    .limit(10);

  if (!challenges || challenges.length === 0) return [];

  const challengeIds = challenges.map(c => c.id);

  const [goalsRes, progressRes] = await Promise.all([
    supabase.from("challenge_goals").select("id, challenge_id").in("challenge_id", challengeIds),
    supabase.from("challenge_progress").select("challenge_id, goal_id, user_id").in("challenge_id", challengeIds),
  ]);

  const goals = goalsRes.data || [];
  const progress = progressRes.data || [];

  return challenges.map(c => {
    const cGoals = goals.filter(g => g.challenge_id === c.id);
    const myCompleted = progress.filter(p => p.challenge_id === c.id && p.user_id === userId);
    const participants = [...new Set(progress.filter(p => p.challenge_id === c.id).map(p => p.user_id))];

    return {
      id: c.id,
      title: c.title,
      description: c.description,
      start_date: c.start_date,
      end_date: c.end_date,
      created_at: c.created_at,
      group_id: c.group_id,
      group_name: groupMap[c.group_id] || "",
      total_goals: cGoals.length,
      completed_goals: myCompleted.length,
      participant_count: participants.length,
    };
  });
}
