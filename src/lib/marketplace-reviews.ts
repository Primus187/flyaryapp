import { supabase } from "@/integrations/supabase/client";

/** Plan 8.1: reviews after a sale. `of_seller`: the buyer reviews the seller; `of_buyer`: the selling side reviews the buyer. */
export type ReviewDirection = "of_seller" | "of_buyer";

export interface ChatBuyer { user_id: string; pilot_name: string }
export interface Review {
  id: string;
  rating: number;
  comment: string | null;
  direction: ReviewDirection;
  listing_title: string;
  created_at: string;
  hidden: boolean;
  reported: boolean;
  reviewer_name: string;
}
export interface ReportedReview { id: string; rating: number; comment: string | null; listing_title: string; reported_at: string }

export const MAX_REVIEW_COMMENT = 500;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- functions not in generated types.ts yet
const rpc = (name: string, args?: Record<string, unknown>) => supabase.rpc(name as any, args);

async function call<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await rpc(name, args);
  if (error) throw error;
  return data as T;
}

/** People who asked about the listing in a chat – the seller picks the buyer from them. */
export const fetchChatBuyers = (listingId: string) => call<ChatBuyer[] | null>("marketplace_chat_buyers", { _listing: listingId }).then((d) => d ?? []);
export const markSoldTo = (listingId: string, buyerId: string) => call<unknown>("marketplace_mark_sold_to", { _listing: listingId, _buyer: buyerId });

/** What the viewer may still review on this listing, or null. */
export const fetchReviewState = (listingId: string) => call<ReviewDirection | null>("marketplace_review_state", { _listing: listingId });
export const submitReview = (listingId: string, rating: number, comment: string) =>
  call<string>("marketplace_review", { _listing: listingId, _rating: rating, _comment: comment.trim() || null });

export const fetchReviewsOf = (seller: { userId?: string | null; groupId?: string | null }) =>
  call<Review[] | null>("marketplace_reviews_of", { _user: seller.userId ?? null, _group: seller.groupId ?? null }).then((d) => d ?? []);
export const reportReview = (reviewId: string) => call<void>("marketplace_report_review", { _review: reviewId });
export const fetchReportedReviews = () => call<ReportedReview[] | null>("marketplace_reported_reviews").then((d) => d ?? []);
export const moderateReview = (reviewId: string, hide: boolean) => call<void>("marketplace_moderate_review", { _review: reviewId, _hide: hide });

/** "4.5 (12)" – null without reviews. */
export function ratingSummary(avg: number | string | null | undefined, count: number | null | undefined, language: string): string | null {
  if (!count || avg === null || avg === undefined) return null;
  const value = new Intl.NumberFormat(language, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Number(avg));
  return `${value} (${count})`;
}

/** Fill of the five stars for an average: 1 full, 0.5 half, 0 empty (rounded to halves). */
export function starFills(avg: number): number[] {
  const halves = Math.round(Math.min(5, Math.max(0, avg)) * 2) / 2;
  return [1, 2, 3, 4, 5].map((i) => (halves >= i ? 1 : halves >= i - 0.5 ? 0.5 : 0));
}
