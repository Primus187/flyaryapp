/** Closing a flying day (flight_day_close_preview / close_flight_day, migration 0055). */
export interface ClosePreview {
  closedAt: string | null;
  closedBy: string | null;
  inAir: { flightId: string; studentId: string }[];
  expected: string[];
  missingTakeoff: number;
  defaultTakeoff: string | null;
  summaries: { studentId: string; hasSummary: boolean; feedback: string[] }[];
  loans: { id: string; userId: string; equipment: string; inventoryNumber: string | null; assignedOn: string }[];
  creditRate: number;
  rentalRate: number;
  credits: { userId: string; booked: boolean }[];
  rentals: { userId: string; hasLoan: boolean; booked: boolean }[];
}

export interface CloseSelection {
  credits: string[];
  rentals: string[];
  returns: string[];
}

/** Preselected: credits not yet booked; rental only with a loan that day and not yet booked
 *  (decision 2026-09-25); no returns (the instructor ticks what came back). */
export function defaultSelection(preview: ClosePreview): CloseSelection {
  return {
    credits: preview.credits.filter((c) => !c.booked).map((c) => c.userId),
    rentals: preview.rentals.filter((r) => r.hasLoan && !r.booked).map((r) => r.userId),
    returns: [],
  };
}

/** Amounts that closing would book with this selection (already booked ones are skipped). */
export function bookingTotals(preview: ClosePreview, selection: CloseSelection) {
  // A rate of 0 books nothing (as on the server).
  const credits = preview.creditRate > 0 ? preview.credits.filter((c) => !c.booked && selection.credits.includes(c.userId)).length : 0;
  const rentals = preview.rentalRate > 0 ? preview.rentals.filter((r) => !r.booked && selection.rentals.includes(r.userId)).length : 0;
  return { credits, rentals, creditAmount: credits * preview.creditRate, rentalAmount: rentals * preview.rentalRate };
}

/** A summary suggestion from the day's feedback per flight ("F1: …"), one line per flight. */
export function summarySuggestion(feedback: string[]): string {
  return feedback.map((text, i) => `F${i + 1}: ${text.trim()}`).join("\n");
}

/** What is still open before closing; in-air flights block closing, the rest is a hint. */
export function closeChecklist(preview: ClosePreview) {
  return {
    inAir: preview.inAir.length,
    expected: preview.expected.length,
    missingTakeoff: preview.missingTakeoff,
    missingSummaries: preview.summaries.filter((s) => !s.hasSummary).length,
    canClose: preview.inAir.length === 0,
  };
}

export const toggleId = (ids: string[], id: string) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
