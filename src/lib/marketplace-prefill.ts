/**
 * Marketplace (plan 6.3): fill a listing from one's own wing ("pilot_gliders") and suggest the flight hours
 * from the logbook. Flights store the wing as free text ("Advance Alpha 7 (26)" from the flight form, or
 * whatever an IGC file says), so the match is approximate; the listing marks such hours as
 * "laut Flyary-Flugbuch" (attribute hours_from_logbook) until the seller changes the number.
 */
import { supabase } from "@/integrations/supabase/client";

export interface OwnGlider { id: string; manufacturer: string; model: string; size: string | null; is_default: boolean }
export interface FlightGliderRow { glider: string | null; duration_minutes: number | null }

/** "Advance Alpha 7 (26)" – the label the flight form writes into flights.glider. */
export const gliderLabel = (g: Pick<OwnGlider, "manufacturer" | "model" | "size">) =>
  `${g.manufacturer} ${g.model}${g.size ? ` (${g.size})` : ""}`;

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "");

/**
 * Whether a flight was flown with this wing: manufacturer and model must appear; if both the flight and the wing
 * name a size in brackets, it must be the same size (two sizes of one model are different wings).
 */
export function flownWith(flightGlider: string | null, g: Pick<OwnGlider, "manufacturer" | "model" | "size">): boolean {
  if (!flightGlider) return false;
  const text = norm(flightGlider);
  if (!text.includes(norm(g.model)) || !text.includes(norm(g.manufacturer))) return false;
  const flightSize = /\(([^)]+)\)\s*$/.exec(flightGlider)?.[1];
  return !(g.size && flightSize && norm(flightSize) !== norm(g.size));
}

/** Whole hours flown with the wing (rounded), 0 when none. */
export function logbookHours(flights: readonly FlightGliderRow[], g: Pick<OwnGlider, "manufacturer" | "model" | "size">): number {
  const minutes = flights.filter((f) => flownWith(f.glider, g)).reduce((sum, f) => sum + (f.duration_minutes ?? 0), 0);
  return Math.round(minutes / 60);
}

export interface GliderPrefill {
  category: "glider";
  title: string;
  manufacturer: string;
  model: string;
  size: string;
  attributes: Record<string, unknown>;
}

/** What the form takes over from a wing; flight hours only when the logbook has any. */
export function prefillFromGlider(g: OwnGlider, flights: readonly FlightGliderRow[]): GliderPrefill {
  const hours = logbookHours(flights, g);
  return {
    category: "glider", title: gliderLabel(g).slice(0, 80), manufacturer: g.manufacturer, model: g.model, size: g.size ?? "",
    attributes: hours > 0 ? { flight_hours: hours, hours_from_logbook: true } : {},
  };
}

export async function fetchOwnGear(userId: string): Promise<{ gliders: OwnGlider[]; flights: FlightGliderRow[] }> {
  const [g, f] = await Promise.all([
    supabase.from("pilot_gliders").select("id, manufacturer, model, size, is_default").eq("user_id", userId).order("is_default", { ascending: false }),
    supabase.from("flights").select("glider, duration_minutes").eq("user_id", userId).not("glider", "is", null),
  ]);
  return { gliders: (g.data ?? []) as OwnGlider[], flights: (f.data ?? []) as FlightGliderRow[] };
}
