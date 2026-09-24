import { useTranslation } from "react-i18next";
import { Lock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import ChannelChat from "@/components/chat/ChannelChat";
import { useChatChannel } from "@/hooks/use-chat";

/** The event's chat: readable for signed-up pilots and the team only. */
export default function EventChannel({ eventId }: { eventId: string }) {
  const { t } = useTranslation();
  const query = useChatChannel({ eventId });
  if (query.isPending) return <Skeleton className="h-80 w-full rounded-lg" />;
  if (!query.data) {
    return (
      <p className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
        <Lock className="h-3.5 w-3.5 shrink-0" /> {t("chat.eventChatSignupOnly")}
      </p>
    );
  }
  return <ChannelChat key={query.data.id} channel={query.data} />;
}
