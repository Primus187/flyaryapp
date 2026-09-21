export type AvailabilityStatus = "available" | "unsure" | "unavailable";

const CYCLE: (AvailabilityStatus | null)[] = ["available", "unsure", "unavailable", null];

/** Cycles a status through available -> unsure -> unavailable -> (cleared) -> available. */
export function nextAvailabilityStatus(current: AvailabilityStatus | null): AvailabilityStatus | null {
  const index = CYCLE.indexOf(current);
  return CYCLE[(index + 1) % CYCLE.length];
}

/** Monday of the week containing `date`, as a Date at local midnight. */
export function startOfWeek(date: Date): Date {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate() + diff);
  return monday;
}

const toIsoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Parses a yyyy-mm-dd string as a local-midnight Date (avoids UTC-parsing day-shift). */
export function parseIsoDateLocal(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** The 7 ISO dates (yyyy-mm-dd) of the week starting at `monday`, in local time. */
export function weekDates(monday: Date): string[] {
  return Array.from({ length: 7 }, (_, i) =>
    toIsoDate(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i)),
  );
}

/**
 * Finds up to `limit` dates after `afterDate` (exclusive) with at least one available team
 * member, scanning at most `maxScanDays` days forward. Not necessarily consecutive days.
 */
export function suggestAlternativeDates(
  afterDate: string,
  availableUserIdsByDate: Record<string, string[]>,
  limit = 3,
  maxScanDays = 21,
): string[] {
  const start = parseIsoDateLocal(afterDate);
  const results: string[] = [];
  for (let i = 1; i <= maxScanDays && results.length < limit; i++) {
    const iso = toIsoDate(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
    if ((availableUserIdsByDate[iso] || []).length > 0) results.push(iso);
  }
  return results;
}

const ORDER: Record<AvailabilityStatus | "none", number> = { available: 0, unsure: 1, none: 2, unavailable: 3 };

/** Stable sort: available first, then unsure/unset, then unavailable last. */
export function sortByAvailability<T>(people: T[], statusOf: (p: T) => AvailabilityStatus | null): T[] {
  return people
    .map((p, index) => ({ p, index }))
    .sort((a, b) => {
      const rankA = ORDER[statusOf(a.p) ?? "none"];
      const rankB = ORDER[statusOf(b.p) ?? "none"];
      return rankA !== rankB ? rankA - rankB : a.index - b.index;
    })
    .map(({ p }) => p);
}

/** Whether at least one of the given people is available for the date and holds a valid instructor cert. */
export function hasCertifiedAvailableInstructor(
  instructorUserIds: string[],
  availabilityForDate: Record<string, AvailabilityStatus | null>,
  hasValidCert: (userId: string) => boolean,
): boolean {
  return instructorUserIds.some((id) => availabilityForDate[id] === "available" && hasValidCert(id));
}
