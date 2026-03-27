import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Eye, EyeOff, Plane, Loader2, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface Props {
  eventId: string;
  eventDate: string;
  groupId: string;
}

interface DayNote {
  id?: string;
  flight_number: number | null;
  note: string;
  visible_to_student: boolean;
  dirty?: boolean;
  carryOver?: boolean;
}

interface StudentCard {
  user_id: string;
  pilot_name: string;
  flight_count: number;
  notes: DayNote[]; // flight_number 1-6 + null (summary)
}

export default function CoachDayView({ eventId, eventDate, groupId }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [students, setStudents] = useState<StudentCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) return;

    // Get group members (students = non-admin members)
    const { data: members } = await supabase
      .from("group_members")
      .select("user_id, role")
      .eq("group_id", groupId);
    if (!members || members.length === 0) { setLoading(false); return; }

    const studentIds = members.filter(m => m.role === "member").map(m => m.user_id);
    if (studentIds.length === 0) { setLoading(false); return; }

    // Parallel: profiles, flights count per student, existing notes
    const dateStr = new Date(eventDate).toISOString().split("T")[0];

    const [profilesRes, flightsRes, notesRes] = await Promise.all([
      supabase.from("profiles").select("user_id, pilot_name").in("user_id", studentIds),
      supabase.from("flights").select("user_id").in("user_id", studentIds).eq("date", dateStr),
      supabase.from("student_day_notes" as any).select("*").eq("event_id", eventId),
    ]);

    const profileMap: Record<string, string> = {};
    profilesRes.data?.forEach(p => { profileMap[p.user_id] = p.pilot_name || "?"; });

    const flightCountMap: Record<string, number> = {};
    (flightsRes.data || []).forEach(f => {
      flightCountMap[f.user_id] = (flightCountMap[f.user_id] || 0) + 1;
    });

    const existingNotes = (notesRes.data as any[] || []);

    // For students without a summary, try to carry over from previous event
    const studentsNeedingCarryOver = studentIds.filter(sid =>
      !existingNotes.some((n: any) => n.student_user_id === sid && n.flight_number === null)
    );

    let carryOverMap: Record<string, string> = {};
    if (studentsNeedingCarryOver.length > 0) {
      // Find the most recent previous event in same group
      const { data: prevEvents } = await supabase
        .from("flight_events")
        .select("id")
        .eq("group_id", groupId)
        .lt("event_date", eventDate)
        .order("event_date", { ascending: false })
        .limit(1);

      if (prevEvents && prevEvents.length > 0) {
        const { data: prevNotes } = await supabase
          .from("student_day_notes" as any)
          .select("student_user_id, note")
          .eq("event_id", prevEvents[0].id)
          .is("flight_number", null)
          .in("student_user_id", studentsNeedingCarryOver);

        (prevNotes as any[] || []).forEach((n: any) => {
          carryOverMap[n.student_user_id] = n.note;
        });
      }
    }

    // Build student cards
    const cards: StudentCard[] = studentIds.map(uid => {
      const studentNotes = existingNotes.filter((n: any) => n.student_user_id === uid);
      const notes: DayNote[] = [];

      // Slots 1-6
      for (let i = 1; i <= 6; i++) {
        const existing = studentNotes.find((n: any) => n.flight_number === i);
        notes.push({
          id: existing?.id,
          flight_number: i,
          note: existing?.note || "",
          visible_to_student: existing?.visible_to_student ?? false,
        });
      }

      // Summary (flight_number = null)
      const summaryNote = studentNotes.find((n: any) => n.flight_number === null);
      const carryOver = !summaryNote && carryOverMap[uid];
      notes.push({
        id: summaryNote?.id,
        flight_number: null,
        note: summaryNote?.note || carryOver || "",
        visible_to_student: summaryNote?.visible_to_student ?? false,
        carryOver: !!carryOver,
      });

      return {
        user_id: uid,
        pilot_name: profileMap[uid] || "?",
        flight_count: flightCountMap[uid] || 0,
        notes,
      };
    });

    setStudents(cards.sort((a, b) => a.pilot_name.localeCompare(b.pilot_name)));
    setLoading(false);
  }, [eventId, eventDate, groupId, user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleNoteChange = (studentIdx: number, noteIdx: number, value: string) => {
    setStudents(prev => prev.map((s, si) =>
      si === studentIdx ? {
        ...s,
        notes: s.notes.map((n, ni) =>
          ni === noteIdx ? { ...n, note: value, dirty: true, carryOver: false } : n
        ),
      } : s
    ));
  };

  const toggleVisibility = async (studentIdx: number, noteIdx: number) => {
    const student = students[studentIdx];
    const note = student.notes[noteIdx];
    const newVisible = !note.visible_to_student;

    // Update local state immediately
    setStudents(prev => prev.map((s, si) =>
      si === studentIdx ? {
        ...s,
        notes: s.notes.map((n, ni) =>
          ni === noteIdx ? { ...n, visible_to_student: newVisible } : n
        ),
      } : s
    ));

    // If note exists in DB, update it
    if (note.id) {
      await supabase.from("student_day_notes" as any)
        .update({ visible_to_student: newVisible } as any)
        .eq("id", note.id);
    }
  };

  const saveNote = async (studentIdx: number, noteIdx: number) => {
    if (!user) return;
    const student = students[studentIdx];
    const note = student.notes[noteIdx];
    const key = `${student.user_id}-${noteIdx}`;
    setSaving(key);

    const payload = {
      event_id: eventId,
      student_user_id: student.user_id,
      flight_number: note.flight_number,
      note: note.note,
      visible_to_student: note.visible_to_student,
      instructor_id: user.id,
    };

    if (note.id) {
      await supabase.from("student_day_notes" as any)
        .update({ note: note.note, visible_to_student: note.visible_to_student, instructor_id: user.id } as any)
        .eq("id", note.id);
    } else {
      const { data } = await supabase.from("student_day_notes" as any)
        .insert(payload as any)
        .select("id")
        .single();
      if (data) {
        setStudents(prev => prev.map((s, si) =>
          si === studentIdx ? {
            ...s,
            notes: s.notes.map((n, ni) =>
              ni === noteIdx ? { ...n, id: (data as any).id, dirty: false, carryOver: false } : n
            ),
          } : s
        ));
      }
    }

    setStudents(prev => prev.map((s, si) =>
      si === studentIdx ? {
        ...s,
        notes: s.notes.map((n, ni) =>
          ni === noteIdx ? { ...n, dirty: false } : n
        ),
      } : s
    ));

    setSaving(null);
    toast({ title: t("common.saved") });
  };

  if (loading) return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  if (students.length === 0) return <p className="text-sm text-muted-foreground">{t("events.noStudentFlights")}</p>;

  return (
    <div className="space-y-3">
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {t("events.coachDayView")} ({students.length})
      </h2>

      {students.map((student, si) => {
        const summaryNote = student.notes[6]; // index 6 = summary
        return (
          <Card key={student.user_id} className="border-0 shadow-sm overflow-hidden">
            <CardContent className="p-0">
              {/* Student header */}
              <div className="p-3 flex items-center gap-2 border-b border-border/50">
                <Plane className="h-4 w-4 text-primary shrink-0" />
                <span className="text-sm font-medium flex-1">{student.pilot_name}</span>
                <span className="text-xs text-muted-foreground">
                  {student.flight_count} {student.flight_count === 1 ? t("events.flightSlot") : t("events.flightSlot") + (student.flight_count > 1 ? "e" : "")}
                </span>
              </div>

              {/* Horizontal scroll: flight slots */}
              <div className="overflow-x-auto">
                <div className="flex gap-0 min-w-max">
                  {student.notes.slice(0, 6).map((note, ni) => (
                    <FlightSlot
                      key={ni}
                      label={`${t("events.flightSlot")} ${ni + 1}`}
                      note={note}
                      saving={saving === `${student.user_id}-${ni}`}
                      onNoteChange={(val) => handleNoteChange(si, ni, val)}
                      onToggleVisibility={() => toggleVisibility(si, ni)}
                      onSave={() => saveNote(si, ni)}
                      isActive={ni < student.flight_count}
                    />
                  ))}
                </div>
              </div>

              {/* Summary section */}
              <div className="p-3 border-t border-border/50 bg-muted/30">
                <div className="flex items-center gap-2 mb-1.5">
                  <FileText className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-semibold uppercase tracking-wider">{t("events.summary")}</span>
                  {summaryNote.carryOver && (
                    <span className="text-[10px] text-muted-foreground italic">
                      ({t("events.summaryCarryOver")})
                    </span>
                  )}
                  <button
                    onClick={() => toggleVisibility(si, 6)}
                    className="ml-auto p-1"
                    title={summaryNote.visible_to_student ? t("events.visibleToStudent") : t("events.hiddenFromStudent")}
                  >
                    {summaryNote.visible_to_student
                      ? <Eye className="h-3.5 w-3.5 text-primary" />
                      : <EyeOff className="h-3.5 w-3.5 text-muted-foreground/50" />}
                  </button>
                </div>
                <div className="flex gap-2">
                  <Textarea
                    className="text-xs min-h-[2.5rem] h-10 resize-none flex-1"
                    value={summaryNote.note}
                    onChange={(e) => handleNoteChange(si, 6, e.target.value)}
                    placeholder={t("events.coachNotePlaceholder")}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 h-10 text-xs"
                    disabled={!summaryNote.dirty && !summaryNote.carryOver}
                    onClick={() => saveNote(si, 6)}
                  >
                    {saving === `${student.user_id}-6`
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : t("common.save")}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function FlightSlot({
  label,
  note,
  saving,
  onNoteChange,
  onToggleVisibility,
  onSave,
  isActive,
}: {
  label: string;
  note: DayNote;
  saving: boolean;
  onNoteChange: (val: string) => void;
  onToggleVisibility: () => void;
  onSave: () => void;
  isActive: boolean;
}) {
  const { t } = useTranslation();

  return (
    <div className={cn(
      "w-40 shrink-0 p-2.5 border-r border-border/30 last:border-r-0",
      !isActive && "opacity-40"
    )}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        <button onClick={onToggleVisibility} className="p-0.5" title={note.visible_to_student ? t("events.visibleToStudent") : t("events.hiddenFromStudent")}>
          {note.visible_to_student
            ? <Eye className="h-3 w-3 text-primary" />
            : <EyeOff className="h-3 w-3 text-muted-foreground/50" />}
        </button>
      </div>
      <Textarea
        className="text-xs min-h-[3rem] h-12 resize-none w-full"
        value={note.note}
        onChange={(e) => onNoteChange(e.target.value)}
        placeholder="..."
      />
      {note.dirty && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-1 h-6 text-[10px] w-full"
          onClick={onSave}
          disabled={saving}
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : t("common.save")}
        </Button>
      )}
    </div>
  );
}
