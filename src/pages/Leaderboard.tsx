import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Trophy, Medal, Award, Star, ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const LEVEL_THRESHOLDS = [0, 100, 300, 600, 1000, 1500, 2500, 4000, 6000, 9000, 13000, 18000, 25000];
const LEVEL_NAMES = ["Rookie", "Starter", "Pilot", "Flieger", "Thermiker", "Streckenflieger", "Adler", "Falke", "Kondor", "Ikarus", "Skywalker", "Legende", "Meister"];
const LEVEL_COLORS = [
  "text-muted-foreground",
  "text-emerald-400", "text-emerald-400",
  "text-sky-400", "text-sky-400",
  "text-violet-400", "text-violet-400",
  "text-amber-400", "text-amber-400",
  "text-orange-400", "text-orange-400",
  "text-rose-400", "text-rose-400",
];

function getLevelIcon(level: number) {
  if (level >= 10) return <Trophy className="h-5 w-5 text-amber-400" />;
  if (level >= 7) return <Medal className="h-5 w-5 text-violet-400" />;
  if (level >= 4) return <Award className="h-5 w-5 text-sky-400" />;
  return <Star className="h-5 w-5 text-emerald-400" />;
}

interface LeaderboardEntry {
  user_id: string;
  total_xp: number;
  level: number;
  pilot_name: string;
  avatar_url: string | null;
  avatar_signed?: string;
}

export default function Leaderboard() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>("all");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase.from("group_members").select("group_id, groups(id, name)").eq("user_id", user.id).then(({ data }) => {
      if (data) {
        const g = data.map((d: any) => ({ id: d.groups.id, name: d.groups.name }));
        setGroups(g);
      }
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    loadLeaderboard();
  }, [user, selectedGroup]);

  const loadLeaderboard = async () => {
    setLoading(true);
    try {
      let userIds: string[] = [];
      if (selectedGroup === "all") {
        const { data: members } = await supabase.from("group_members").select("group_id").eq("user_id", user!.id);
        if (members?.length) {
          const groupIds = members.map(m => m.group_id);
          const { data: allMembers } = await supabase.from("group_members").select("user_id").in("group_id", groupIds);
          userIds = [...new Set(allMembers?.map(m => m.user_id) || [])];
        }
      } else {
        const { data: members } = await supabase.from("group_members").select("user_id").eq("group_id", selectedGroup);
        userIds = members?.map(m => m.user_id) || [];
      }

      if (!userIds.includes(user!.id)) userIds.push(user!.id);

      const { data: xpData } = await supabase.from("pilot_xp" as any).select("user_id, total_xp, level").in("user_id", userIds).order("total_xp", { ascending: false });
      const { data: profiles } = await supabase.from("profiles").select("user_id, pilot_name, avatar_url").in("user_id", userIds);

      const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));

      const leaderboard: LeaderboardEntry[] = (xpData as any[] || []).map((xp: any) => {
        const profile = profileMap.get(xp.user_id);
        return {
          user_id: xp.user_id,
          total_xp: xp.total_xp,
          level: xp.level,
          pilot_name: profile?.pilot_name || "Pilot",
          avatar_url: profile?.avatar_url || null,
        };
      });

      // Resolve avatar signed URLs
      for (const entry of leaderboard) {
        if (entry.avatar_url && !entry.avatar_url.startsWith("http")) {
          const { data } = await supabase.storage.from("flight-photos").createSignedUrl(entry.avatar_url, 3600);
          if (data?.signedUrl) entry.avatar_signed = data.signedUrl;
        } else if (entry.avatar_url) {
          entry.avatar_signed = entry.avatar_url;
        }
      }

      setEntries(leaderboard);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1"><ChevronLeft className="h-5 w-5" /></button>
        <h1 className="text-2xl font-bold tracking-tight">{t("leaderboard.title")}</h1>
      </div>

      <Select value={selectedGroup} onValueChange={setSelectedGroup}>
        <SelectTrigger><SelectValue placeholder={t("leaderboard.allGroups")} /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("leaderboard.allGroups")}</SelectItem>
          {groups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
        </SelectContent>
      </Select>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : entries.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">{t("leaderboard.noData")}</p>
      ) : (
        <div className="space-y-2">
          {entries.map((entry, idx) => {
            const rank = idx + 1;
            const isMe = entry.user_id === user?.id;
            const xpForCurrentLevel = LEVEL_THRESHOLDS[entry.level - 1] || 0;
            const xpForNextLevel = LEVEL_THRESHOLDS[entry.level] || entry.total_xp;
            const progress = xpForNextLevel > xpForCurrentLevel
              ? ((entry.total_xp - xpForCurrentLevel) / (xpForNextLevel - xpForCurrentLevel)) * 100
              : 100;
            const initials = entry.pilot_name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

            return (
              <div
                key={entry.user_id}
                onClick={() => navigate(`/pilot/${entry.user_id}`)}
                className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                  isMe ? "bg-primary/10 border border-primary/20" : "bg-card border border-border/30"
                } ${rank <= 3 ? "shadow-sm" : ""}`}
              >
                <div className={`w-7 text-center font-bold text-sm ${
                  rank === 1 ? "text-amber-400" : rank === 2 ? "text-zinc-400" : rank === 3 ? "text-orange-400" : "text-muted-foreground"
                }`}>
                  {rank <= 3 ? <Trophy className={`h-4 w-4 mx-auto ${
                    rank === 1 ? "text-amber-400" : rank === 2 ? "text-zinc-400" : "text-orange-400"
                  }`} /> : rank}
                </div>

                <div className="relative p-[2px] rounded-full bg-gradient-to-tr from-primary/60 to-accent/60">
                  <Avatar className="h-10 w-10 border-2 border-background">
                    <AvatarImage src={entry.avatar_signed} />
                    <AvatarFallback className="text-xs bg-muted">{initials}</AvatarFallback>
                  </Avatar>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium truncate">{entry.pilot_name}</span>
                    {getLevelIcon(entry.level)}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Progress value={progress} className="h-1.5 flex-1" />
                    <span className={`text-[10px] font-medium ${LEVEL_COLORS[entry.level - 1]}`}>
                      Lv.{entry.level}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-sm font-bold tabular-nums">{entry.total_xp.toLocaleString()}</span>
                  <span className="text-[10px] text-muted-foreground block">XP</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="p-3 rounded-xl bg-muted/30 border border-border/20">
        <p className="text-xs text-muted-foreground leading-relaxed">
          {t("leaderboard.xpExplainer")}
        </p>
      </div>
    </div>
  );
}
