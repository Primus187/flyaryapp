import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useChatInbox } from "@/hooks/use-chat";
import { formatUnread, totalUnread } from "@/lib/chat";

/** Header entry to the messages inbox with the unread count. */
export default function MessagesButton() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const unread = totalUnread(useChatInbox().data || []);
  return (
    <Button size="icon" variant="outline" className="relative" onClick={() => navigate("/messages")}
      aria-label={unread ? t("chat.messagesUnread", { count: unread }) : t("chat.messages")}>
      <MessageCircle className="h-5 w-5" />
      {unread > 0 && <UnreadDot count={unread} />}
    </Button>
  );
}

export function UnreadDot({ count, className = "" }: { count: number; className?: string }) {
  return (
    <span className={`absolute -top-1.5 -right-1.5 min-w-[1.15rem] h-[1.15rem] rounded-full bg-warning px-1 text-[11px] font-extrabold leading-[1.15rem] text-warning-foreground text-center ring-2 ring-background ${className}`}>
      {formatUnread(count)}
    </span>
  );
}
