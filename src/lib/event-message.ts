/**
 * Builds the announcement text for an event (altitude flight day) in the exact
 * layout the flight school communicates today (previously via Telegram).
 */

export interface BriefingTaskLike {
  label: string;
  task_type?: string;
  assigned_user_id: string | null;
  sort_order?: number;
}

interface BuildArgs {
  event: any;
  profiles: Record<string, string>;
  briefingTasks: BriefingTaskLike[];
  maneuverNames?: string[];
  locale: string;
  t: (key: string, opts?: any) => string;
}

export function buildEventMessage({ event, profiles, briefingTasks, maneuverNames = [], locale, t }: BuildArgs): string {
  const d = new Date(event.event_date);
  const dateStr = d.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const timeStr = d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });

  const statusSentence =
    event.status === "confirmed"
      ? t("events.msg.takesPlace")
      : event.status === "cancelled"
        ? t("events.msg.cancelled")
        : t("events.msg.stillOpen");

  const lines: string[] = [];
  lines.push(`${event.title} ${dateStr} ${statusSentence}`.trim());

  // Treffpunkt (multiline: "08:25 Interlaken West")
  const meetingLines = (event.meeting_point || "").split("\n").map((l: string) => l.trim()).filter(Boolean);
  if (meetingLines.length > 0) {
    lines.push("", t("events.meetingPointShort"));
    meetingLines.forEach((l: string) => lines.push(l));
  } else if (event.event_date) {
    lines.push("", t("events.meetingPointShort"), timeStr);
  }

  if (event.departure_info) {
    lines.push("", ...String(event.departure_info).split("\n"));
  }

  if (event.flight_area) {
    lines.push("", t("events.flightArea"), event.flight_area);
  }

  if (event.day_topic) {
    lines.push("", t("events.dayTopic"), event.day_topic);
  }

  const tasks = [...briefingTasks].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  if (tasks.length > 0) {
    lines.push("", t("events.briefingShort"));
    tasks.forEach((task) => {
      const name = task.assigned_user_id ? profiles[task.assigned_user_id] || "?" : "—";
      lines.push(`${task.label} -> ${name}`);
    });
  }

  if (maneuverNames.length > 0) {
    lines.push("", t("events.plannedManeuvers"));
    maneuverNames.forEach((m) => lines.push(`• ${m}`));
  }

  if (event.flight_prep_notes) {
    lines.push("", t("events.flightPrep"), ...String(event.flight_prep_notes).split("\n"));
  }

  if (event.description) {
    lines.push("", t("events.msg.regards"), ...String(event.description).split("\n"));
  }

  return lines.join("\n").trim();
}

export const DEFAULT_BRIEFING_LABELS = ["meteo", "flight_area", "day_topic"] as const;

export const DEFAULT_FLIGHT_PREP_DE = `1. DABS anschauen! https://www.skybriefing.com/dabs
2. Wetter -> von der Grosswetterlage zu lokalen 'Delikatessen'
3. Nowcasting für unseren Flugtag: Müssen wir etwas im Auge behalten? Offensichtliche Gefahren?
4. Fluggebiet:
   - SHV Tafel
   - Karte LP (Burnair)`;
