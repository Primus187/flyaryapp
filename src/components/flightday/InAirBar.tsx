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
    <div className="rounded-lg border border-sky-500/40 bg-sky-50 px-3 py-2 dark:bg-sky-950/30" role="status" aria-live="polite">
      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-sky-700 dark:text-sky-300">
        <Plane className="h-3.5 w-3.5" />{t("flightDay.inAir.title", { count: inAir.length })}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {inAir.map((f) => {
          const due = landingHintDue(f, now, hintMinutes);
          const label = t("flightDay.inAir.entry", { name: names[f.student_user_id] || t("events.pilot"), minutes: airborneMinutes(f, now) ?? 0 });
          return (
            <button key={f.id} type="button" disabled={!onSelect} onClick={() => onSelect?.(f)}
              className={cn("rounded-full border px-3 py-1.5 text-xs font-medium",
                due ? "border-orange-500 bg-orange-500 text-white" : "border-sky-500/50 bg-background")}>
              {label}{due && ` · ${t("flightDay.inAir.hint")}`}
            </button>
          );
        })}
      </div>
    </div>
  );
}
