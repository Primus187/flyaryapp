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

/** The 7 ISO dates (yyyy-mm-dd) of the week starting at `monday`, in local time. */
export function weekDates(monday: Date): string[] {
  return Array.from({ length: 7 }, (_, i) =>
    toIsoDate(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i)),
  );
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
