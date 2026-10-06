import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  announce, armAudio, firstName, inAirIds, soundEnabled, storeSoundEnabled, takeoffsToAnnounce, type AnnouncedFlight,
} from "@/lib/takeoff-announcer";

interface Props {
  flights: AnnouncedFlight[];
  names: Record<string, string>;
  /** The flights are loaded: the first loaded list is the starting point, not news. */
  ready: boolean;
}

const SPEECH_LANG: Record<string, string> = { de: "de-DE", fr: "fr-FR", en: "en-GB" };

/** Signal and spoken "Sandra gestartet" for every new take-off of the day, with its on/off switch
 *  (remembered per device). The device that records the take-off announces it too. */
export default function TakeoffAnnouncer({ flights, names, ready }: Props) {
  const { t, i18n } = useTranslation();
  const [enabled, setEnabled] = useState(soundEnabled);
  const known = useRef<Set<string> | null>(null);
  const lang = SPEECH_LANG[i18n.language] ?? "de-DE";

  useEffect(() => (enabled ? armAudio() : undefined), [enabled]);

  useEffect(() => {
    if (!ready) return;
    const fresh = takeoffsToAnnounce(known.current, flights);
    known.current = inAirIds(flights);
    if (!enabled || fresh.length === 0) return;
    announce(fresh.map((f) => t("flightDay.announce.takeoff", { name: firstName(names[f.student_user_id]) || t("events.pilot") })), lang);
  }, [flights, ready]); // eslint-disable-line react-hooks/exhaustive-deps -- only a new list of flights is news

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    storeSoundEnabled(next);
    // The tap itself unlocks sound in the browser; the signal confirms that it is on.
    if (next) announce([], lang);
  };

  return (
    <Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0" aria-pressed={enabled}
      aria-label={t(enabled ? "flightDay.announce.on" : "flightDay.announce.off")} onClick={toggle}>
      {enabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
    </Button>
  );
}
