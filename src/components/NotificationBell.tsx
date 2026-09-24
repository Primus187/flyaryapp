import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Bell } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  actor_id: string;
  type: string;
  reference_id: string | null;
  reference_type: string | null;
  read: boolean;
  created_at: string;
  actor_name: string;
  actor_avatar: string;
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export default function NotificationBell() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("notifications")
      .select("id, actor_id, type, reference_id, reference_type, read, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);

    if (!data) return;

    // Marketplace notifications have no actor (sender "Marktplatz"); a null id would make the whole lookup fail.
    const actorIds = [...new Set(data.map(n => n.actor_id).filter((id): id is string => !!id))];
    const profileMap: Record<string, { name: string; avatar: string }> = {};

    if (actorIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, pilot_name, avatar_url")
        .in("user_id", actorIds);

      if (profiles) {
        const avatarPaths = profiles.filter(p => p.avatar_url && !p.avatar_url.startsWith("http")).map(p => p.avatar_url!);
        const avatarMap: Record<string, string> = {};
        if (avatarPaths.length > 0) {
          const { data: signed } = await supabase.storage.from("flight-photos").createSignedUrls(avatarPaths, 3600);
          signed?.forEach(s => { if (s.signedUrl) avatarMap[s.path] = s.signedUrl; });
        }
        profiles.forEach(p => {
          let avatar = "";
          if (p.avatar_url) {
            avatar = p.avatar_url.startsWith("http") ? p.avatar_url : (avatarMap[p.avatar_url] || "");
          }
          profileMap[p.user_id] = { name: p.pilot_name || "Pilot", avatar };
        });
      }
    }

    const mapped: Notification[] = data.map(n => ({
      ...n,
      actor_name: profileMap[n.actor_id]?.name || "Pilot",
      actor_avatar: profileMap[n.actor_id]?.avatar || "",
    }));

    setNotifications(mapped);
    setUnreadCount(mapped.filter(n => !n.read).length);
  }, [user]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  // Poll every 30s
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [user, fetchNotifications]);

  const handleOpen = async (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && unreadCount > 0 && user) {
      await supabase
        .from("notifications")
        .update({ read: true } as any)
        .eq("user_id", user.id)
        .eq("read", false);
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    }
  };

  const handleNotificationClick = (n: Notification) => {
    setOpen(false);
    if (n.type === "follow" && n.actor_id) {
      navigate(`/pilot/${n.actor_id}`);
      return;
    }
    if (n.reference_id && n.reference_type) {
      if (n.reference_type === "saved_search") navigate(`/market?saved=${n.reference_id}`);
      else if (n.reference_type === "listing") navigate(n.type === "market_expiring" ? "/market/mine" : n.type === "market_fav_sold" ? "/market/mine?tab=favorites" : `/market/${n.reference_id}`);
      else if (n.reference_type === "chat") navigate(`/messages/${n.reference_id}`);
      else if (n.reference_type === "flight") navigate(`/flights/${n.reference_id}`);
      else if (n.reference_type === "event") navigate(`/events/${n.reference_id}`);
      else if (n.reference_type === "achievement") navigate(`/feed`);
    }
  };

  const getNotificationText = (n: Notification) => {
    if (n.type === "like") return t("notifications.liked");
    if (n.type === "comment") return t("notifications.commented");
    if (n.type === "follow") return t("notifications.followed");
    if (n.type === "chat_mention") return t("notifications.mentionedInChat");
    if (n.type === "market_removed") return t("market.moderation.notification");
    if (n.type === "market_expiring") return t("market.mine.expiringNotification");
    if (n.type === "market_fav_price") return t("market.favorites.notifyPrice");
    if (n.type === "market_fav_reserved") return t("market.favorites.notifyReserved");
    if (n.type === "market_fav_sold") return t("market.favorites.notifySold");
    if (n.type === "market_search") return t("market.saved.notification");
    return "";
  };

  const getRefLabel = (n: Notification) => {
    if (n.reference_type === "flight") return t("notifications.yourFlight");
    if (n.reference_type === "event") return t("notifications.yourEvent");
    if (n.reference_type === "achievement") return t("notifications.yourAchievement");
    return "";
  };

  if (!user) return null;

  return (
    <Sheet open={open} onOpenChange={handleOpen}>
      <SheetTrigger asChild>
        <button className="relative p-2 active:scale-95 transition-transform">
          <Bell className="h-5 w-5 text-foreground" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[320px] p-0">
        <SheetHeader className="p-4 pb-2">
          <SheetTitle>{t("notifications.title")}</SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-64px)]">
          {notifications.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-12">
              {t("notifications.empty")}
            </p>
          ) : (
            <div className="divide-y divide-border/50">
              {notifications.map(n => {
                const initials = n.actor_name.split(" ").map(s => s[0]).join("").toUpperCase().slice(0, 2);
                return (
                  <button
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={cn(
                      "w-full flex items-start gap-3 p-3 text-left transition-colors hover:bg-muted/50 active:scale-[0.98]",
                      !n.read && "bg-primary/5"
                    )}
                  >
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarImage src={n.actor_avatar} />
                      <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">
                        <span className="font-semibold">{n.type.startsWith("market_") ? t("market.title") : n.actor_name}</span>{" "}
                        <span className="text-muted-foreground">{getNotificationText(n)}</span>{" "}
                        <span className="font-medium">{getRefLabel(n)}</span>
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {relativeTime(n.created_at)}
                      </p>
                    </div>
                    {!n.read && (
                      <span className="mt-2 h-2 w-2 rounded-full bg-primary shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
