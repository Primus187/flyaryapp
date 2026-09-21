export interface LevelHistoryEntry {
  user_id: string;
  training_level: string;
  changed_at: string;
}

export interface CurrentLevel {
  user_id: string;
  training_level: string | null;
}

/**
 * Training-level distribution as of the end of `year`. Reconstructed from
 * the change history, since profiles.training_level itself has no time
 * dimension. For the current year, a student without any history entry
 * falls back to their live profile value (nothing has changed since "now").
 * For a past year, such a student's level at that point cannot be known
 * and is counted as unresolved instead of guessed.
 */
export function levelCountsAtYearEnd(
  studentIds: string[],
  history: LevelHistoryEntry[],
  current: CurrentLevel[],
  year: number,
  currentYear: number,
): { counts: Record<string, number>; unresolved: number } {
  const yearEnd = `${year + 1}-01-01`;
  const currentMap = new Map(current.map((c) => [c.user_id, c.training_level]));
  const counts: Record<string, number> = {};
  let unresolved = 0;

  studentIds.forEach((id) => {
    const latestBeforeYearEnd = history
      .filter((h) => h.user_id === id && h.changed_at < yearEnd)
      .sort((a, b) => (a.changed_at < b.changed_at ? 1 : -1))[0];
    const level = latestBeforeYearEnd?.training_level ?? (year === currentYear ? currentMap.get(id) ?? null : null);
    if (!level) {
      unresolved += 1;
      return;
    }
    counts[level] = (counts[level] || 0) + 1;
  });

  return { counts, unresolved };
}

/** Distinct students whose level history shows a transition to "licensed" within `year`. */
export function licensedCompletionsInYear(history: LevelHistoryEntry[], year: number): number {
  const start = `${year}-01-01`;
  const end = `${year + 1}-01-01`;
  const ids = new Set(
    history
      .filter((h) => h.training_level?.toLowerCase() === "licensed" && h.changed_at >= start && h.changed_at < end)
      .map((h) => h.user_id),
  );
  return ids.size;
}

/** Distinct licensed completions across the `windowYears` ending in `endYear` (inclusive). */
export function licensedCompletionsInWindow(history: LevelHistoryEntry[], endYear: number, windowYears = 3): number {
  let total = 0;
  for (let year = endYear - windowYears + 1; year <= endYear; year++) {
    total += licensedCompletionsInYear(history, year);
  }
  return total;
}

export type ShvMinimumPerformanceStatus = "ok" | "warning" | "critical";

/** SHV minimum-performance traffic light: at least 3 licensed completions in the last 3 years. */
export function shvMinimumPerformanceStatus(completionsInWindow: number): ShvMinimumPerformanceStatus {
  if (completionsInWindow >= 3) return "ok";
  if (completionsInWindow >= 1) return "warning";
  return "critical";
}
