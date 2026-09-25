/**
 * Marketplace (plan 4.7): the school shop's legal details. The same rules as the CHECK constraints of
 * migration 0037, so the form can say what is missing before the database refuses to activate the shop.
 */
import { supabase } from "@/integrations/supabase/client";

export interface ShopProfile {
  group_id: string;
  legal_name: string;
  street: string;
  postal_code: string;
  locality: string;
  uid_number: string | null;
  vat_registered: boolean;
  email: string;
  phone: string | null;
  warranty_text: string;
  active: boolean;
}

export interface MyShop { group_id: string; name: string; ready: boolean; can_admin: boolean }

export const emptyShopProfile = (groupId: string): ShopProfile => ({
  group_id: groupId, legal_name: "", street: "", postal_code: "", locality: "", uid_number: null, vat_registered: false,
  email: "", phone: null, warranty_text: "", active: false,
});

export type ShopProblem = "legal_name" | "street" | "postal_code" | "locality" | "email" | "warranty_text" | "uid_number";

const UID = /^CHE-\d{3}\.\d{3}\.\d{3}$/;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** "CHE123456789", "che-123 456 789" → "CHE-123.456.789"; anything else stays as typed. */
export function normalizeUid(input: string): string {
  const digits = input.replace(/^\s*che/i, "").replace(/[\s.\-–]/g, "");
  return /^\d{9}$/.test(digits) ? `CHE-${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}` : input.trim();
}

/** Fields that still keep the shop from being activated (a wrongly formatted UID counts even when optional). */
export function shopProblems(p: ShopProfile): ShopProblem[] {
  const problems: ShopProblem[] = [];
  if (!p.legal_name.trim()) problems.push("legal_name");
  if (!p.street.trim()) problems.push("street");
  if (!/^\d{4,5}$/.test(p.postal_code)) problems.push("postal_code");
  if (!p.locality.trim()) problems.push("locality");
  if (!EMAIL.test(p.email.trim())) problems.push("email");
  if (!p.warranty_text.trim()) problems.push("warranty_text");
  if ((p.vat_registered && !p.uid_number) || (p.uid_number && !UID.test(p.uid_number))) problems.push("uid_number");
  return problems;
}

export async function fetchMyShops(): Promise<MyShop[]> {
  const { data, error } = await supabase.rpc("marketplace_my_shops");
  if (error) throw error;
  return (data ?? []) as unknown as MyShop[];
}

export async function fetchShopProfile(groupId: string): Promise<ShopProfile | null> {
  const { data } = await supabase.from("school_shop_profiles").select("*").eq("group_id", groupId).maybeSingle();
  return (data as unknown as ShopProfile | null) ?? null;
}

/** Saves the profile; the database refuses "active" while something is missing. */
export async function saveShopProfile(p: ShopProfile): Promise<void> {
  const row = {
    ...p, legal_name: p.legal_name.trim(), street: p.street.trim(), locality: p.locality.trim(), email: p.email.trim(),
    warranty_text: p.warranty_text.trim(), phone: p.phone?.trim() || null, uid_number: p.uid_number?.trim() ? normalizeUid(p.uid_number) : null,
  };
  const { error } = await supabase.from("school_shop_profiles").upsert(row, { onConflict: "group_id" });
  if (error) throw error;
}
