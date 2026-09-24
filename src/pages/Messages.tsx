import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2, PenSquare, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import ChannelList from "@/components/chat/ChannelList";
import ChannelFormDialog from "@/components/chat/ChannelFormDialog";
import NewDirectMessageDialog from "@/components/chat/NewDirectMessageDialog";
import { useChatInbox, useChatSearch } from "@/hooks/use-chat";
import { availableFilters, filterChannels, managedGroups, type InboxFilter } from "@/lib/chat";

/** Messages: every channel of all groups and all direct chats in one place, with unread counts and search. */
export default function Messages() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const inbox = useChatInbox();
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [directOpen, setDirectOpen] = useState(false);
  const channels = useMemo(() => inbox.data || [], [inbox.data]);
  const filters = availableFilters(channels);
  const groups = managedGroups(channels);
  const visible = filterChannels(channels, filters.includes(filter) ? filter : "all", query);
  const search = useChatSearch(debouncedQuery);
  const locale = i18n.language === "fr" ? "fr-CH" : i18n.language === "en" ? "en-GB" : "de-CH";

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const searching = debouncedQuery.trim().length >= 2;

  return (
    <PageContainer>
      <PageHeader title={t("chat.messages")} action={
        <div className="flex gap-1.5">
          {groups.length > 0 && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" />{t("chat.channel")}</Button>
          )}
          <Button size="sm" className="gap-1.5" onClick={() => setDirectOpen(true)}><PenSquare className="h-4 w-4" />{t("chat.newDirectShort")}</Button>
        </div>
      } />
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("chat.searchAll")} className="pl-9" />
      </div>
      {filters.length > 2 && !searching && (
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
        <>
          {(!searching || visible.length > 0) && (
            <ChannelList channels={visible} emptyText={channels.length === 0 ? t("chat.noChannelsJoinGroup") : undefined} />
          )}
          {searching && (
            <section className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("chat.messageHits")}</h2>
              {search.isPending ? (
                <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : (search.data || []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">{t("chat.noMessageHits")}</p>
              ) : (
                <div className="rounded-xl bg-card shadow-sm divide-y overflow-hidden">
                  {(search.data || []).map((hit) => (
                    <button key={hit.id} type="button" onClick={() => navigate(`/messages/${hit.channel_id}?m=${hit.id}`)}
                      className="w-full px-3 py-2.5 text-left hover:bg-muted/50 transition-colors">
                      <div className="flex items-baseline gap-2 text-xs text-muted-foreground">
                        <span className="truncate font-medium text-foreground">{hit.channel || "Chat"}</span>
                        {hit.group_name && hit.kind !== "direct" && <span className="truncate">{hit.group_name}</span>}
                        <span className="ml-auto shrink-0">{new Date(hit.created_at).toLocaleDateString(locale, { day: "numeric", month: "short" })}</span>
                      </div>
                      <p className="text-sm line-clamp-2">
                        <span className="text-muted-foreground">{hit.author}: </span>
                        {highlight(hit.message, debouncedQuery.trim())}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      )}
      <ChannelFormDialog open={createOpen} onOpenChange={setCreateOpen} groups={groups} onSaved={(id) => navigate(`/messages/${id}`)} />
      <NewDirectMessageDialog open={directOpen} onOpenChange={setDirectOpen} />
    </PageContainer>
  );
}

/** Marks the search term in a hit (case-insensitive). */
function highlight(text: string, term: string) {
  const index = text.toLowerCase().indexOf(term.toLowerCase());
  if (index < 0 || !term) return text;
  return (
    <>
      {text.slice(0, index)}
      <mark className="rounded bg-amber-200/70 px-0.5 text-foreground dark:bg-amber-500/40">{text.slice(index, index + term.length)}</mark>
      {text.slice(index + term.length)}
    </>
  );
}
