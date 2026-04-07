import React, { useEffect, useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import FeedCard, { type FeedFlight } from "@/components/FeedCard";
import FeedEventCard, { type FeedEvent } from "@/components/FeedEventCard";
import FeedAchievementCard, { type FeedAchievement } from "@/components/FeedAchievementCard";
import FeedStoryBar from "@/components/FeedStoryBar";
import NotificationBell from "@/components/NotificationBell";
import EmptyState from "@/components/EmptyState";
import { Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

const PAGE_SIZE = 10;

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

function LoadMoreSkeleton() {
  return (
    <div className="space-y-2 py-4">
      <div className="flex items-center gap-3"><Skeleton className="h-8 w-8 rounded-full" /><Skeleton className="h-4 w-24" /></div>
      <Skeleton className="h-40 w-full rounded-xl" />
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
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const groupIdsRef = useRef<string[]>([]);
  const [groupMembers, setGroupMembers] = useState<{ user_id: string; pilot_name: string }[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);
  const isPulling = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const stableGroupIds = React.useMemo(() => groupIds, [groupIds.join(",")]);

  const fetchFeed = useCallback(async (cursor?: string) => {
    if (!user) return;

    let gIds = groupIdsRef.current;
    let groupMap: Record<string, string> = {};

    if (!cursor || gIds.length === 0) {
      const { data: memberships } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", user.id);

      gIds = memberships?.map(m => m.group_id) || [];
      if (JSON.stringify(gIds) !== JSON.stringify(groupIdsRef.current)) {
        setGroupIds(gIds);
        groupIdsRef.current = gIds;
      }

      if (gIds.length > 0) {
        // Load group members for @mentions
        const { data: members } = await supabase
          .from("group_members")
          .select("user_id")
          .in("group_id", gIds);
        if (members) {
          const memberIds = [...new Set(members.map(m => m.user_id))];
          const { data: profs } = await supabase.from("profiles").select("user_id, pilot_name").in("user_id", memberIds);
          setGroupMembers((profs || []).map(p => ({ user_id: p.user_id, pilot_name: p.pilot_name || "Pilot" })));
        }
      }
    }

    if (gIds.length > 0) {
      const { data: groups } = await supabase
        .from("groups")
        .select("id, name")
        .in("id", gIds);
      groups?.forEach(g => { groupMap[g.id] = g.name; });
    }

    // Also fetch followed user IDs
    const { data: followsData } = await supabase
      .from("follows" as any)
      .select("following_id")
      .eq("follower_id", user.id);
    const followedIds: string[] = (followsData || []).map((f: any) => f.following_id);

    const [flightsRes, followedFlightsRes, eventsRes, achievementsRes] = await Promise.all([
      gIds.length > 0 ? fetchFlights(user.id, gIds, groupMap, cursor) : Promise.resolve([]),
      followedIds.length > 0 ? fetchFollowedFlights(user.id, followedIds, cursor) : Promise.resolve([]),
      !cursor && gIds.length > 0 ? fetchEvents(user.id, gIds, groupMap) : Promise.resolve([]),
      gIds.length > 0 ? fetchAchievements(user.id, gIds, groupMap, cursor) : Promise.resolve([]),
    ]);

    const allFlights = [...flightsRes, ...followedFlightsRes];
    // Deduplicate by id
    const seenIds = new Set<string>();
    const dedupedFlights = allFlights.filter(f => { if (seenIds.has(f.id)) return false; seenIds.add(f.id); return true; });

    // Load bookmarks for current user
    const allFlightIds = dedupedFlights.map(f => f.id);
    const allEventIds = eventsRes.map(e => e.id);
    const allAchIds = achievementsRes.map(a => a.id);

    const bookmarkQueries = await Promise.all([
      allFlightIds.length > 0 ? supabase.from("bookmarks").select("flight_id").eq("user_id", user.id).in("flight_id", allFlightIds) : { data: [] },
      allEventIds.length > 0 ? supabase.from("bookmarks").select("event_id").eq("user_id", user.id).in("event_id", allEventIds) : { data: [] },
      allAchIds.length > 0 ? supabase.from("bookmarks").select("achievement_id").eq("user_id", user.id).in("achievement_id", allAchIds) : { data: [] },
    ]);

    const bookmarkedFlights = new Set((bookmarkQueries[0].data || []).map((b: any) => b.flight_id));
    const bookmarkedEvents = new Set((bookmarkQueries[1].data || []).map((b: any) => b.event_id));
    const bookmarkedAchs = new Set((bookmarkQueries[2].data || []).map((b: any) => b.achievement_id));

    const allItems: FeedItem[] = [
      ...dedupedFlights.map(f => ({ type: "flight" as const, date: (f as any).published_at || f.created_at, data: { ...f, isBookmarked: bookmarkedFlights.has(f.id) } })),
      ...eventsRes.map(e => ({ type: "event" as const, date: e.published_at || e.created_at || e.event_date, data: { ...e, isBookmarked: bookmarkedEvents.has(e.id) } })),
      ...achievementsRes.map(a => ({ type: "achievement" as const, date: a.created_at, data: { ...a, isBookmarked: bookmarkedAchs.has(a.id) } })),
    ];

    allItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (cursor) {
      setItems(prev => [...prev, ...allItems]);
    } else {
      setItems(allItems);
    }

    setHasMore(dedupedFlights.length >= PAGE_SIZE || achievementsRes.length >= PAGE_SIZE);
    setLoading(false);
    setLoadingMore(false);
  }, [user]);

  useEffect(() => { fetchFeed(); }, [fetchFeed]);

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    if (!sentinelRef.current || !hasMore || loadingMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && items.length > 0) {
          const lastDate = items[items.length - 1].date;
          setLoadingMore(true);
          fetchFeed(lastDate);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, items, fetchFeed]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setHasMore(true);
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

  
  const handleReaction = async (itemType: "flight" | "event" | "achievement", itemId: string, reactionType: string = "heart") => {
    if (!user) return;

    const colName = itemType === "flight" ? "flight_id" : itemType === "event" ? "event_id" : "achievement_id";

    const item = items.find(i => i.data.id === itemId);
    if (!item) return;

    const likes = (item.data as any).likes || [];
    const existingReaction = likes.find((l: any) => l.user_id === user.id && l.reaction_type === reactionType);

    if (existingReaction) {
      // Remove this reaction
      await supabase.from("feed_likes").delete().eq(colName, itemId).eq("user_id", user.id).eq("reaction_type", reactionType);
      setItems(prev => prev.map(i => {
        if (i.data.id !== itemId) return i;
        const currentLikes = (i.data as any).likes || [];
        return { ...i, data: { ...i.data, likes: currentLikes.filter((l: any) => !(l.user_id === user.id && l.reaction_type === reactionType)) } } as FeedItem;
      }));
    } else {
      // Remove any existing reaction from this user first, then add new one
      await supabase.from("feed_likes").delete().eq(colName, itemId).eq("user_id", user.id);
      await supabase.from("feed_likes").insert({ [colName]: itemId, user_id: user.id, reaction_type: reactionType } as any);
      setItems(prev => prev.map(i => {
        if (i.data.id !== itemId) return i;
        const currentLikes = (i.data as any).likes || [];
        const withoutMine = currentLikes.filter((l: any) => l.user_id !== user.id);
        return { ...i, data: { ...i.data, likes: [...withoutMine, { user_id: user.id, reaction_type: reactionType }] } } as FeedItem;
      }));
    }
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

  // ── Bookmark toggle ──
  const handleBookmarkToggle = async (itemType: "flight" | "event" | "achievement", itemId: string) => {
    if (!user) return;
    const colName = itemType === "flight" ? "flight_id" : itemType === "event" ? "event_id" : "achievement_id";

    // Check if already bookmarked
    const { data: existing } = await supabase
      .from("bookmarks")
      .select("id")
      .eq("user_id", user.id)
      .eq(colName, itemId)
      .maybeSingle();

    if (existing) {
      await supabase.from("bookmarks").delete().eq("id", existing.id);
    } else {
      await supabase.from("bookmarks").insert({ user_id: user.id, [colName]: itemId } as any);
    }

    // Update local state
    setItems(prev => prev.map(i => {
      if (i.data.id !== itemId) return i;
      return { ...i, data: { ...i.data, isBookmarked: !existing } } as FeedItem;
    }));
  };

  // ── Comment like toggle ──
  const handleCommentLikeToggle = async (commentId: string) => {
    if (!user) return;

    const { data: existing } = await supabase
      .from("comment_likes")
      .select("id")
      .eq("comment_id", commentId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      await supabase.from("comment_likes").delete().eq("id", existing.id);
    } else {
      await supabase.from("comment_likes").insert({ comment_id: commentId, user_id: user.id });
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

      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold tracking-tight">{t("feed.title")}</h1>
        <NotificationBell />
      </div>

      {/* Story bar — active pilots */}
      {user && stableGroupIds.length > 0 && (
        <FeedStoryBar userId={user.id} groupIds={stableGroupIds} />
      )}

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
                onReact={(id, type) => handleReaction("flight", id, type)}
                onComment={(id, msg) => handleComment("flight", id, msg)}
                onBookmarkToggle={(id) => handleBookmarkToggle("flight", id)}
                onCommentLike={handleCommentLikeToggle}
                groupMembers={groupMembers} />;
            }
            if (item.type === "event") {
              return <FeedEventCard key={`e-${item.data.id}`} event={item.data}
                onSignup={handleEventSignup}
                onReact={(id, type) => handleReaction("event", id, type)}
                onComment={(id, msg) => handleComment("event", id, msg)}
                onBookmarkToggle={(id) => handleBookmarkToggle("event", id)}
                onCommentLike={handleCommentLikeToggle}
                groupMembers={groupMembers} />;
            }
            if (item.type === "achievement") {
              return <FeedAchievementCard key={`a-${item.data.id}`} achievement={item.data}
                onReact={(id, type) => handleReaction("achievement", id, type)}
                onComment={(id, msg) => handleComment("achievement", id, msg)}
                onBookmarkToggle={(id) => handleBookmarkToggle("achievement", id)}
                onCommentLike={handleCommentLikeToggle}
                groupMembers={groupMembers} />;
            }
            return null;
          })}

          {/* Infinite scroll sentinel */}
          {hasMore && (
            <div ref={sentinelRef}>
              {loadingMore && <LoadMoreSkeleton />}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── helpers ──

async function fetchFlights(userId: string, groupIds: string[], groupMap: Record<string, string>, cursor?: string): Promise<FeedFlight[]> {
  let query = supabase
    .from("flights")
    .select("id, date, glider, duration_minutes, altitude_gain, distance_km, comments, user_id, group_id, created_at, published_at, feed_photo_ids, takeoff_location_id, landing_location_id, locations!flights_takeoff_location_id_fkey(name, latitude, longitude), land:locations!flights_landing_location_id_fkey(name, latitude, longitude)")
    .in("group_id", groupIds)
    .eq("published_to_feed", true)
    .not("published_at", "is", null)
    .order("published_at", { ascending: false })
    .limit(PAGE_SIZE);

  if (cursor) {
    query = query.lt("published_at", cursor);
  }

  const { data: groupFlights } = await query;

  if (!groupFlights || groupFlights.length === 0) return [];

  const pilotIds = [...new Set(groupFlights.map(f => f.user_id))];
  if (!pilotIds.includes(userId)) pilotIds.push(userId);
  const { data: profiles } = await supabase.from("profiles").select("user_id, pilot_name, avatar_url").in("user_id", pilotIds);

  const profileMap: Record<string, { pilot_name: string; avatar_url: string }> = {};
  if (profiles) {
    const avatarPaths = profiles.filter(p => p.avatar_url && !p.avatar_url.startsWith("http")).map(p => p.avatar_url!);
    const avatarSignedMap: Record<string, string> = {};
    if (avatarPaths.length > 0) {
      const { data: signedAvatars } = await supabase.storage.from("flight-photos").createSignedUrls(avatarPaths, 3600);
      signedAvatars?.forEach(s => { if (s.signedUrl) avatarSignedMap[s.path] = s.signedUrl; });
    }
    for (const p of profiles) {
      let avatarUrl = "";
      if (p.avatar_url) {
        avatarUrl = p.avatar_url.startsWith("http") ? p.avatar_url : (avatarSignedMap[p.avatar_url] || "");
      }
      profileMap[p.user_id] = { pilot_name: p.pilot_name || "Pilot", avatar_url: avatarUrl };
    }
  }

  const flightIds = groupFlights.map(f => f.id);

  // Build a map of flight_id → allowed photo IDs from feed_photo_ids
  const feedPhotoIdsMap: Record<string, string[] | null> = {};
  for (const f of groupFlights as any[]) {
    feedPhotoIdsMap[f.id] = Array.isArray(f.feed_photo_ids) ? f.feed_photo_ids : null;
  }

  const [photosRes, likesRes, commentsRes, tracksRes, videosRes] = await Promise.all([
    supabase.from("flight_photos").select("id, flight_id, storage_path").in("flight_id", flightIds),
    supabase.from("feed_likes").select("flight_id, user_id, reaction_type").in("flight_id", flightIds),
    supabase.from("feed_comments").select("id, flight_id, user_id, message, created_at").in("flight_id", flightIds).order("created_at", { ascending: true }),
    supabase.from("igc_tracks").select("flight_id").in("flight_id", flightIds),
    supabase.from("flight_videos").select("flight_id, youtube_url").in("flight_id", flightIds),
  ]);

  const photos = photosRes.data;
  const likes = likesRes.data;
  const comments = commentsRes.data;
  const tracks = tracksRes.data;
  const videoData = videosRes.data;

  const videoMap: Record<string, string[]> = {};
  if (videoData) {
    for (const v of videoData) {
      if (!videoMap[v.flight_id]) videoMap[v.flight_id] = [];
      videoMap[v.flight_id].push(v.youtube_url);
    }
  }

  const photoMap: Record<string, string[]> = {};
  if (photos && photos.length > 0) {
    const filteredPhotos = photos.filter(p => {
      const allowed = feedPhotoIdsMap[p.flight_id];
      return !allowed || allowed.includes(p.id);
    });
    const paths = [...new Set(filteredPhotos.map(p => p.storage_path))];
    const signedMap: Record<string, string> = {};
    if (paths.length > 0) {
      const { data: signedPhotos } = await supabase.storage.from("flight-photos").createSignedUrls(paths, 3600);
      signedPhotos?.forEach(s => { if (s.signedUrl) signedMap[s.path] = s.signedUrl; });
    }
    filteredPhotos.forEach(p => {
      if (!photoMap[p.flight_id]) photoMap[p.flight_id] = [];
      if (signedMap[p.storage_path]) photoMap[p.flight_id].push(signedMap[p.storage_path]);
    });
  }

  // Track existence map (no track_data loaded — lazy loaded in FeedCard)
  const hasTrackMap = new Set<string>();
  if (tracks) {
    tracks.forEach(t => hasTrackMap.add(t.flight_id));
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
    published_at: f.published_at,
    feedDescription: f.comments || null,
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
    videoUrls: videoMap[f.id] || [],
    hasTrack: hasTrackMap.has(f.id),
    takeoff: f.locations?.latitude ? { latitude: f.locations.latitude, longitude: f.locations.longitude, name: f.locations.name } : null,
    landing: f.land?.latitude ? { latitude: f.land.latitude, longitude: f.land.longitude, name: f.land.name } : null,
    likes: (likes || []).filter(l => l.flight_id === f.id).map(l => ({ user_id: l.user_id, reaction_type: (l as any).reaction_type || "heart" })),
    comments: (comments || []).filter(c => c.flight_id === f.id).map(c => ({
      ...c,
      pilot_name: profileMap[c.user_id]?.pilot_name || "Pilot",
    })),
  }));
}

async function fetchEvents(userId: string, groupIds: string[], groupMap: Record<string, string>): Promise<FeedEvent[]> {
  const { data: events } = await supabase
    .from("flight_events")
    .select("id, title, description, event_date, event_type, meeting_point, max_participants, status, group_id, created_at, created_by, published_to_feed, published_at, feed_description")
    .in("group_id", groupIds)
    .eq("published_to_feed", true)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(10);

  if (!events || events.length === 0) return [];

  const eventIds = events.map(e => e.id);
  const creatorIds = [...new Set(events.map(e => e.created_by))];

  const [signupsRes, likesRes, commentsRes, photosRes, profilesRes] = await Promise.all([
    supabase.from("event_signups").select("event_id, user_id, signed_up").in("event_id", eventIds).eq("signed_up", true),
    supabase.from("feed_likes").select("event_id, user_id, reaction_type").in("event_id", eventIds),
    supabase.from("feed_comments").select("id, event_id, user_id, message, created_at").in("event_id", eventIds).order("created_at", { ascending: true }),
    supabase.from("event_photos").select("id, event_id, storage_path").in("event_id", eventIds),
    supabase.from("profiles").select("user_id, pilot_name, avatar_url").in("user_id", creatorIds),
  ]);

  const signups = signupsRes.data;
  const likes = likesRes.data;
  const comments = commentsRes.data;
  const eventPhotos = photosRes.data;
  const profiles = profilesRes.data;

  // Sign photo URLs
  const photoMap: Record<string, { id: string; url: string }[]> = {};
  if (eventPhotos && eventPhotos.length > 0) {
    const paths = [...new Set(eventPhotos.map(p => p.storage_path))];
    const { data: signedPhotos } = await supabase.storage.from("flight-photos").createSignedUrls(paths, 3600);
    const signedMap: Record<string, string> = {};
    signedPhotos?.forEach(s => { if (s.signedUrl) signedMap[s.path] = s.signedUrl; });
    eventPhotos.forEach(p => {
      if (!photoMap[p.event_id]) photoMap[p.event_id] = [];
      if (signedMap[p.storage_path]) photoMap[p.event_id].push({ id: p.id, url: signedMap[p.storage_path] });
    });
  }

  // Build profile map with signed avatars
  const profileMap: Record<string, { pilot_name: string; avatar_url: string }> = {};
  if (profiles) {
    const avatarPaths = profiles.filter(p => p.avatar_url && !p.avatar_url.startsWith("http")).map(p => p.avatar_url!);
    const avatarSignedMap: Record<string, string> = {};
    if (avatarPaths.length > 0) {
      const { data: signedAvatars } = await supabase.storage.from("flight-photos").createSignedUrls(avatarPaths, 3600);
      signedAvatars?.forEach(s => { if (s.signedUrl) avatarSignedMap[s.path] = s.signedUrl; });
    }
    for (const p of profiles) {
      let avatarUrl = "";
      if (p.avatar_url) {
        avatarUrl = p.avatar_url.startsWith("http") ? p.avatar_url : (avatarSignedMap[p.avatar_url] || "");
      }
      profileMap[p.user_id] = { pilot_name: p.pilot_name || "Pilot", avatar_url: avatarUrl };
    }
  }

  // Commenter profiles
  const allCommentUserIds = [...new Set((comments || []).map(c => c.user_id).filter(id => !profileMap[id]))];
  if (allCommentUserIds.length > 0) {
    const { data: profs } = await supabase.from("profiles").select("user_id, pilot_name").in("user_id", allCommentUserIds);
    profs?.forEach(p => { profileMap[p.user_id] = { pilot_name: p.pilot_name || "Pilot", avatar_url: "" }; });
  }

  return events.map(e => ({
    id: e.id,
    title: e.title,
    description: e.description,
    feed_description: (e as any).feed_description || null,
    event_date: e.event_date,
    event_type: e.event_type,
    meeting_point: e.meeting_point,
    max_participants: e.max_participants,
    status: e.status,
    group_name: groupMap[e.group_id] || "",
    created_at: (e as any).created_at || e.event_date,
    published_at: (e as any).published_at || null,
    created_by: e.created_by,
    pilot_name: profileMap[e.created_by]?.pilot_name || "Pilot",
    avatar_url: profileMap[e.created_by]?.avatar_url || "",
    photos: photoMap[e.id] || [],
    signup_count: (signups || []).filter(s => s.event_id === e.id).length,
    user_signed_up: (signups || []).some(s => s.event_id === e.id && s.user_id === userId),
    likes: (likes || []).filter(l => l.event_id === e.id).map(l => ({ user_id: l.user_id, reaction_type: (l as any).reaction_type || "heart" })),
    comments: (comments || []).filter(c => c.event_id === e.id).map(c => ({
      id: c.id, user_id: c.user_id, message: c.message, created_at: c.created_at,
      pilot_name: profileMap[c.user_id]?.pilot_name || "Pilot",
    })),
  }));
}

async function fetchAchievements(userId: string, groupIds: string[], groupMap: Record<string, string>, cursor?: string): Promise<FeedAchievement[]> {
  let query = supabase
    .from("feed_achievements")
    .select("id, user_id, challenge_id, goal_id, achievement_type, created_at")
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data: achievements } = await query;

  if (!achievements || achievements.length === 0) return [];

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

  const goalIds = validAchievements.filter(a => a.goal_id).map(a => a.goal_id!);
  const goalMap: Record<string, string> = {};
  if (goalIds.length > 0) {
    const { data: goals } = await supabase.from("challenge_goals").select("id, label").in("id", goalIds);
    goals?.forEach(g => { goalMap[g.id] = g.label || ""; });
  }

  const progressMap: Record<string, { total: number; completed: number }> = {};
  for (const cId of challengeIds) {
    if (!challengeMap[cId]) continue;
    const { data: goals } = await supabase.from("challenge_goals").select("id").eq("challenge_id", cId);
    const total = goals?.length || 0;
    progressMap[cId] = { total, completed: 0 };
  }

  const pilotIds = [...new Set(validAchievements.map(a => a.user_id))];
  const profileMap: Record<string, { pilot_name: string; avatar_url: string }> = {};
  if (pilotIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("user_id, pilot_name, avatar_url").in("user_id", pilotIds);
    if (profiles) {
      const avatarPaths = profiles.filter(p => p.avatar_url && !p.avatar_url.startsWith("http")).map(p => p.avatar_url!);
      const avatarSignedMap: Record<string, string> = {};
      if (avatarPaths.length > 0) {
        const { data: signedAvatars } = await supabase.storage.from("flight-photos").createSignedUrls(avatarPaths, 3600);
        signedAvatars?.forEach(s => { if (s.signedUrl) avatarSignedMap[s.path] = s.signedUrl; });
      }
      for (const p of profiles) {
        let avatarUrl = "";
        if (p.avatar_url) {
          avatarUrl = p.avatar_url.startsWith("http") ? p.avatar_url : (avatarSignedMap[p.avatar_url] || "");
        }
        profileMap[p.user_id] = { pilot_name: p.pilot_name || "Pilot", avatar_url: avatarUrl };
      }
    }
  }

  for (const a of validAchievements) {
    if (progressMap[a.challenge_id]) {
      const { data: prog } = await supabase.from("challenge_progress").select("id").eq("challenge_id", a.challenge_id).eq("user_id", a.user_id);
      progressMap[a.challenge_id].completed = prog?.length || 0;
    }
  }

  const achIds = validAchievements.map(a => a.id);
  const [likesRes, commentsRes] = await Promise.all([
    supabase.from("feed_likes").select("achievement_id, user_id, reaction_type").in("achievement_id", achIds),
    supabase.from("feed_comments").select("id, achievement_id, user_id, message, created_at").in("achievement_id", achIds).order("created_at", { ascending: true }),
  ]);

  const likes = likesRes.data;
  const comments = commentsRes.data;

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
    likes: (likes || []).filter(l => l.achievement_id === a.id).map(l => ({ user_id: l.user_id, reaction_type: (l as any).reaction_type || "heart" })),
    comments: (comments || []).filter(c => c.achievement_id === a.id).map(c => ({
      id: c.id, user_id: c.user_id, message: c.message, created_at: c.created_at,
      pilot_name: profileMap[c.user_id]?.pilot_name || "Pilot",
    })),
  }));
}
