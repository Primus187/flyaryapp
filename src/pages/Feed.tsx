import React, { useEffect, useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import FeedCard, { type FeedFlight } from "@/components/FeedCard";
import FeedEventCard, { type FeedEvent } from "@/components/FeedEventCard";
import FeedAchievementCard, { type FeedAchievement } from "@/components/FeedAchievementCard";
import FeedStoryBar from "@/components/FeedStoryBar";
import NotificationBell from "@/components/NotificationBell";
import EmptyState from "@/components/layout/EmptyState";
import PilotSuggestions from "@/components/PilotSuggestions";
import { Users, X } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { getSignedUrls } from "@/lib/signed-url-cache";
import { resolveFeedItems, type FeedItem, type RawFeedPage } from "@/lib/feed-page";

const PAGE_SIZE = 10;

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
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const tagFilter = searchParams.get("tag");

  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const nextCursorRef = useRef<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const groupMembersLoadedRef = useRef(false);
  const [groupMembers, setGroupMembers] = useState<{ user_id: string; pilot_name: string }[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);
  const isPulling = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const stableGroupIds = groupIds;

  // One RPC per page (merged, date-ordered, RLS-checked on the server) plus one parallel
  // signing step for photos/videos. Previously 8-9 sequential round trips per page.
  const fetchFeed = useCallback(async (cursor?: string) => {
    if (!user) return;
    try {
      const [pageRes, membersRes] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RPC not in generated types.ts yet
        supabase.rpc("feed_page" as any, { _cursor: cursor ?? null, _limit: PAGE_SIZE } as any),
        // Mention list only on the first load; it does not change while scrolling.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RPC not in generated types.ts yet
        !cursor && !groupMembersLoadedRef.current ? supabase.rpc("feed_mention_members" as any) : Promise.resolve(null),
      ]);
      if (pageRes.error) throw pageRes.error;
      const page = pageRes.data as unknown as RawFeedPage;
      if (membersRes && !membersRes.error) {
        groupMembersLoadedRef.current = true;
        setGroupMembers((membersRes.data as unknown as { user_id: string; pilot_name: string }[]) || []);
      }
      if (!cursor) setGroupIds(prev => (prev.join(",") === page.groupIds.join(",") ? prev : page.groupIds));
      const resolved = await resolveFeedItems(page.items, getSignedUrls);
      setItems(prev => (cursor ? [...prev, ...resolved] : resolved));
      nextCursorRef.current = page.nextCursor;
      setHasMore(!!page.nextCursor);
    } catch {
      setHasMore(false);
      toast({ title: t("performance.loadFailed"), variant: "destructive" });
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [user, t, toast]);

  const didInitialFetch = useRef(false);
  useEffect(() => {
    if (didInitialFetch.current) return;
    didInitialFetch.current = true;
    fetchFeed();
  }, [fetchFeed]);

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    if (!sentinelRef.current || !hasMore || loadingMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && items.length > 0) {
          if (!nextCursorRef.current) return;
          setLoadingMore(true);
          fetchFeed(nextCursorRef.current);
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

    // Same write pattern as Events/EventDetail: sign-off is an UPDATE (signed_up=false) so the
    // waitlist trigger can promote the next person; deleting the row bypassed it.
    const signingUp = !item.data.user_signed_up;
    const { data: existing } = await supabase.from("event_signups").select("id")
      .eq("event_id", eventId).eq("user_id", user.id).maybeSingle();
    const { error } = existing
      ? await supabase.from("event_signups").update({ signed_up: signingUp, updated_at: new Date().toISOString() }).eq("id", existing.id)
      : await supabase.from("event_signups").insert({ event_id: eventId, user_id: user.id, signed_up: true });
    if (error) {
      toast({ title: t("common.error"), description: /deadline/i.test(error.message) ? t("events.deadlinePassed") : error.message, variant: "destructive" });
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["dashboard", user.id] });
    setItems(prev => prev.map(i => i.type === "event" && i.data.id === eventId
      ? { ...i, data: { ...i.data, user_signed_up: signingUp, signup_count: i.data.signup_count + (signingUp ? 1 : -1) } }
      : i));
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

      {tagFilter && (
        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-primary/10 border border-primary/20">
          <p className="text-sm font-medium text-primary">
            {t("feed.filteringByTag", { tag: tagFilter, defaultValue: `Filter: #${tagFilter}` })}
          </p>
          <button
            type="button"
            onClick={() => { searchParams.delete("tag"); setSearchParams(searchParams); }}
            className="text-primary active:scale-90 transition-transform"
            aria-label={t("common.remove")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Story bar — active pilots */}
      {user && stableGroupIds.length > 0 && (
        <FeedStoryBar userId={user.id} groupIds={stableGroupIds} />
      )}

      {(() => {
        const visible = tagFilter
          ? items.filter(i => i.type === "flight" && Array.isArray((i.data as any).tags) && (i.data as any).tags.includes(tagFilter))
          : items;
        if (visible.length === 0) {
          return (
            <div className="space-y-4">
              {tagFilter ? (
                <EmptyState icon={Users} title={t("feed.noFlightsForTag", { defaultValue: "Keine Flüge für diesen Tag" })} description="" />
              ) : stableGroupIds.length > 0 ? (
                // Member of a group whose feed is still empty: explain publishing, do not suggest joining.
                <EmptyState icon={Users} title={t("feed.noPostsTitle")} description={t("feed.noPostsDesc")}
                  actionLabel={t("flights.newFlight")} onAction={() => navigate("/flights/new")} />
              ) : (
                <EmptyState icon={Users} title={t("feed.noFlights")} description={t("feed.noFlightsDesc")}
                  actionLabel={t("groups.joinGroup")} onAction={() => navigate("/groups")} />
              )}
              {!tagFilter && <PilotSuggestions />}
            </div>
          );
        }
        return (
          <div className="space-y-4">
            {visible.map(item => {
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
        );
      })()}
    </div>
  );
}
