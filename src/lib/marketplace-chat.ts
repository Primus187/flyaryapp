/**
 * Marketplace (plan 4.6): contacting a seller and spotting risky payment requests in listing chats.
 * The hint never blocks sending – it only reminds people not to pay strangers in advance.
 */
import { supabase } from "@/integrations/supabase/client";

// IBAN: country code, 2 check digits, 11–30 more letters/digits, optionally in groups of four.
const IBAN = /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){2,7}(?:[ ]?[A-Z0-9]{1,4})?\b/i;
const PAYMENT_LINK = /\b(?:paypal\.me|paypal\.com\/(?:paypalme|pools|donate)|revolut\.me|wise\.com\/pay|buy\.stripe\.com|pay\.sumup\.com|twint\.ch\/[a-z])/i;
const WESTERN_UNION = /\b(?:western\s*union|moneygram)\b/i;

export type PaymentRisk = "iban" | "payment_link" | "money_transfer";

/** What in a message looks like a request to pay in advance, or null. */
export function paymentRisk(text: string): PaymentRisk | null {
  if (IBAN.test(text.replace(/\u00a0/g, " "))) return "iban"; // non-breaking spaces from copied IBANs
  if (PAYMENT_LINK.test(text)) return "payment_link";
  if (WESTERN_UNION.test(text)) return "money_transfer";
  return null;
}

/**
 * Opens (or reuses) the chat about a listing and returns where to go. A new, still empty chat gets the
 * suggested first question in the composer.
 */
export async function openListingChat(listingId: string, firstQuestion: string): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- function not in generated types.ts yet
  const { data, error } = await supabase.rpc("marketplace_open_chat" as any, { _listing: listingId });
  if (error) throw error;
  const channelId = data as unknown as string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- column not in generated types.ts yet
  const { data: channel } = await supabase.from("chat_channels" as any).select("last_message_at").eq("id", channelId).maybeSingle();
  const empty = !(channel as unknown as { last_message_at: string | null } | null)?.last_message_at;
  return empty ? `/messages/${channelId}?text=${encodeURIComponent(firstQuestion)}` : `/messages/${channelId}`;
}
