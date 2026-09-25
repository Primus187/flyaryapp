import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { MessageSquare, FileText } from "lucide-react";

interface Props {
  eventId: string;
}

interface FeedbackNote {
  flight_number: number | null;
  note: string;
}

export default function StudentDayFeedback({ eventId }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [notes, setNotes] = useState<FeedbackNote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !eventId) return;
    const fetch = async () => {
      const { data } = await supabase
        .from("student_day_notes")
        .select("flight_number, note")
        .eq("event_id", eventId)
        .eq("student_user_id", user.id)
        .eq("visible_to_student", true);

      const results = (data as any[] || []).map((d: any) => ({
        flight_number: d.flight_number,
        note: d.note,
      }));
      results.sort((a: FeedbackNote, b: FeedbackNote) => (a.flight_number ?? 99) - (b.flight_number ?? 99));
      setNotes(results);
      setLoading(false);
    };
    fetch();
  }, [eventId, user]);

  if (loading || notes.length === 0) return null;

  return (
    <div className="space-y-2">
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {t("events.yourFeedback")}
      </h2>
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
                <p className="text-sm">{n.note}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
