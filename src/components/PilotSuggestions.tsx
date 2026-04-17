import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { UserPlus, Check } from "lucide-react";

interface Suggestion {
  user_id: string;
  pilot_name: string;
  avatar_url: string;
  shared_groups: number;
}

/**
 * Suggests up to 5 pilots from the current user's groups that they don't follow yet.
 */
export default function PilotSuggestions() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      // Groups I'm in
      const { data: myGroups } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", user.id);
      const groupIds = (myGroups || []).map(g => g.group_id);
      if (groupIds.length === 0) { setLoading(false); return; }

      // Members of those groups
      const { data: members } = await supabase
        .from("group_members")
        .select("user_id, group_id")
        .in("group_id", groupIds);

      // Already-followed
      const { data: follows } = await supabase
        .from("follows" as any)
        .select("following_id")
        .eq("follower_id", user.id);
      const followedIds = new Set((follows || []).map((f: any) => f.following_id));

      // Count shared groups per pilot, exclude self & already-followed
      const counts: Record<string, number> = {};
      (members || []).forEach(m => {
        if (m.user_id === user.id || followedIds.has(m.user_id)) return;
        counts[m.user_id] = (counts[m.user_id] || 0) + 1;
      });

      const candidateIds = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id]) => id);
      if (candidateIds.length === 0) { setLoading(false); return; }

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, pilot_name, avatar_url")
        .in("user_id", candidateIds);

      // Sign avatar URLs
      const avatarPaths = (profiles || []).filter(p => p.avatar_url && !p.avatar_url.startsWith("http")).map(p => p.avatar_url!);
      const signedMap: Record<string, string> = {};
      if (avatarPaths.length > 0) {
        const { data: signed } = await supabase.storage.from("flight-photos").createSignedUrls(avatarPaths, 3600);
        signed?.forEach(s => { if (s.signedUrl) signedMap[s.path] = s.signedUrl; });
      }

      const result: Suggestion[] = (profiles || []).map(p => ({
        user_id: p.user_id,
        pilot_name: p.pilot_name || "Pilot",
        avatar_url: p.avatar_url
          ? (p.avatar_url.startsWith("http") ? p.avatar_url : (signedMap[p.avatar_url] || ""))
          : "",
        shared_groups: counts[p.user_id] || 0,
      })).sort((a, b) => b.shared_groups - a.shared_groups);

      setSuggestions(result);
      setLoading(false);
    })();
  }, [user]);

  const handleFollow = async (targetId: string) => {
    if (!user) return;
    setFollowing(prev => new Set(prev).add(targetId));
    await supabase.from("follows" as any).insert({ follower_id: user.id, following_id: targetId });
  };

  if (loading || suggestions.length === 0) return null;

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-4">
        <h3 className="text-sm font-semibold mb-3">{t("feed.suggestedPilots")}</h3>
        <div className="space-y-3">
          {suggestions.map(s => {
            const isFollowing = following.has(s.user_id);
            return (
              <div key={s.user_id} className="flex items-center gap-3">
                <button
                  onClick={() => navigate(`/pilot/${s.user_id}`)}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left"
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={s.avatar_url} />
                    <AvatarFallback>{s.pilot_name.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{s.pilot_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("feed.sharedGroups", { count: s.shared_groups })}
                    </p>
                  </div>
                </button>
                <Button
                  size="sm"
                  variant={isFollowing ? "outline" : "default"}
                  className="h-8 gap-1 text-xs"
                  onClick={() => !isFollowing && handleFollow(s.user_id)}
                  disabled={isFollowing}
                >
                  {isFollowing ? <><Check className="h-3.5 w-3.5" /> {t("feed.following")}</> : <><UserPlus className="h-3.5 w-3.5" /> {t("follows.follow")}</>}
                </Button>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
