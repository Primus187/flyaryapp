/**
 * Marketplace (plan 4.8): reporting listings and the moderation queue (migration 0038).
 * Who may moderate what is decided in the database; the app only shows what the RPCs allow.
 */
import { supabase } from "@/integrations/supabase/client";
import type { ListingStatus } from "./marketplace";

export const REPORT_REASONS = ["scam", "unsafe", "wrong_category", "offensive", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export type ModerationAction = "hide" | "restore" | "dismiss";

export interface QueueItem {
  listing_id: string;
  title: string;
  status: ListingStatus;
  removed_reason: string | null;
  is_school: boolean;
  seller_id: string | null;
  seller_name: string | null;
  open_reports: number;
  reasons: ReportReason[];
  notes: string[];
  first_reported_at: string;
  seller_banned: boolean;
}

/** Ban durations offered to admins; null = until lifted. */
export const BAN_DAYS = [7, 30, null] as const;

export const banUntil = (days: number | null, now: Date = new Date()): string | null =>
  days === null ? null : new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();

/** Oldest first; hidden listings (waiting for a decision) before the rest of the same age. */
export function sortQueue(items: readonly QueueItem[]): QueueItem[] {
  return [...items].sort((a, b) =>
    Number(b.status === "removed") - Number(a.status === "removed") || a.first_reported_at.localeCompare(b.first_reported_at));
}

async function call(fn: string, args: Record<string, unknown>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- functions not in generated types.ts yet
  const { data, error } = await supabase.rpc(fn as any, args);
  if (error) throw error;
  return data as unknown;
}

export const reportListing = (listingId: string, reason: ReportReason, note: string) =>
  call("marketplace_report", { _listing: listingId, _reason: reason, _note: note.trim() || null });

export const moderateListing = (listingId: string, action: ModerationAction, reason?: string) =>
  call("marketplace_moderate", { _listing: listingId, _action: action, _reason: reason?.trim() || null });

export const setBan = (userId: string, banned: boolean, days: number | null = null, reason?: string) =>
  call("marketplace_set_ban", { _user: userId, _banned: banned, _until: banned ? banUntil(days) : null, _reason: reason?.trim() || null });

export async function fetchModerationQueue(): Promise<QueueItem[]> {
  return sortQueue(((await call("marketplace_moderation_queue", {})) ?? []) as QueueItem[]);
}

export async function isMarketModerator(userId: string): Promise<boolean> {
  return (await call("is_market_moderator", { _uid: userId })) === true;
}
