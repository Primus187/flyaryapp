import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import BadgeGrid from "@/components/BadgeGrid";
import HexBadge from "@/components/HexBadge";
import { BADGES } from "@/lib/badges";
import { ChevronLeft, Trophy, Clock, Mountain, MapPin, Wind, UserPlus, UserMinus, MessageCircle } from "lucide-react";
import { openDirectChannel } from "@/hooks/use-chat";
import { useToast } from "@/hooks/use-toast";
import { useFollows } from "@/hooks/use-follows";

const LEVEL_THRESHOLDS = [0, 100, 300, 600, 1000, 1500, 2500, 4000, 6000, 9000, 13000, 18000, 25000];
const LEVEL_NAMES = ["Rookie", "Starter", "Pilot", "Flieger", "Thermiker", "Streckenflieger", "Adler", "Falke", "Kondor", "Ikarus", "Skywalker", "Legende", "Meister"];

interface PilotData {
  pilot_name: string;
  bio: string | null;
  avatar_url: string | null;
  cover_photo_url: string | null;
  flight_school: string | null;
}

interface GliderData {
  manufacturer: string;
  model: string;
  size: string | null;
  is_default: boolean;
}

export default function PilotProfile() {
  const { userId } = useParams<{ userId: string }>();
  const { user } = useAuth();
  const { isFollowing, followerCount, followingCount, loading: followLoading, toggleFollow } = useFollows(userId);
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<PilotData | null>(null);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [xp, setXp] = useState<{ total_xp: number; level: number }>({ total_xp: 0, level: 1 });
  const [badges, setBadges] = useState<{ badge_key: string; unlocked_at: string }[]>([]);
  const [gliders, setGliders] = useState<GliderData[]>([]);
  const [stats, setStats] = useState({ flights: 0, hours: 0, altitudeGain: 0, distance: 0, uniqueSites: 0 });
  const [showAllBadges, setShowAllBadges] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profilePhotos, setProfilePhotos] = useState<{ signedUrl: string }[]>([]);
  const [canMessage, setCanMessage] = useState(false);
  const [openingChat, setOpeningChat] = useState(false);
  const { toast } = useToast();

  // Direct messages are possible with people sharing a group.
  useEffect(() => {
    if (!user || !userId || user.id === userId) { setCanMessage(false); return; }
    supabase.rpc("chat_shares_group", { _a: user.id, _b: userId }).then(({ data }) => setCanMessage(data === true));
  }, [user, userId]);

  const startChat = async () => {
    if (!userId) return;
    setOpeningChat(true);
    try {
      navigate(`/messages/${await openDirectChannel(userId)}`);
    } catch (error) {
      toast({ title: t("common.error"), description: (error as Error).message, variant: "destructive" });
    } finally {
      setOpeningChat(false);
    }
  };

  useEffect(() => {
    if (!userId) return;
    loadProfile();
  }, [userId]);

  const resolveUrl = async (path: string | null): Promise<string> => {
    if (!path) return "";
    if (path.startsWith("http")) return path;
    const { data } = await supabase.storage.from("flight-photos").createSignedUrl(path, 3600);
    return data?.signedUrl || "";
  };

  const loadProfile = async () => {
    setLoading(true);
    try {
      const [profileRes, xpRes, badgesRes, glidersRes, flightsRes, photosRes] = await Promise.all([
        supabase.from("profiles").select("pilot_name, bio, avatar_url, cover_photo_url, flight_school").eq("user_id", userId!).single(),
        supabase.from("pilot_xp").select("total_xp, level").eq("user_id", userId!).single(),
        supabase.from("pilot_badges").select("badge_key, unlocked_at").eq("user_id", userId!),
        supabase.from("pilot_gliders").select("manufacturer, model, size, is_default").eq("user_id", userId!),
        supabase.from("flights").select("duration_minutes, altitude_gain, distance_km, takeoff_location_id").eq("user_id", userId!),
        supabase.from("profile_photos").select("storage_path").eq("user_id", userId!).order("sort_order"),
      ]);

      if (profileRes.data) {
        const d = profileRes.data as any;
        setProfile(d as PilotData);
        setAvatarUrl(await resolveUrl(d.avatar_url));
        setCoverUrl(await resolveUrl(d.cover_photo_url));
      }

      if (xpRes.data) setXp(xpRes.data as any);
      if (badgesRes.data) setBadges(badgesRes.data.map(b => ({ badge_key: b.badge_key, unlocked_at: b.unlocked_at || "" })));
      if (glidersRes.data) setGliders(glidersRes.data);

      if (photosRes.data && (photosRes.data as any[]).length > 0) {
        const photos = await Promise.all((photosRes.data as any[]).map(async (p: any) => ({
          signedUrl: await resolveUrl(p.storage_path),
        })));
        setProfilePhotos(photos);
      }

      if (flightsRes.data) {
        const flights = flightsRes.data;
        setStats({
          flights: flights.length,
          hours: Math.round(flights.reduce((sum, f) => sum + (f.duration_minutes || 0), 0) / 60),
          altitudeGain: flights.reduce((sum, f) => sum + (f.altitude_gain || 0), 0),
          distance: Math.round(flights.reduce((sum, f) => sum + Number(f.distance_km || 0), 0)),
          uniqueSites: new Set(flights.map(f => f.takeoff_location_id).filter(Boolean)).size,
        });
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="h-40 bg-muted animate-pulse" />
        <div className="px-4 space-y-4 mt-4">
          <div className="h-24 rounded-xl bg-muted animate-pulse" />
          <div className="h-32 rounded-xl bg-muted animate-pulse" />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="px-4 pt-6 pb-4 max-w-lg mx-auto text-center">
        <p className="text-muted-foreground">{t("common.error")}</p>
      </div>
    );
  }

  const initials = profile.pilot_name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "?";
  const level = xp.level;
  const totalXp = xp.total_xp;
  const xpForCurrent = LEVEL_THRESHOLDS[level - 1] || 0;
  const xpForNext = LEVEL_THRESHOLDS[level] || totalXp;
  const xpProgress = xpForNext > xpForCurrent ? ((totalXp - xpForCurrent) / (xpForNext - xpForCurrent)) * 100 : 100;

  const unlockedSet = new Set(badges.map(b => b.badge_key));
  const tierOrder: Record<string, number> = { gold: 0, silver: 1, bronze: 2 };
  const topBadges = BADGES
    .filter(b => unlockedSet.has(b.key))
    .sort((a, b) => (tierOrder[a.tier] || 2) - (tierOrder[b.tier] || 2))
    .slice(0, 6);

  const defaultGlider = gliders.find(g => g.is_default) || gliders[0];

  return (
    <div className="pb-4 max-w-lg mx-auto">
      {/* Cover Photo + Avatar Hero */}
      <div className="relative">
        {coverUrl ? (
          <div className="h-40 w-full overflow-hidden">
            <img src={coverUrl} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
          </div>
        ) : (
          <div className="h-32 w-full bg-gradient-to-br from-primary/20 via-accent/10 to-secondary/20" />
        )}

        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-3 left-3 h-8 w-8 rounded-full bg-background/70 backdrop-blur flex items-center justify-center active:scale-95 transition-transform"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {/* Avatar overlapping cover */}
        <div className="flex justify-center -mt-14 relative z-10">
          <div className="p-[3px] rounded-full bg-gradient-to-tr from-primary via-accent to-secondary shadow-lg">
            <Avatar className="h-24 w-24 border-[3px] border-background">
              <AvatarImage src={avatarUrl} className="object-cover" />
              <AvatarFallback className="text-2xl bg-muted">{initials}</AvatarFallback>
            </Avatar>
          </div>
        </div>
      </div>

      {/* Name, Level, Bio */}
      <div className="px-4 pt-3 pb-5 text-center space-y-1.5">
        <h1 className="text-xl font-bold tracking-tight">{profile.pilot_name || t("common.unknown")}</h1>
        <p className="text-sm text-muted-foreground">
          Lv.{level} · {LEVEL_NAMES[level - 1]}
        </p>
        <div className="flex justify-center gap-4 text-sm text-muted-foreground">
          <span><strong className="text-foreground">{followerCount}</strong> Follower</span>
          <span><strong className="text-foreground">{followingCount}</strong> Following</span>
        </div>
        {user && userId && user.id !== userId && (
          <div className="flex justify-center gap-2">
            <Button
              variant={isFollowing ? "outline" : "default"}
              size="sm"
              className="mt-2 gap-1.5"
              disabled={followLoading}
              onClick={toggleFollow}
            >
              {isFollowing ? <UserMinus className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
              {isFollowing ? t("follows.unfollow") : t("follows.follow")}
            </Button>
            {canMessage && (
              <Button variant="outline" size="sm" className="mt-2 gap-1.5" disabled={openingChat} onClick={() => void startChat()}>
                <MessageCircle className="h-3.5 w-3.5" />
                {t("chat.sendMessage")}
              </Button>
            )}
          </div>
        )}
        {profile.bio && (
          <p className="text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed mt-2">{profile.bio}</p>
        )}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-1 px-4 mb-4">
        {[
          { value: stats.flights, label: t("pilotProfile.flights") },
          { value: stats.hours, label: t("pilotProfile.hours") },
          { value: stats.altitudeGain.toLocaleString(), label: t("pilotProfile.altitude") },
          { value: stats.uniqueSites, label: t("pilotProfile.sites") },
        ].map((s, i) => (
          <div key={i} className="text-center p-2 rounded-xl bg-card border border-border/30">
            <p className="text-lg font-bold tabular-nums">{s.value}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
          </div>
        ))}
      </div>

      {/* XP Progress */}
      <div className="px-4 mb-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">{totalXp.toLocaleString()} XP</span>
              <span className="text-xs text-muted-foreground">
                {level < 13 ? `${xpForNext.toLocaleString()} XP → Lv.${level + 1}` : "Max Level"}
              </span>
            </div>
            <Progress value={xpProgress} className="h-2" />
          </CardContent>
        </Card>
      </div>

      {/* Top Badges */}
      <div className="px-4 mb-4">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-500" /> {t("pilotProfile.topBadges")}
            </CardTitle>
            <button onClick={() => setShowAllBadges(!showAllBadges)} className="text-xs text-primary font-medium">
              {showAllBadges ? t("common.close") : t("badges.showAll")}
            </button>
          </CardHeader>
          <CardContent>
            {showAllBadges ? (
              <BadgeGrid unlockedBadges={badges} />
            ) : topBadges.length > 0 ? (
              <div className="grid grid-cols-6 gap-1 justify-items-center">
                {topBadges.map(badge => (
                  <HexBadge key={badge.key} badge={badge} unlocked size={48} />
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-2">{t("badges.noBadges")}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Photo Gallery */}
      {profilePhotos.length > 0 && (
        <div className="px-4 mb-4">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t("pilotProfile.photos")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-1.5">
                {profilePhotos.map((photo, i) => (
                  <div key={i} className="aspect-square rounded-lg overflow-hidden">
                    <img src={photo.signedUrl} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Glider Info */}
      {defaultGlider && (
        <div className="px-4 mb-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{t("pilotProfile.glider")}</p>
              <p className="text-sm font-medium">
                {defaultGlider.manufacturer} {defaultGlider.model}
                {defaultGlider.size && <span className="text-muted-foreground"> · {defaultGlider.size}</span>}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Flight school (the SHV number is private to the pilot, see migration 0018) */}
      {profile.flight_school && (
        <div className="px-4 mb-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 space-y-2">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">{t("pilotProfile.flightSchool")}</p>
                <p className="text-sm font-medium">{profile.flight_school}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
