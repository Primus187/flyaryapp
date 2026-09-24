import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import ChannelList from "@/components/chat/ChannelList";
import ChannelFormDialog from "@/components/chat/ChannelFormDialog";
import { useChatInbox } from "@/hooks/use-chat";
import { availableFilters, filterChannels, managedGroups, type InboxFilter } from "@/lib/chat";

/** Messages: every channel of all groups in one place, with unread counts. */
export default function Messages() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const inbox = useChatInbox();
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const channels = useMemo(() => inbox.data || [], [inbox.data]);
  const filters = availableFilters(channels);
  const groups = managedGroups(channels);
  const visible = filterChannels(channels, filters.includes(filter) ? filter : "all", query);

  return (
    <PageContainer>
      <PageHeader title={t("chat.messages")} action={groups.length > 0 ? (
        <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" />{t("chat.newChannel")}</Button>
      ) : undefined} />
      {channels.length > 6 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("chat.search")} className="pl-9" />
        </div>
      )}
      {filters.length > 2 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {filters.map((f) => (
            <button key={f} type="button" onClick={() => setFilter(f)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${filter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
              {t(`chat.filters.${f}`)}
            </button>
          ))}
        </div>
      )}
      {inbox.isPending ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
      ) : inbox.isError ? (
        <div role="alert" className="text-center space-y-2 py-8">
          <p className="text-sm text-muted-foreground">{t("performance.loadFailed")}</p>
          <Button variant="outline" size="sm" onClick={() => void inbox.refetch()}>{t("performance.retry")}</Button>
        </div>
      ) : (
        <ChannelList channels={visible} emptyText={channels.length === 0 ? t("chat.noChannelsJoinGroup") : undefined} />
      )}
      <ChannelFormDialog open={createOpen} onOpenChange={setCreateOpen} groups={groups} onSaved={(id) => navigate(`/messages/${id}`)} />
    </PageContainer>
  );
}
