import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { DaySignup, FlightDayRole } from "@/lib/flight-day";
import DaySitesCard from "./DaySitesCard";
import FlightBoard from "./FlightBoard";
import TakeoffBoard from "./TakeoffBoard";

type Station = "landing" | "takeoff";
const STORAGE_KEY = "flyary-flightday-station";

function storedStation(): Station {
  try { return localStorage.getItem(STORAGE_KEY) === "takeoff" ? "takeoff" : "landing"; } catch { return "landing"; }
}

interface Props {
  eventId: string;
  eventCategory: string | null;
  role: FlightDayRole;
  signups: DaySignup[];
  profiles: Record<string, string>;
}

/** Launch helpers work the take-off; instructors the landing field and can switch to the take-off
 *  view when they are up there themselves (remembered per device). Flugtag-Cockpit 4.4. */
export default function FlightDayStations({ eventId, eventCategory, role, signups, profiles }: Props) {
  const { t } = useTranslation();
  const [station, setStation] = useState<Station>(storedStation);
  const [settingsVersion, setSettingsVersion] = useState(0);

  if (role === "helper") return <TakeoffBoard eventId={eventId} signups={signups} profiles={profiles} />;

  const choose = (next: Station) => {
    setStation(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* private mode: keep it for this visit only */ }
  };

  return (
    <div className="space-y-3">
      <DaySitesCard eventId={eventId} onChanged={() => setSettingsVersion((v) => v + 1)} />
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1" role="radiogroup" aria-label={t("flightDay.view.label")}>
        {(["landing", "takeoff"] as const).map((s) => (
          <button key={s} type="button" role="radio" aria-checked={station === s} onClick={() => choose(s)}
            className={cn("rounded-md py-2 text-sm font-medium", station === s ? "bg-background shadow-sm" : "text-muted-foreground")}>
            {t(`flightDay.view.${s}`)}
          </button>
        ))}
      </div>
      {station === "landing"
        ? <FlightBoard eventId={eventId} eventCategory={eventCategory} signups={signups} profiles={profiles} settingsVersion={settingsVersion} />
        : <TakeoffBoard eventId={eventId} signups={signups} profiles={profiles} settingsVersion={settingsVersion} />}
    </div>
  );
}
