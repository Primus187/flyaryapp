import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CalendarDays, Settings, Store, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import ChannelChat from "@/components/chat/ChannelChat";
import ChannelFormDialog from "@/components/chat/ChannelFormDialog";
import NotifyLevelMenu from "@/components/chat/NotifyLevelMenu";
import ListingChatCard from "@/components/market/ListingChatCard";
import { useChatChannel } from "@/hooks/use-chat";
import { audienceSummary, channelTitle } from "@/lib/chat";

/** One channel full-screen: title, audience, settings for the team, the conversation. */
export default function MessageChannel() {
  const { channelId } = useParams<{ channelId: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const query = useChatChannel({ channelId });
  const [editOpen, setEditOpen] = useState(false);
  const channel = query.data;

  if (query.isPending) {
    return <PageContainer><Skeleton className="h-10 w-48" /><Skeleton className="h-96 w-full rounded-xl" /></PageContainer>;
  }
  if (!channel) {
    return (
      <PageContainer>
        <PageHeader title={t("chat.messages")} back="/messages" />
        <p className="text-sm text-muted-foreground text-center py-12">{query.isError ? t("performance.loadFailed") : t("chat.noAccess")}</p>
      </PageContainer>
    );
  }

  const subtitle = channel.kind === "direct" ? t("chat.audience.direct")
    : channel.kind === "listing" ? [t("chat.audience.listing"), channel.listing?.peer_name].filter(Boolean).join(" · ") : [channel.group_name, audienceSummary(channel, t), channel.archived_at ? t("chat.archived") : null].filter(Boolean).join(" · ");
  return (
    <PageContainer>
      <PageHeader title={channelTitle(channel)} subtitle={subtitle} back="/messages" action={
        <>
          <NotifyLevelMenu channel={channel} />
          {channel.kind === "direct" && channel.peer && (
            <Button variant="ghost" size="icon" asChild aria-label={t("chat.openProfile")}>
              <Link to={`/pilot/${channel.peer.user_id}`}><UserRound className="h-5 w-5" /></Link>
            </Button>
          )}
          {channel.kind === "listing" && channel.listing?.listing_id && (
            <Button variant="ghost" size="icon" asChild aria-label={t("market.chat.openListing")}>
              <Link to={`/market/${channel.listing.listing_id}`}><Store className="h-5 w-5" /></Link>
            </Button>
          )}
          {channel.kind === "event" && channel.event_id && (
            <Button variant="ghost" size="icon" asChild aria-label={t("chat.openEvent")}>
              <Link to={`/events/${channel.event_id}`}><CalendarDays className="h-5 w-5" /></Link>
            </Button>
          )}
          {channel.kind === "group" && channel.can_manage && (
            <Button variant="ghost" size="icon" onClick={() => setEditOpen(true)} aria-label={t("chat.editChannel")}><Settings className="h-5 w-5" /></Button>
          )}
        </>
      } />
      {channel.description && <p className="text-xs text-muted-foreground -mt-2">{channel.description}</p>}
      {channel.kind === "listing" && channel.listing && <ListingChatCard info={channel.listing} />}
      <ChannelChat key={channel.id} channel={channel} fullHeight focusMessageId={searchParams.get("m")} initialText={searchParams.get("text")} />
      {channel.kind === "group" && channel.can_manage && (
        <ChannelFormDialog open={editOpen} onOpenChange={setEditOpen} channel={channel}
          groups={[{ id: channel.group_id!, name: channel.group_name || "", group_type: channel.group_type }]}
          onDeleted={() => navigate("/messages")} />
      )}
    </PageContainer>
  );
}
