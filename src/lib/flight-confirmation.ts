/**
 * Flightbook replacement, step 3: confirmation of training flights by instructors (migration 0074).
 * The database decides who may confirm; this module only shapes data for the screens.
 */

export type ConfirmationStatus = "submitted" | "confirmed" | "returned" | "revoked" | "withdrawn";

export interface FlightConfirmation {
  flight_id: string;
  status: ConfirmationStatus;
  school_name: string;
  group_id: string | null;
  instructor_name: string | null;
  reason: string | null;
  submitted_at: string;
  decided_at: string | null;
}

export interface SkippedFlight { id: string; reason: string }
export interface BatchResult { submitted?: number; confirmed?: number; skipped: SkippedFlight[] }

/** A flight can (again) be submitted unless it is open or confirmed. */
export function canSubmit(status: ConfirmationStatus | null | undefined): boolean {
  return !status || status === "returned" || status === "revoked" || status === "withdrawn";
}

/** Skip reasons of a batch, counted: [["not_qualified", 2], ...] in a stable order. */
export function skippedSummary(skipped: SkippedFlight[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const s of skipped) counts.set(s.reason, (counts.get(s.reason) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

/** The database error when a confirmed flight is deleted (trigger of migration 0074). */
export function isConfirmedDeleteError(error: { message?: string } | null | undefined): boolean {
  return !!error?.message && /cancel them instead/i.test(error.message);
}

export interface SchoolConfirmationRow {
  flightId: string;
  studentId: string;
  studentName: string | null;
  status: ConfirmationStatus;
  submittedAt: string;
  decidedAt: string | null;
  instructorName: string | null;
  canConfirm: boolean;
  changedAfterConfirmation: boolean;
  cancelled: boolean;
  flight: {
    flightNo: number;
    date: string;
    durationMinutes: number | null;
    takeoff: { name: string | null; altitude: number | null } | null;
    landing: { name: string | null; altitude: number | null } | null;
    glider: string | null;
    discipline: string | null;
    isTandem: boolean;
    flightKind: string | null;
    isSoloShv: boolean;
    source: string | null;
  } | null;
}

export interface StudentGroup { studentId: string; studentName: string; rows: SchoolConfirmationRow[] }

/** The school's list grouped by student (order kept from the database: name, date, number). */
export function groupByStudent(rows: SchoolConfirmationRow[], unknownName: string): StudentGroup[] {
  const groups = new Map<string, StudentGroup>();
  for (const row of rows) {
    const g = groups.get(row.studentId) ?? { studentId: row.studentId, studentName: row.studentName || unknownName, rows: [] };
    g.rows.push(row);
    groups.set(row.studentId, g);
  }
  return [...groups.values()];
}

/** Flights of the selection the viewer may confirm (the others would only be skipped). */
export function confirmableIds(rows: SchoolConfirmationRow[], selected: Set<string>): string[] {
  return rows.filter((r) => selected.has(r.flightId) && r.canConfirm && !r.cancelled).map((r) => r.flightId);
}
