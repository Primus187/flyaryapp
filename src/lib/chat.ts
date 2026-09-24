/** Chat channels (migration 0025): shapes returned by chat_inbox()/chat_channel_json() and the
 *  pure helpers the inbox, channel page and channel form share. */
export type ChannelKind = "group" | "event" | "direct" | "listing";
export type ChannelAudience = "all" | "team" | "students" | "custom";
export type InboxFilter = "all" | "direct" | "market" | "school" | "groups" | "events";
export type NotifyLevel = "all" | "mentions" | "none";

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
  /** The viewer's push level for this channel (default "mentions"). */
  notify_level?: NotifyLevel;
  /** Direct channels only: the other person. */
  peer?: { user_id: string; pilot_name: string } | null;
  /** Listing chats only (marketplace 4.6): the listing and the other party. */
  listing?: ListingChatInfo | null;
  last_message: { message: string; has_attachment: boolean; is_announcement: boolean; created_at: string; user_id: string; author: string } | null;
  unread: number;
}

/** marketplace_chat_info(): the listing card of a listing chat (the listing may be gone: status "removed"). */
export interface ListingChatInfo {
  listing_id: string | null;
  title: string;
  price_cents: number | null;
  price_type: "fixed" | "negotiable" | "free" | "on_request" | null;
  listing_type: "offer" | "wanted" | null;
  status: "draft" | "active" | "reserved" | "sold" | "expired" | "removed";
  thumb_path: string | null;
  is_school: boolean;
  i_am_buyer: boolean;
  buyer_id: string | null;
  /** Buyer side: seller or school name; seller side: the buyer's name. */
  peer_name: string | null;
}

/** Author names above messages: not in one-to-one conversations (direct, private listing chat). */
export const showsAuthorNames = (c: Pick<ChatChannel, "kind" | "listing">) =>
  c.kind !== "direct" && !(c.kind === "listing" && !c.listing?.is_school);

/** @mentions only where a group reads along. */
export const mentionsEnabled = (c: Pick<ChatChannel, "kind">) => c.kind !== "direct" && c.kind !== "listing";

/** Training levels a students channel can be limited to (school stages without "licensed"). */
export const STUDENT_LEVELS = ["ground", "altitude", "exam_ready"] as const;

export function channelTitle(channel: Pick<ChatChannel, "kind" | "name" | "event_title"> & { peer?: ChatChannel["peer"] }): string {
  if (channel.kind === "direct") return channel.peer?.pilot_name || "Pilot";
  if (channel.kind === "listing") return channel.name || "";
  return channel.kind === "event" ? channel.event_title || "" : channel.name || "";
}

export function matchesFilter(channel: ChatChannel, filter: InboxFilter): boolean {
  switch (filter) {
    case "direct": return channel.kind === "direct";
    case "market": return channel.kind === "listing";
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
    && (!q || `${channelTitle(c)} ${c.group_name ?? ""} ${c.listing?.peer_name ?? ""}`.toLowerCase().includes(q))));
}

/** Unread messages across channels; archived and muted channels do not count. */
export function totalUnread(channels: ChatChannel[]): number {
  return channels.reduce((sum, c) => sum + (c.archived_at || c.notify_level === "none" ? 0 : c.unread || 0), 0);
}

export function formatUnread(count: number): string {
  return count > 99 ? "99+" : String(count);
}

/** Which filter chips are worth showing (only those with at least one channel). */
export function availableFilters(channels: ChatChannel[]): InboxFilter[] {
  return (["all", "direct", "market", "school", "groups", "events"] as InboxFilter[]).filter((f) => f === "all" || channels.some((c) => matchesFilter(c, f)));
}

type Translate = (key: string, options?: Record<string, unknown>) => string;
/** Short description of who is in a channel, e.g. "Schüler · Grundkurs, Höhenflug". */
export function audienceSummary(channel: Pick<ChatChannel, "kind" | "audience" | "audience_levels">, t: Translate): string {
  if (channel.kind === "event") return t("chat.audience.event");
  if (channel.kind === "direct") return t("chat.audience.direct");
  if (channel.kind === "listing") return t("chat.audience.listing");
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

// ── @mentions ────────────────────────────────────────────────────────────────
export interface MentionCandidate { user_id: string; name: string }

/** The partial name after an "@" right before the cursor, or null when not typing a mention. */
export function mentionQuery(textBeforeCursor: string): string | null {
  const match = textBeforeCursor.match(/(?:^|\s)@([^\s@]*)$/);
  return match ? match[1] : null;
}

export function mentionSuggestions(candidates: MentionCandidate[], query: string, excludeUserId?: string, limit = 5): MentionCandidate[] {
  const q = query.toLowerCase();
  return candidates.filter((c) => c.user_id !== excludeUserId && c.name && c.name.toLowerCase().includes(q)).slice(0, limit);
}

/** Replaces the "@query" before the cursor with "@Full Name " and returns the new text and cursor. */
export function insertMention(text: string, cursor: number, name: string): { text: string; cursor: number } {
  const before = text.slice(0, cursor).replace(/@([^\s@]*)$/, `@${name} `);
  return { text: before + text.slice(cursor), cursor: before.length };
}

/** People whose "@Name" occurs in the text (longest names first, so "@Reto Brunner" beats "@Reto"). */
export function extractMentions(text: string, candidates: MentionCandidate[]): string[] {
  let rest = text;
  const ids: string[] = [];
  for (const c of [...candidates].filter((c) => c.name).sort((a, b) => b.name.length - a.name.length)) {
    const token = `@${c.name}`;
    if (rest.includes(token)) {
      ids.push(c.user_id);
      rest = rest.split(token).join(" ");
    }
  }
  return [...new Set(ids)];
}

/** Splits a message into plain text and @mention parts for highlighting. */
export function splitMentions(text: string, names: string[]): { text: string; mention: boolean }[] {
  const tokens = [...new Set(names.filter(Boolean))].sort((a, b) => b.length - a.length).map((n) => `@${n}`);
  if (tokens.length === 0) return [{ text, mention: false }];
  const escaped = tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return text.split(new RegExp(`(${escaped.join("|")})`, "g")).filter((part) => part !== "")
    .map((part) => ({ text: part, mention: tokens.includes(part) }));
}

/** Initials for an avatar placeholder ("Lea Schmid" → "LS"). */
export function initials(name: string): string {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";
}

// ── Reactions ────────────────────────────────────────────────────────────────
export const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "🙏", "🪂"] as const;
export interface Reaction { message_id: string; user_id: string; emoji: string }

/** Reactions of one message grouped by emoji, in first-use order, with whether I reacted. */
export function groupReactions(reactions: Reaction[], myUserId?: string): { emoji: string; count: number; mine: boolean; userIds: string[] }[] {
  const groups = new Map<string, string[]>();
  for (const r of reactions) groups.set(r.emoji, [...(groups.get(r.emoji) || []), r.user_id]);
  return [...groups.entries()].map(([emoji, userIds]) => ({ emoji, count: userIds.length, mine: !!myUserId && userIds.includes(myUserId), userIds }));
}

/** One-line preview of a replied-to message. */
export function replySnippet(message: string, hasAttachment: boolean, max = 80): string {
  const text = message.replace(/\s+/g, " ").trim();
  if (!text) return hasAttachment ? "📎" : "";
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
