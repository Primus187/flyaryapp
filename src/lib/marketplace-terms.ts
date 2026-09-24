/**
 * Marketplace (plan 4.10): the one-time confirmation of the marketplace rules (migration 0041) and the
 * suggested "private sale" clause for descriptions.
 */
import { supabase } from "@/integrations/supabase/client";

/** Raise together with market_terms_accepted() in the database when the rules change. */
export const MARKET_TERMS_VERSION = 1;

export async function hasAcceptedTerms(userId: string): Promise<boolean> {
  const { data } = await supabase
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not in generated types.ts yet
    .from("marketplace_terms_acceptances" as any).select("version").eq("user_id", userId).maybeSingle();
  return ((data as unknown as { version: number } | null)?.version ?? 0) >= MARKET_TERMS_VERSION;
}

export async function acceptTerms(userId: string): Promise<void> {
  const { error } = await supabase
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not in generated types.ts yet
    .from("marketplace_terms_acceptances" as any)
    .upsert({ user_id: userId, version: MARKET_TERMS_VERSION, accepted_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) throw error;
}

/** Appends the clause once (a blank line before it); an already present clause is left alone. */
export function withPrivateSaleClause(description: string, clause: string): string {
  if (description.includes(clause)) return description;
  const text = description.trimEnd();
  return text ? `${text}\n\n${clause}` : clause;
}
