import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useFollows(targetUserId?: string) {
  const { user } = useAuth();
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchFollowState = useCallback(async () => {
    if (!targetUserId) return;

    const [followingRes, followerCountRes, followingCountRes] = await Promise.all([
      user
        ? supabase.from("follows" as any).select("id").eq("follower_id", user.id).eq("following_id", targetUserId).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from("follows" as any).select("id", { count: "exact", head: true }).eq("following_id", targetUserId),
      supabase.from("follows" as any).select("id", { count: "exact", head: true }).eq("follower_id", targetUserId),
    ]);

    setIsFollowing(!!followingRes.data);
    setFollowerCount((followerCountRes as any).count || 0);
    setFollowingCount((followingCountRes as any).count || 0);
  }, [user, targetUserId]);

  useEffect(() => {
    fetchFollowState();
  }, [fetchFollowState]);

  const toggleFollow = useCallback(async () => {
    if (!user || !targetUserId || user.id === targetUserId) return;
    setLoading(true);

    if (isFollowing) {
      await supabase.from("follows" as any).delete().eq("follower_id", user.id).eq("following_id", targetUserId);
      setIsFollowing(false);
      setFollowerCount((c) => Math.max(0, c - 1));
    } else {
      await supabase.from("follows" as any).insert({ follower_id: user.id, following_id: targetUserId });
      setIsFollowing(true);
      setFollowerCount((c) => c + 1);
    }
    setLoading(false);
  }, [user, targetUserId, isFollowing]);

  return { isFollowing, followerCount, followingCount, loading, toggleFollow };
}
