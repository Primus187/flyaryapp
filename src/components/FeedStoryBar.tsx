import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface ActivePilot {
  user_id: string;
  pilot_name: string;
  avatar_url: string;
  latest_flight_id: string;
}

export default function FeedStoryBar({ userId, groupIds }: { userId: string; groupIds: string[] }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [pilots, setPilots] = useState<ActivePilot[]>([]);

  useEffect(() => {
    if (!groupIds.length) return;

    (async () => {
      const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      const { data: recentFlights } = await supabase
        .from("flights")
        .select("id, user_id, published_at")
        .in("group_id", groupIds)
        .eq("published_to_feed", true)
        .gte("published_at", since)
        .order("published_at", { ascending: false });

      if (!recentFlights || recentFlights.length === 0) return;

      // Deduplicate by user, keep latest
      const seen = new Map<string, string>();
      for (const f of recentFlights) {
        if (!seen.has(f.user_id)) seen.set(f.user_id, f.id);
      }

      const pilotIds = [...seen.keys()];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, pilot_name, avatar_url")
        .in("user_id", pilotIds);

      if (!profiles) return;

      // Resolve avatars
      const avatarPaths = profiles.filter(p => p.avatar_url && !p.avatar_url.startsWith("http")).map(p => p.avatar_url!);
      const avatarMap: Record<string, string> = {};
      if (avatarPaths.length > 0) {
        const { data: signed } = await supabase.storage.from("flight-photos").createSignedUrls(avatarPaths, 3600);
        signed?.forEach(s => { if (s.signedUrl) avatarMap[s.path] = s.signedUrl; });
      }

      const result: ActivePilot[] = pilotIds.map(uid => {
        const p = profiles.find(pr => pr.user_id === uid);
        let avatarUrl = "";
        if (p?.avatar_url) {
          avatarUrl = p.avatar_url.startsWith("http") ? p.avatar_url : (avatarMap[p.avatar_url] || "");
        }
        return {
          user_id: uid,
          pilot_name: p?.pilot_name || "Pilot",
          avatar_url: avatarUrl,
          latest_flight_id: seen.get(uid)!,
        };
      });

      setPilots(result);
    })();
  }, [groupIds]);

  if (pilots.length === 0) return null;

  return (
    <ScrollArea className="w-full">
      <div className="flex gap-3 pb-2">
        {pilots.map(p => {
          const initials = p.pilot_name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
          return (
            <button
              key={p.user_id}
              className="flex flex-col items-center gap-1 min-w-[64px] active:scale-95 transition-transform"
              onClick={() => navigate(`/flights/${p.latest_flight_id}`)}
            >
              <div className="p-[2px] rounded-full bg-gradient-to-tr from-primary via-secondary to-accent">
                <Avatar className="h-14 w-14 border-2 border-background">
                  <AvatarImage src={p.avatar_url} />
                  <AvatarFallback className="text-xs bg-muted">{initials}</AvatarFallback>
                </Avatar>
              </div>
              <span className="text-[11px] text-muted-foreground truncate max-w-[64px]">
                {p.user_id === userId ? t("feed.you") : p.pilot_name.split(" ")[0]}
              </span>
            </button>
          );
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
