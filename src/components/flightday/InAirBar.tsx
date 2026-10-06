import { useTranslation } from "react-i18next";
import { Plane } from "lucide-react";
import { cn } from "@/lib/utils";
import { airborneMinutes, flightsInAir, landingHintDue, type LandingHintMinutes, type SchoolFlight } from "@/lib/school-flights";

interface Props {
  flights: SchoolFlight[];
  names: Record<string, string>;
  now: Date;
  hintMinutes: LandingHintMinutes;
  /** Tap on a pilot in the air (e.g. the instructor lands the flight). */
  onSelect?: (flight: SchoolFlight) => void;
}

/** Who is in the air right now, longest first; orange once the optional landing hint is due. */
export default function InAirBar({ flights, names, now, hintMinutes, onSelect }: Props) {
  const { t } = useTranslation();
  const inAir = flightsInAir(flights);
  if (inAir.length === 0) return null;
  return (
    <div className="rounded-2xl border border-warning/40 bg-warning-soft px-3.5 py-2.5" role="status" aria-live="polite">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.12em] text-warning-soft-foreground">
        <Plane className="h-3.5 w-3.5" />{t("flightDay.inAir.title", { count: inAir.length })}
      </p>
      <div className="flex flex-wrap gap-2">
        {inAir.map((f) => {
          const due = landingHintDue(f, now, hintMinutes);
          const label = t("flightDay.inAir.entry", { name: names[f.student_user_id] || t("events.pilot"), minutes: airborneMinutes(f, now) ?? 0 });
          return (
            <button key={f.id} type="button" disabled={!onSelect} onClick={() => onSelect?.(f)}
              className={cn("min-h-11 rounded-xl border px-3 text-sm font-bold",
                due ? "border-warning bg-warning text-warning-foreground" : "border-warning/40 bg-card text-foreground")}>
              {label}{due && ` · ${t("flightDay.inAir.hint")}`}
            </button>
          );
        })}
      </div>
    </div>
  );
}
