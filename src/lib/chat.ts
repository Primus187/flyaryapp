/** Chat channels (migration 0025): shapes returned by chat_inbox()/chat_channel_json() and the
 *  pure helpers the inbox, channel page and channel form share. */
export type ChannelKind = "group" | "event" | "direct";
export type ChannelAudience = "all" | "team" | "students" | "custom";
export type InboxFilter = "all" | "school" | "groups" | "events";

export interface ChatChannel {
  id: string;
  kind: ChannelKind;
  name: string | null;
  description: string | null;
  group_id: string | null;
  group_name: string | null;
  group_type: "school" | "pilot_group" | null;
  event_id: string | null;
  event_title: string | null;
  event_date: string | null;
  audience: ChannelAudience;
  audience_levels: string[] | null;
  staff_only_posting: boolean;
  is_default: boolean;
  archived_at: string | null;
  created_at: string;
  last_message_at: string | null;
  can_manage: boolean;
  can_post: boolean;
  last_message: { message: string; has_attachment: boolean; is_announcement: boolean; created_at: string; user_id: string; author: string } | null;
  unread: number;
}

/** Training levels a students channel can be limited to (school stages without "licensed"). */
export const STUDENT_LEVELS = ["ground", "altitude", "exam_ready"] as const;

export function channelTitle(channel: Pick<ChatChannel, "kind" | "name" | "event_title">): string {
  return channel.kind === "event" ? channel.event_title || "" : channel.name || "";
}

export function matchesFilter(channel: ChatChannel, filter: InboxFilter): boolean {
  switch (filter) {
    case "school": return channel.kind === "group" && channel.group_type === "school";
    case "groups": return channel.kind === "group" && channel.group_type !== "school";
    case "events": return channel.kind === "event";
    default: return true;
  }
}

/** Active channels first (most recent activity on top), archived ones at the end. */
export function sortChannels(channels: ChatChannel[]): ChatChannel[] {
  const activity = (c: ChatChannel) => new Date(c.last_message_at || c.created_at).getTime();
  return [...channels].sort((a, b) => Number(!!a.archived_at) - Number(!!b.archived_at) || activity(b) - activity(a));
}

export function filterChannels(channels: ChatChannel[], filter: InboxFilter, query = ""): ChatChannel[] {
  const q = query.trim().toLowerCase();
  return sortChannels(channels.filter((c) => matchesFilter(c, filter)
    && (!q || `${channelTitle(c)} ${c.group_name ?? ""}`.toLowerCase().includes(q))));
}

/** Unread messages across active channels (archived channels do not count). */
export function totalUnread(channels: ChatChannel[]): number {
  return channels.reduce((sum, c) => sum + (c.archived_at ? 0 : c.unread || 0), 0);
}

export function formatUnread(count: number): string {
  return count > 99 ? "99+" : String(count);
}

/** Which filter chips are worth showing (only those with at least one channel). */
export function availableFilters(channels: ChatChannel[]): InboxFilter[] {
  return (["all", "school", "groups", "events"] as InboxFilter[]).filter((f) => f === "all" || channels.some((c) => matchesFilter(c, f)));
}

type Translate = (key: string, options?: Record<string, unknown>) => string;
/** Short description of who is in a channel, e.g. "Schüler · Grundkurs, Höhenflug". */
export function audienceSummary(channel: Pick<ChatChannel, "kind" | "audience" | "audience_levels">, t: Translate): string {
  if (channel.kind === "event") return t("chat.audience.event");
  if (channel.kind === "direct") return t("chat.audience.direct");
  const base = t(`chat.audience.${channel.audience}`);
  const levels = channel.audience === "students" ? channel.audience_levels || [] : [];
  return levels.length ? `${base} · ${levels.map((l) => t(`chat.levels.${l}`)).join(", ")}` : base;
}

/** Groups in which the user may create channels (school staff / group admins manage every group
 *  channel there, so any managed group channel identifies such a group). */
export function managedGroups(channels: ChatChannel[]): { id: string; name: string; group_type: string | null }[] {
  const seen = new Map<string, { id: string; name: string; group_type: string | null }>();
  for (const c of channels) {
    if (c.kind === "group" && c.can_manage && c.group_id && !seen.has(c.group_id)) {
      seen.set(c.group_id, { id: c.group_id, name: c.group_name || "", group_type: c.group_type });
    }
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
}
