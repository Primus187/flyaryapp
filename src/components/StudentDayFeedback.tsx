import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { MessageSquare, FileText, Plane } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  eventId: string;
}

interface FeedbackNote {
  flight_number: number | null;
  note: string;
}

/** A released school flight (my_school_flights, migrations 0050/0052/0054). */
interface MyFlight {
  id: string;
  number: number;
  startedAt: string | null;
  landedAt: string | null;
  takeoff: string | null;
  landing: string | null;
  feedback: string | null;
  items: { name: string; rating: 1 | 2 | 3 }[];
}

const ratingClass = { 1: "bg-red-500", 2: "bg-amber-500", 3: "bg-green-600" } as const;

/** The student's feedback of a flying day: the school's flights with rated maneuvers and feedback,
 *  former coaching slots and the day summary. Everything appears once the day is released (E8). */
export default function StudentDayFeedback({ eventId }: Props) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [notes, setNotes] = useState<FeedbackNote[]>([]);
  const [flights, setFlights] = useState<MyFlight[]>([]);
  const [released, setReleased] = useState(true);
  const [loading, setLoading] = useState(true);
  const locale = i18n.language === "fr" ? "fr-CH" : i18n.language === "en" ? "en-GB" : "de-CH";

  useEffect(() => {
    if (!user || !eventId) return;
    const load = async () => {
      const [notesRes, flightsRes, releasedRes] = await Promise.all([
        supabase.from("student_day_notes").select("flight_number, note")
          .eq("event_id", eventId).eq("student_user_id", user.id).eq("visible_to_student", true),
        supabase.rpc("my_school_flights", { _event_id: eventId }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration 0054 not in generated types.ts yet
        (supabase as any).rpc("flight_day_feedback_released", { _event_id: eventId }),
      ]);
      const results = ((notesRes.data || []) as FeedbackNote[]).filter((n) => n.note.trim());
      results.sort((a, b) => (a.flight_number ?? 99) - (b.flight_number ?? 99));
      setNotes(results);
      setFlights(Array.isArray(flightsRes.data) ? (flightsRes.data as unknown as MyFlight[]) : []);
      setReleased(releasedRes.data !== false);
      setLoading(false);
    };
    void load();
  }, [eventId, user]);

  if (loading) return null;
  if (!released) return <p className="text-sm text-muted-foreground">{t("flightDay.student.notYet")}</p>;
  if (notes.length === 0 && flights.length === 0) return null;

  const time = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }) : "");

  return (
    <div className="space-y-2">
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {t("events.yourFeedback")}
      </h2>
      {flights.map((f) => (
        <Card key={f.id} className="border-0 shadow-sm">
          <CardContent className="p-3 space-y-1.5">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Plane className="h-3.5 w-3.5 text-primary" />{t("flightDay.board.flightN", { number: f.number })}
              <span className="text-xs font-normal text-muted-foreground">
                {[f.startedAt && f.landedAt ? `${time(f.startedAt)}–${time(f.landedAt)}` : time(f.landedAt), [f.takeoff, f.landing].filter(Boolean).join(" → ")].filter(Boolean).join(" · ")}
              </span>
            </p>
            {f.items.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {f.items.map((i) => (
                  <span key={i.name} className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]">
                    <span className={cn("h-2 w-2 rounded-full", ratingClass[i.rating])} />{i.name}: {t(`flightDay.sheet.ratings.${i.rating}`)}
                  </span>
                ))}
              </div>
            )}
            {f.feedback && <p className="text-sm whitespace-pre-wrap">{f.feedback}</p>}
          </CardContent>
        </Card>
      ))}
      {notes.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 space-y-2">
            {notes.map((n, i) => (
              <div key={i} className="flex gap-2 items-start">
                {n.flight_number !== null
                  ? <MessageSquare className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                  : <FileText className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />}
                <div>
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase">
                    {n.flight_number !== null
                      ? `${t("events.flightSlot")} ${n.flight_number}`
                      : t("events.summary")}
                  </span>
                  <p className="text-sm whitespace-pre-wrap">{n.note}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
