import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import FeedCard, { type FeedFlight } from "@/components/FeedCard";
import EmptyState from "@/components/EmptyState";
import { Users } from "lucide-react";
import { useNavigate } from "react-router-dom";

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
  const [flights, setFlights] = useState<FeedFlight[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFeed = useCallback(async () => {
    if (!user) return;

    // Get user's groups
    const { data: memberships } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("user_id", user.id);

    if (!memberships || memberships.length === 0) {
      setLoading(false);
      return;
    }

    const groupIds = memberships.map(m => m.group_id);

    // Get flights from group members (not own flights — those are in Dashboard)
    const { data: groupFlights } = await supabase
      .from("flights")
      .select("id, date, glider, duration_minutes, altitude_gain, distance_km, user_id, takeoff_location_id, landing_location_id, locations!flights_takeoff_location_id_fkey(name), land:locations!flights_landing_location_id_fkey(name)")
      .in("group_id", groupIds)
      .neq("user_id", user.id)
      .order("date", { ascending: false })
      .limit(20);

    if (!groupFlights || groupFlights.length === 0) {
      setLoading(false);
      return;
    }

    // Get pilot profiles
    const pilotIds = [...new Set(groupFlights.map(f => f.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, pilot_name, avatar_url")
      .in("user_id", pilotIds);

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

    // Get photos for these flights
    const flightIds = groupFlights.map(f => f.id);
    const { data: photos } = await supabase
      .from("flight_photos")
      .select("flight_id, storage_path")
      .in("flight_id", flightIds);

    const photoMap: Record<string, string[]> = {};
    if (photos) {
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

    // Get likes and comments
    const { data: likes } = await supabase
      .from("feed_likes")
      .select("flight_id, user_id")
      .in("flight_id", flightIds);

    const { data: comments } = await supabase
      .from("feed_comments")
      .select("id, flight_id, user_id, message, created_at")
      .in("flight_id", flightIds)
      .order("created_at", { ascending: true });

    // Get commenter profiles
    const commenterIds = [...new Set((comments || []).map(c => c.user_id).filter(id => !profileMap[id]))];
    if (commenterIds.length > 0) {
      const { data: commenterProfiles } = await supabase
        .from("profiles")
        .select("user_id, pilot_name")
        .in("user_id", commenterIds);
      commenterProfiles?.forEach(p => {
        profileMap[p.user_id] = { pilot_name: p.pilot_name || "Pilot", avatar_url: "" };
      });
    }

    // Include own profile for comment display
    if (!profileMap[user.id]) {
      const { data: ownProfile } = await supabase.from("profiles").select("pilot_name").eq("user_id", user.id).single();
      profileMap[user.id] = { pilot_name: ownProfile?.pilot_name || "Du", avatar_url: "" };
    }

    const feedFlights: FeedFlight[] = groupFlights.map((f: any) => ({
      id: f.id,
      date: f.date,
      glider: f.glider,
      duration_minutes: f.duration_minutes,
      altitude_gain: f.altitude_gain,
      distance_km: f.distance_km,
      takeoff_name: f.locations?.name || null,
      landing_name: f.land?.name || null,
      user_id: f.user_id,
      pilot_name: profileMap[f.user_id]?.pilot_name || "Pilot",
      avatar_url: profileMap[f.user_id]?.avatar_url || "",
      photoUrls: photoMap[f.id] || [],
      likes: (likes || []).filter(l => l.flight_id === f.id),
      comments: (comments || []).filter(c => c.flight_id === f.id).map(c => ({
        ...c,
        pilot_name: profileMap[c.user_id]?.pilot_name || "Pilot",
      })),
    }));

    setFlights(feedFlights);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchFeed(); }, [fetchFeed]);

  const handleLikeToggle = async (flightId: string) => {
    if (!user) return;
    const flight = flights.find(f => f.id === flightId);
    if (!flight) return;

    const isLiked = flight.likes.some(l => l.user_id === user.id);
    if (isLiked) {
      await supabase.from("feed_likes").delete().eq("flight_id", flightId).eq("user_id", user.id);
      setFlights(prev => prev.map(f => f.id === flightId ? { ...f, likes: f.likes.filter(l => l.user_id !== user.id) } : f));
    } else {
      await supabase.from("feed_likes").insert({ flight_id: flightId, user_id: user.id });
      setFlights(prev => prev.map(f => f.id === flightId ? { ...f, likes: [...f.likes, { user_id: user.id }] } : f));
    }
  };

  const handleComment = async (flightId: string, message: string) => {
    if (!user) return;
    const { data } = await supabase.from("feed_comments").insert({ flight_id: flightId, user_id: user.id, message }).select("id, created_at").single();
    if (data) {
      const ownName = flights[0] ? "Du" : "Du"; // Will use profileMap in real
      const { data: prof } = await supabase.from("profiles").select("pilot_name").eq("user_id", user.id).single();
      setFlights(prev => prev.map(f => f.id === flightId ? {
        ...f,
        comments: [...f.comments, { id: data.id, user_id: user.id, message, created_at: data.created_at, pilot_name: prof?.pilot_name || "Du" }]
      } : f));
    }
  };

  if (loading) return <FeedSkeleton />;

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto space-y-4">
      <h1 className="text-lg font-bold tracking-tight">{t("feed.title")}</h1>

      {flights.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t("feed.noFlights")}
          description={t("feed.noFlightsDesc")}
          actionLabel={t("groups.joinGroup")}
          onAction={() => navigate("/groups")}
        />
      ) : (
        <div className="space-y-4">
          {flights.map(f => (
            <FeedCard key={f.id} flight={f} onLikeToggle={handleLikeToggle} onComment={handleComment} />
          ))}
        </div>
      )}
    </div>
  );
}
