/**
 * Flightbook replacement, step 4: training status against the SHV directives (migration 0075).
 * The evaluation runs in the database (training_status); this module only prepares it for display.
 */

export type RequirementRule =
  | "confirmed_altitude_flights" | "distinct_takeoff_sites" | "distinct_landing_sites" | "confirmed_solo_flights"
  | "confirmed_long_flight_minutes" | "licence_held_years" | "altitude_flights_since_licence"
  | "longest_flight_km_since_licence" | "evidence_within_years" | "evidence_present" | "tandem_flights"
  | "tandem_distinct_takeoff_sites" | "tandem_distinct_landing_sites" | "tandem_distinct_passengers" | "tandem_flights_per_year";

export interface RequirementResult {
  rule: RequirementRule;
  threshold: number;
  value: number | null;
  met: boolean;
  source: string;
  params: Record<string, string>;
}

export interface TrainingStatus {
  discipline: string;
  licence: string;
  requirements: RequirementResult[];
  confirmedWithoutKind: number;
  confirmedPractice: number;
  licenceIssuedAt: string | null;
}

/** Licences with requirements per discipline (tandem stage 3 and its renewal: migration 0076). */
const ALL_LICENCES = ["pilot", "biplace_1", "biplace_3", "biplace_3_renewal"];
export const LICENCES: Record<string, string[]> = { paraglider: ALL_LICENCES, hangglider: ALL_LICENCES };

/** Translation key of a requirement line; repeated rules are told apart by params.label. */
export function requirementLabelKey(r: Pick<RequirementResult, "rule" | "params">): string {
  return `trainingStatus.rule.${r.params?.label ?? r.rule}`;
}

/** Share of the requirement reached, 0..1 (for a progress bar). */
export function progress(r: RequirementResult): number {
  if (r.met) return 1;
  if (r.value == null) return 0;
  // Evidence: the value is its age in years; not met means too old.
  if (r.rule === "evidence_within_years" || r.rule === "evidence_present") return 0;
  return r.threshold > 0 ? Math.max(0, Math.min(1, r.value / r.threshold)) : 0;
}

/** "4 / 50", "59 / 60 min", "51.2 / 50 km"; "—" when it cannot be evaluated (no licence, no evidence). */
export function valueText(r: RequirementResult): string {
  if (r.value == null) return "—";
  const unit = r.rule === "confirmed_long_flight_minutes" ? " min" : r.rule === "longest_flight_km_since_licence" ? " km" : "";
  if (r.rule === "evidence_within_years" || r.rule === "evidence_present") return String(r.value);
  const value = Number.isInteger(r.value) ? String(r.value) : r.value.toFixed(1);
  return `${value} / ${r.threshold}${unit}`;
}

export function allMet(status: TrainingStatus | null | undefined): boolean {
  return !!status && status.requirements.length > 0 && status.requirements.every((r) => r.met);
}
