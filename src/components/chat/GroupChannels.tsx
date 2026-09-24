import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import ChannelList from "@/components/chat/ChannelList";
import ChannelFormDialog from "@/components/chat/ChannelFormDialog";
import { useChatInbox } from "@/hooks/use-chat";
import { sortChannels } from "@/lib/chat";

/** The channels of one group (group page, school communication); staff can create new ones. */
export default function GroupChannels({ groupId, groupName, groupType }: { groupId: string; groupName: string; groupType: string | null }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const inbox = useChatInbox();
  const [createOpen, setCreateOpen] = useState(false);
  const channels = sortChannels((inbox.data || []).filter((c) => c.kind === "group" && c.group_id === groupId));
  const canCreate = channels.some((c) => c.can_manage);

  if (inbox.isPending) return <div className="space-y-2">{[1, 2].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>;
  return (
    <div className="space-y-3">
      {canCreate && (
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />{t("chat.newChannel")}
        </Button>
      )}
      <ChannelList channels={channels} showGroup={false} />
      {canCreate && (
        <ChannelFormDialog open={createOpen} onOpenChange={setCreateOpen} groups={[{ id: groupId, name: groupName, group_type: groupType }]}
          onSaved={(id) => navigate(`/messages/${id}`)} />
      )}
    </div>
  );
}
