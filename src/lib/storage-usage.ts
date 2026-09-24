/**
 * Marketplace (plan 4.9): storage use against the Supabase Free plan (1 GB). From 700 MB the admin view
 * suggests switching to Pro (decision E7).
 */
import { supabase } from "@/integrations/supabase/client";

export const FREE_PLAN_BYTES = 1024 ** 3;
export const WARN_BYTES = 700 * 1024 ** 2;

export interface StorageUsage { total_bytes: number; buckets: Record<string, number> }

export function formatBytes(bytes: number, locale = "de-CH"): string {
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit++; }
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: unit >= 2 ? 1 : 0 }).format(value)} ${units[unit]}`;
}

/** Share of the Free plan used (0–100, rounded) and whether to warn. */
export function usageLevel(totalBytes: number): { percent: number; warn: boolean } {
  return { percent: Math.min(100, Math.round((totalBytes / FREE_PLAN_BYTES) * 100)), warn: totalBytes >= WARN_BYTES };
}

/** Buckets sorted by size, largest first. */
export const bucketsBySize = (u: StorageUsage) => Object.entries(u.buckets).sort((a, b) => b[1] - a[1]);

export async function fetchStorageUsage(): Promise<StorageUsage> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- function not in generated types.ts yet
  const { data, error } = await supabase.rpc("marketplace_storage_usage" as any);
  if (error) throw error;
  return data as unknown as StorageUsage;
}
