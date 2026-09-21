export type StudentStatus = "active" | "paused" | "cancelled";

export function normalizeStudentStatus(value: unknown): StudentStatus {
  if (value === "paused" || value === "cancelled") return value;
  return "active";
}

export interface StatusHistoryRow {
  student_id: string;
  status: unknown;
  reason: string | null;
  changed_at: string | null;
}

export interface StudentStatusEntry {
  status: StudentStatus;
  reason: string | null;
  changed_at: string | null;
}

/**
 * Latest status per student from a change-history result set. Expects rows ordered
 * newest-first (changed_at desc); the first row seen per student wins.
 */
export function latestStatusPerStudent(rows: StatusHistoryRow[]): Record<string, StudentStatusEntry> {
  const latest: Record<string, StudentStatusEntry> = {};
  rows.forEach((row) => {
    if (!row.student_id || latest[row.student_id]) return;
    latest[row.student_id] = {
      status: normalizeStudentStatus(row.status),
      reason: row.reason ?? null,
      changed_at: row.changed_at ?? null,
    };
  });
  return latest;
}
