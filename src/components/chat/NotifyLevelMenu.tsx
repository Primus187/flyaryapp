import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, BellOff, BellRing, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CHAT_INBOX_KEY } from "@/hooks/use-chat";
import type { ChatChannel, NotifyLevel } from "@/lib/chat";

const LEVELS: { level: NotifyLevel; label: string; hint: string }[] = [
  { level: "all", label: "chat.notifyAll", hint: "chat.notifyAllHint" },
  { level: "mentions", label: "chat.notifyMentions", hint: "chat.notifyMentionsHint" },
  { level: "none", label: "chat.notifyNone", hint: "chat.notifyNoneHint" },
];

/** The viewer's push level for one channel (migration 0028: chat_set_notify_level). */
export default function NotifyLevelMenu({ channel }: { channel: ChatChannel }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  // In direct chats every message counts as addressed to you, so "mentions" behaves like "all".
  const stored = channel.notify_level ?? "mentions";
  const current: NotifyLevel = channel.kind === "direct" && stored === "mentions" ? "all" : stored;
  const Icon = current === "all" ? BellRing : current === "none" ? BellOff : Bell;

  const choose = async (level: NotifyLevel) => {
    if (level === current) return;
    const { error } = await supabase.rpc("chat_set_notify_level", { _channel: channel.id, _level: level });
    if (error) {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: t("chat.notifySaved") });
    void queryClient.invalidateQueries({ queryKey: ["chat-channel", user?.id] });
    void queryClient.invalidateQueries({ queryKey: CHAT_INBOX_KEY(user?.id) });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("chat.notifyTitle")}>
          <Icon className={`h-5 w-5 ${current === "none" ? "text-muted-foreground" : ""}`} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <p className="px-2 py-1.5 text-sm font-semibold">{t("chat.notifyTitle")}</p>
        <DropdownMenuSeparator />
        {LEVELS.filter(({ level }) => channel.kind !== "direct" || level !== "mentions").map(({ level, label, hint }) => (
          <DropdownMenuItem key={level} onSelect={() => void choose(level)} className="items-start gap-2">
            <Check className={`mt-0.5 h-4 w-4 shrink-0 ${level === current ? "opacity-100" : "opacity-0"}`} />
            <div>
              <p className="text-sm">{t(label)}</p>
              <p className="text-xs text-muted-foreground">{t(hint)}</p>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
