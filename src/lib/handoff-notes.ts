export interface DayNoteRow {
  event_id: string;
  student_user_id: string;
  flight_number: number | null;
  note: string;
  is_next_step: boolean;
}

/**
 * The current "next step" handoff note per student: the summary note (flight_number null)
 * flagged is_next_step, from the most recent underlying event by date. Older flagged notes
 * are superseded, not deleted - callers still have the full history via student_day_notes.
 */
export function latestNextStepPerStudent(
  notes: DayNoteRow[],
  eventDateById: Record<string, string>,
): Record<string, string> {
  const candidates: Record<string, { date: string; note: string }> = {};
  notes.forEach((n) => {
    if (n.flight_number !== null || !n.is_next_step || !n.note.trim()) return;
    const date = eventDateById[n.event_id];
    if (!date) return;
    const existing = candidates[n.student_user_id];
    if (!existing || date > existing.date) candidates[n.student_user_id] = { date, note: n.note };
  });
  return Object.fromEntries(Object.entries(candidates).map(([id, v]) => [id, v.note]));
}
