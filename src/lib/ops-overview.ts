/**
 * Betriebsbereich (/admin, migration 0083): counters for the overview and the rules behind its tiles.
 */
import { supabase } from "@/integrations/supabase/client";

export interface OpsOverview {
  waitlist_open: number;
  errors_open: number;
  errors_new_24h: number;
  market_reports_open: number;
  backup_last_at: string | null;
  backup_last_ok: boolean | null;
  backup_last_success_at: string | null;
  storage_bytes: number;
}

/** Same threshold as check_backup_freshness() in migration 0082. */
export const BACKUP_STALE_HOURS = 48;

export type BackupStatus = "ok" | "failed" | "stale" | "none";

/**
 * none: no backup ever reported · stale: no successful backup for 48 hours · failed: the last run
 * reported errors (an older one succeeded recently) · ok.
 */
export function backupStatus(o: Pick<OpsOverview, "backup_last_at" | "backup_last_ok" | "backup_last_success_at">, now = new Date()): BackupStatus {
  if (!o.backup_last_at) return "none";
  const success = o.backup_last_success_at ? new Date(o.backup_last_success_at).getTime() : null;
  if (success === null || now.getTime() - success > BACKUP_STALE_HOURS * 3600_000) return "stale";
  return o.backup_last_ok === false ? "failed" : "ok";
}

/** Things waiting for the admin; shown as the count next to "Betrieb" under "Mehr". */
export function openItems(o: OpsOverview, now = new Date()): number {
  return o.waitlist_open + o.errors_open + o.market_reports_open + (backupStatus(o, now) === "ok" ? 0 : 1);
}

export async function fetchOpsOverview(): Promise<OpsOverview> {
  const { data, error } = await supabase.rpc("ops_overview");
  if (error) throw error;
  return data as unknown as OpsOverview;
}
