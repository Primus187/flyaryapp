import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface FollowInfo { followers: number; following: number; isFollowing: boolean; canFollow: boolean }

/**
 * Follow state of a profile. Who follows whom is only visible to the two people involved, so the
 * numbers and whether the viewer may follow come from follow_info (migration 0071).
 */
export function useFollows(targetUserId?: string) {
  const { user } = useAuth();
  const [isFollowing, setIsFollowing] = useState(false);
  const [canFollow, setCanFollow] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchFollowState = useCallback(async () => {
    if (!targetUserId || !user) return;
    const { data } = await supabase.rpc("follow_info", { _user_id: targetUserId });
    const info = data as unknown as FollowInfo | null;
    if (!info) return;
    setIsFollowing(!!info.isFollowing);
    setCanFollow(!!info.canFollow);
    setFollowerCount(Number(info.followers) || 0);
    setFollowingCount(Number(info.following) || 0);
  }, [user, targetUserId]);

  useEffect(() => {
    void fetchFollowState();
  }, [fetchFollowState]);

  const toggleFollow = useCallback(async () => {
    if (!user || !targetUserId || user.id === targetUserId) return;
    setLoading(true);
    const { error } = isFollowing
      ? await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", targetUserId)
      : await supabase.from("follows").insert({ follower_id: user.id, following_id: targetUserId });
    if (!error) {
      setIsFollowing(!isFollowing);
      setFollowerCount((c) => Math.max(0, c + (isFollowing ? -1 : 1)));
    }
    setLoading(false);
    // After unfollowing, following again may no longer be allowed.
    void fetchFollowState();
  }, [user, targetUserId, isFollowing, fetchFollowState]);

  return { isFollowing, canFollow, followerCount, followingCount, loading, toggleFollow };
}
