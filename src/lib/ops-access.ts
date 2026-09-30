/**
 * Betriebsbereich "Zugänge" (migration 0084): accounts with their app access, pausing and the operator log.
 */
import { supabase } from "@/integrations/supabase/client";

export interface AccountRow {
  user_id: string;
  name: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  granted_via: "existing" | "group" | "invite_link" | "admin" | null;
  granted_at: string | null;
  revoked_at: string | null;
  revoke_reason: string | null;
  is_admin: boolean;
  schools: string[];
}

export type AccountStatus = "active" | "paused" | "none";
export type AccountFilter = "all" | AccountStatus;

export const REVOKE_REASON_MAX = 300;

export function accountStatus(row: Pick<AccountRow, "granted_via" | "revoked_at">): AccountStatus {
  if (!row.granted_via) return "none";
  return row.revoked_at ? "paused" : "active";
}

/** Accounts matching the status filter and a search over name, e-mail and schools (case-insensitive). */
export function filterAccounts(rows: AccountRow[], filter: AccountFilter, search: string): AccountRow[] {
  const needle = search.trim().toLowerCase();
  return rows.filter((row) => (filter === "all" || accountStatus(row) === filter)
    && (!needle || [row.name, row.email ?? "", ...row.schools].some((v) => v.toLowerCase().includes(needle))));
}

export function countByStatus(rows: AccountRow[]): Record<AccountFilter, number> {
  const counts: Record<AccountFilter, number> = { all: rows.length, active: 0, paused: 0, none: 0 };
  for (const row of rows) counts[accountStatus(row)]++;
  return counts;
}

/** Trimmed reason, or null when it is empty or too long (the database checks the same). */
export function cleanRevokeReason(reason: string): string | null {
  const clean = reason.trim();
  return clean && clean.length <= REVOKE_REASON_MAX ? clean : null;
}

export type LogAction = "access_granted" | "access_revoked" | "access_restored" | "invite_created" | "invite_revoked";

export interface LogEntry {
  id: string;
  created_at: string;
  action: LogAction;
  detail: { reason?: string; previous_reason?: string | null; name?: string; email?: string };
  actor_name: string | null;
  target_name: string | null;
  group_name: string | null;
}

export async function fetchAccounts(): Promise<AccountRow[]> {
  const { data, error } = await supabase.rpc("ops_access_list");
  if (error) throw error;
  return (data ?? []) as unknown as AccountRow[];
}

export async function fetchLogEntries(limit = 100): Promise<LogEntry[]> {
  const { data, error } = await supabase.rpc("ops_log_entries", { _limit: limit });
  if (error) throw error;
  return (data ?? []) as unknown as LogEntry[];
}

export async function revokeAccess(userId: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc("revoke_app_access", { _user_id: userId, _reason: reason });
  if (error) throw error;
}

export async function restoreAccess(userId: string): Promise<void> {
  const { error } = await supabase.rpc("restore_app_access", { _user_id: userId });
  if (error) throw error;
}

export async function grantAccess(userId: string): Promise<void> {
  const { error } = await supabase.rpc("grant_app_access", { _user_id: userId });
  if (error) throw error;
}

export async function revokeInvite(waitlistId: string): Promise<void> {
  const { error } = await supabase.rpc("revoke_access_invite", { _waitlist_id: waitlistId });
  if (error) throw error;
}
