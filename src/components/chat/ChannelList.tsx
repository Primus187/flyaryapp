import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Archive, BellOff, CalendarDays, Hash, Lock, Megaphone, MessageCircle, Store, Users } from "lucide-react";
import { channelTitle, formatUnread, initials, showsAuthorNames, type ChatChannel } from "@/lib/chat";

function ChannelIcon({ channel }: { channel: ChatChannel }) {
  if (channel.kind === "direct") {
    return (
      <div className="h-10 w-10 shrink-0 rounded-full bg-accent flex items-center justify-center text-sm font-semibold text-accent-foreground">
        {initials(channelTitle(channel))}
      </div>
    );
  }
  const Icon = channel.archived_at ? Archive : channel.kind === "listing" ? Store : channel.kind === "event" ? CalendarDays : channel.audience === "team" ? Users
    : channel.staff_only_posting ? Megaphone : channel.audience === "custom" ? Lock : channel.is_default ? MessageCircle : Hash;
  return (
    <div className="h-10 w-10 shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
      <Icon className="h-5 w-5 text-primary" />
    </div>
  );
}

function relativeTime(iso: string, locale: string) {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  const diffDays = (today.getTime() - d.getTime()) / 86_400_000;
  return diffDays < 6 ? d.toLocaleDateString(locale, { weekday: "short" }) : d.toLocaleDateString(locale, { day: "numeric", month: "short" });
}

/** Channel rows (inbox, group page, school communication); tapping opens /messages/:id. */
export default function ChannelList({ channels, showGroup = true, emptyText }: { channels: ChatChannel[]; showGroup?: boolean; emptyText?: string }) {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "fr" ? "fr-CH" : i18n.language === "en" ? "en-GB" : "de-CH";
  if (channels.length === 0) return <p className="text-sm text-muted-foreground text-center py-8">{emptyText ?? t("chat.noChannels")}</p>;
  return (
    <div className="rounded-xl bg-card shadow-sm divide-y overflow-hidden">
      {channels.map((c) => {
        const last = c.last_message;
        const preview = last
          ? `${last.author && showsAuthorNames(c) ? `${last.author}: ` : ""}${last.message || (last.has_attachment ? t("chat.attachmentPreview") : "")}`
          : c.kind === "event" && c.event_date
            ? new Date(c.event_date).toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" })
            : c.description || t("chat.noMessagesYet");
        return (
          <button key={c.id} type="button" onClick={() => navigate(`/messages/${c.id}`)}
            className={`w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-muted/50 transition-colors ${c.archived_at ? "opacity-60" : ""}`}>
            <ChannelIcon channel={c} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <p className={`truncate text-sm ${c.unread > 0 ? "font-semibold" : "font-medium"}`}>{channelTitle(c)}</p>
                {c.kind === "listing"
                  ? c.listing?.peer_name && <span className="truncate text-[11px] text-muted-foreground">{c.listing.peer_name}</span>
                  : showGroup && c.group_name && <span className="truncate text-[11px] text-muted-foreground">{c.group_name}</span>}
                <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">{relativeTime(c.last_message_at || c.created_at, locale)}</span>
              </div>
              <div className="flex items-center gap-2">
                <p className={`truncate text-xs ${c.unread > 0 ? "text-foreground" : "text-muted-foreground"}`}>
                  {last?.is_announcement && <Megaphone className="inline h-3 w-3 mr-1 text-primary" />}{preview}
                </p>
                {c.notify_level === "none" && <BellOff className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label={t("chat.notify.none")} />}
                {c.unread > 0 && (
                  <span className={`${c.notify_level === "none" ? "bg-muted-foreground/40" : "ml-auto bg-primary"} shrink-0 min-w-[1.25rem] h-5 rounded-full px-1.5 text-[11px] font-semibold text-primary-foreground flex items-center justify-center`}>
                    {formatUnread(c.unread)}
                  </span>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
