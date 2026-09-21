import type { LevelHistoryEntry } from "./annual-report";
import type { StudentStatus } from "./student-status";

export interface EventCapacityInfo {
  eventId: string;
  category: string;
  maxParticipants: number | null;
  confirmedSignups: number;
}

/** Average signup/capacity ratio per event category (0-100%), among events with a set capacity. */
export function utilizationByCategory(events: EventCapacityInfo[]): Record<string, number> {
  const sums: Record<string, { total: number; count: number }> = {};
  events.forEach((e) => {
    if (!e.maxParticipants || e.maxParticipants <= 0) return;
    const ratio = Math.min(e.confirmedSignups / e.maxParticipants, 1);
    if (!sums[e.category]) sums[e.category] = { total: 0, count: 0 };
    sums[e.category].total += ratio;
    sums[e.category].count += 1;
  });
  const result: Record<string, number> = {};
  Object.entries(sums).forEach(([category, { total, count }]) => {
    result[category] = Math.round((total / count) * 100);
  });
  return result;
}

export interface InstructorAssignment {
  eventId: string;
  userId: string;
}

export interface Signup {
  eventId: string;
  userId: string;
}

/** Distinct student count per instructor, across the events they were assigned to. */
export function studentsPerInstructor(assignments: InstructorAssignment[], signups: Signup[]): Record<string, number> {
  const eventIdsByInstructor: Record<string, Set<string>> = {};
  assignments.forEach((a) => {
    if (!eventIdsByInstructor[a.userId]) eventIdsByInstructor[a.userId] = new Set();
    eventIdsByInstructor[a.userId].add(a.eventId);
  });
  const studentIdsByEvent: Record<string, Set<string>> = {};
  signups.forEach((s) => {
    if (!studentIdsByEvent[s.eventId]) studentIdsByEvent[s.eventId] = new Set();
    studentIdsByEvent[s.eventId].add(s.userId);
  });
  const result: Record<string, number> = {};
  Object.entries(eventIdsByInstructor).forEach(([instructorId, eventIds]) => {
    const students = new Set<string>();
    eventIds.forEach((eventId) => {
      (studentIdsByEvent[eventId] || new Set()).forEach((studentId) => students.add(studentId));
    });
    result[instructorId] = students.size;
  });
  return result;
}

export interface SuccessRateResult {
  consideredCount: number;
  licensedCount: number;
  cancelledCount: number;
  rate: number | null;
}

/**
 * Success rate (share reaching "licensed"), among students who have any recorded level history
 * (i.e. started training) and whose latest status is NOT "cancelled" - dropouts are excluded from
 * the denominator entirely instead of counting as failures, per the acceptance criterion.
 */
export function successRate(
  studentIds: string[],
  history: LevelHistoryEntry[],
  latestStatus: Record<string, StudentStatus>,
): SuccessRateResult {
  const startedIds = studentIds.filter((id) => history.some((h) => h.user_id === id));
  const consideredIds = startedIds.filter((id) => latestStatus[id] !== "cancelled");
  const licensedIds = consideredIds.filter((id) => history.some((h) => h.user_id === id && h.training_level?.toLowerCase() === "licensed"));
  return {
    consideredCount: consideredIds.length,
    licensedCount: licensedIds.length,
    cancelledCount: startedIds.length - consideredIds.length,
    rate: consideredIds.length > 0 ? Math.round((licensedIds.length / consideredIds.length) * 100) : null,
  };
}

/**
 * Average days from a student's earliest recorded level-history entry to their "licensed" entry,
 * across students who reached it. Uses the earliest history entry rather than a specific
 * vocabulary value (e.g. "grundkurs") as the start, since training_level vocabulary differs
 * between groups (see annual-report.ts / plan Abschnitt 14).
 */
export function averageTrainingDurationDays(history: LevelHistoryEntry[]): number | null {
  const byStudent: Record<string, LevelHistoryEntry[]> = {};
  history.forEach((h) => {
    if (!byStudent[h.user_id]) byStudent[h.user_id] = [];
    byStudent[h.user_id].push(h);
  });
  const durations: number[] = [];
  Object.values(byStudent).forEach((entries) => {
    const sorted = [...entries].sort((a, b) => (a.changed_at < b.changed_at ? -1 : 1));
    const licensedEntry = sorted.find((e) => e.training_level?.toLowerCase() === "licensed");
    if (!licensedEntry) return;
    const days = (new Date(licensedEntry.changed_at).getTime() - new Date(sorted[0].changed_at).getTime()) / 86400000;
    if (days >= 0) durations.push(days);
  });
  if (durations.length === 0) return null;
  return Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
}
