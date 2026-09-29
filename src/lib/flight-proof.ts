/**
 * Flightbook replacement, step 2: proof data of a flight (times, glider, discipline, flight kind)
 * and the change history written by the database (migration 0073, table flight_changes).
 */

export const DISCIPLINES = ["paraglider", "hangglider"] as const;
export type Discipline = (typeof DISCIPLINES)[number];
export const FLIGHT_KINDS = ["practice_slope", "altitude"] as const;
export type FlightKind = (typeof FLIGHT_KINDS)[number];
export type FlightSource = "manual" | "flightbook" | "xcontest" | "school";

export interface GliderLike {
  id: string;
  manufacturer: string;
  model: string;
  size: string | null;
  discipline?: Discipline | null;
  is_tandem?: boolean | null;
}

/** The label a flight stores next to glider_id ("Advance Pi3 (21)"). */
export function gliderLabel(g: Pick<GliderLike, "manufacturer" | "model" | "size">): string {
  return `${g.manufacturer} ${g.model}${g.size ? ` (${g.size})` : ""}`;
}

/**
 * The pilot's glider a free-text label stands for, only when exactly one glider matches
 * (same rule as the backfill in migration 0073: full label or manufacturer + model).
 */
export function findGliderByLabel<T extends GliderLike>(gliders: T[], label: string | null | undefined): T | null {
  const wanted = (label ?? "").trim().toLowerCase();
  if (!wanted) return null;
  const matches = gliders.filter((g) =>
    gliderLabel(g).toLowerCase() === wanted || `${g.manufacturer} ${g.model}`.toLowerCase() === wanted);
  return matches.length === 1 ? matches[0] : null;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** A local wall-clock time ("HH:MM") on a flight date as an ISO timestamp, or null. */
export function localTimeToIso(date: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{1,2}:\d{2}$/.test(time)) return null;
  const [h, m] = time.split(":").map(Number);
  if (h > 23 || m > 59) return null;
  const [y, mo, d] = date.split("-").map(Number);
  return new Date(y, mo - 1, d, h, m).toISOString();
}

/** The local wall-clock time ("HH:MM") of an ISO timestamp, or "" when there is none. */
export function isoToLocalTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Takeoff and landing of an IGC track. IGC times are UTC on the track's (UTC) date; a flight
 * across midnight UTC lands on the next day.
 */
export function igcFlightTimes(date: string | null, startTime: string | null, endTime: string | null):
  { takeoffAt: string; landingAt: string | null } | null {
  if (!date || !startTime || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const start = new Date(`${date}T${startTime}Z`);
  if (Number.isNaN(start.getTime())) return null;
  let landing: Date | null = endTime ? new Date(`${date}T${endTime}Z`) : null;
  if (landing && Number.isNaN(landing.getTime())) landing = null;
  if (landing && landing < start) landing = new Date(landing.getTime() + 24 * 60 * 60 * 1000);
  return { takeoffAt: start.toISOString(), landingAt: landing ? landing.toISOString() : null };
}

/**
 * The times to save: the takeoff from the entered local time, the landing kept only while it is
 * not before the takeoff (the database refuses that; it happens when the pilot moves the takeoff
 * of an imported track).
 */
export function flightTimesForSave(date: string, takeoffTime: string, landingAt: string | null):
  { takeoff_at: string | null; landing_at: string | null } {
  const takeoff = takeoffTime ? localTimeToIso(date, takeoffTime) : null;
  const landing = landingAt && (!takeoff || new Date(landingAt) >= new Date(takeoff)) ? landingAt : null;
  return { takeoff_at: takeoff, landing_at: landing };
}

// ── Change history ──

export type ChangeField =
  | "date" | "takeoff_at" | "landing_at" | "duration_minutes" | "takeoff_location" | "landing_location"
  | "glider" | "discipline" | "is_tandem" | "flight_kind" | "is_solo_shv" | "igc_track";

export interface FlightChange {
  id: number;
  field: ChangeField | string;
  old_value: unknown;
  new_value: unknown;
  changed_by: string | null;
  origin: string;
  changed_at: string;
}

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** A logged value as text for the history list ("—" for none). */
export function formatChangeValue(field: string, value: unknown, t: Translate, locale = "de-CH"): string {
  if (value === null || value === undefined) return "—";
  switch (field) {
    case "date": {
      const d = new Date(`${String(value)}T00:00:00`);
      return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString(locale);
    }
    case "takeoff_at":
    case "landing_at": {
      const d = new Date(String(value));
      return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString(locale, { dateStyle: "short", timeStyle: "short" });
    }
    case "duration_minutes":
      return `${value} min`;
    case "takeoff_location":
    case "landing_location": {
      const v = value as { id?: string; name?: string | null };
      return v.name || t("flightProof.unknownPlace");
    }
    case "glider": {
      const v = value as { id?: string | null; label?: string | null };
      return v.label || "—";
    }
    case "discipline":
      return t(`flightProof.discipline.${String(value)}`);
    case "flight_kind":
      return t(`flightProof.kind.${String(value)}`);
    case "is_tandem":
    case "is_solo_shv":
      return value ? t("flightProof.yes") : t("flightProof.no");
    default:
      return String(value);
  }
}

/** Who made a change: a person's name, or the tool that did it. */
export function changeActor(change: Pick<FlightChange, "changed_by" | "origin">, names: Record<string, string>, t: Translate): string {
  if (change.changed_by) return names[change.changed_by] || t("flightProof.unknownPerson");
  return t(`flightProof.origin.${change.origin}`, { defaultValue: change.origin });
}
