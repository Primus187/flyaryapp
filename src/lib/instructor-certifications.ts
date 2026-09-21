import { addDays, format, parseISO, subYears } from "date-fns";

export const MIN_TEACHING_DAYS = 15;

export function certificationExpiry(validUntil: string | null, now = new Date()) {
  if (!validUntil) return "none";
  if (validUntil < format(now, "yyyy-MM-dd")) return "expired";
  if (validUntil <= format(addDays(now, 90), "yyyy-MM-dd")) return "soon";
  return "valid";
}

export function teachingWindowStart(issuedAt: string | null, now = new Date()) {
  if (!issuedAt) return null;
  const threeYearsAgo = format(subYears(now, 3), "yyyy-MM-dd");
  return issuedAt > threeYearsAgo ? issuedAt : threeYearsAgo;
}

export function countTeachingDays(issuedAt: string | null, dates: string[], now = new Date()) {
  const start = teachingWindowStart(issuedAt, now);
  if (!start) return null;
  const today = format(now, "yyyy-MM-dd");
  return new Set(dates.filter((date) => parseISO(date).getTime() <= now.getTime())
    .map((date) => format(parseISO(date), "yyyy-MM-dd"))
    .filter((day) => day >= start && day <= today)).size;
}
