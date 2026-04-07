import { useEffect, useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Eye, EyeOff, Plane, FileText, Check, PauseCircle, ChevronRight,
} from "lucide-react";
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
  saving?: boolean;
  saved?: boolean;
  carryOver?: boolean;
}

interface StudentCard {
  user_id: string;
  pilot_name: string;
  flight_count: number;
  paused: boolean;
  notes: DayNote[]; // index 0-5 = flights 1-6, index 6 = summary
}

export default function CoachDayView({ eventId, eventDate, groupId }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [students, setStudents] = useState<StudentCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0); // 0-5 for F1-F6
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const fetchData = useCallback(async () => {
    if (!user) return;

    // Get signed-up students for this event
    const { data: signupData } = await supabase
      .from("event_signups")
      .select("user_id")
      .eq("event_id", eventId)
      .eq("signed_up", true);

    const signedUpIds = (signupData || []).map(s => s.user_id);

    const { data: members } = await supabase
      .from("group_members")
      .select("user_id, role")
      .eq("group_id", groupId);
    if (!members || members.length === 0) { setLoading(false); return; }

    // Only show students (members) who are signed up for this event
    const allStudentIds = members.filter(m => m.role === "member").map(m => m.user_id);
    const studentIds = signedUpIds.length > 0
      ? allStudentIds.filter(id => signedUpIds.includes(id))
      : allStudentIds; // fallback: show all if no signups exist
    if (studentIds.length === 0) { setLoading(false); return; }

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

    // Carry-over logic for summaries
    const studentsNeedingCarryOver = studentIds.filter(sid =>
      !existingNotes.some((n: any) => n.student_user_id === sid && n.flight_number === null)
    );

    let carryOverMap: Record<string, string> = {};
    if (studentsNeedingCarryOver.length > 0) {
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

    const cards: StudentCard[] = studentIds.map(uid => {
      const studentNotes = existingNotes.filter((n: any) => n.student_user_id === uid);
      const notes: DayNote[] = [];

      for (let i = 1; i <= 6; i++) {
        const existing = studentNotes.find((n: any) => n.flight_number === i);
        notes.push({
          id: existing?.id,
          flight_number: i,
          note: existing?.note || "",
          visible_to_student: existing?.visible_to_student ?? false,
        });
      }

      const summaryNote = studentNotes.find((n: any) => n.flight_number === null);
      const carryOver = !summaryNote && carryOverMap[uid];
      notes.push({
        id: summaryNote?.id,
        flight_number: null,
        note: summaryNote?.note || carryOver || "",
        visible_to_student: summaryNote?.visible_to_student ?? false,
        carryOver: !!carryOver,
      });

      const pausedNote = studentNotes.find((n: any) => n.flight_number === -1);

      return {
        user_id: uid,
        pilot_name: profileMap[uid] || "?",
        flight_count: flightCountMap[uid] || 0,
        paused: !!pausedNote,
        notes,
      };
    });

    // Sort: non-paused first, then alphabetical
    cards.sort((a, b) => {
      if (a.paused !== b.paused) return a.paused ? 1 : -1;
      return a.pilot_name.localeCompare(b.pilot_name);
    });

    setStudents(cards);
    setLoading(false);
  }, [eventId, eventDate, groupId, user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Cleanup debounce timers
  useEffect(() => {
    return () => {
      Object.values(debounceTimers.current).forEach(clearTimeout);
    };
  }, []);

  const persistNote = useCallback(async (student: StudentCard, noteIdx: number, note: DayNote) => {
    if (!user) return;

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
    } else if (note.note.trim()) {
      const { data } = await supabase.from("student_day_notes" as any)
        .insert(payload as any)
        .select("id")
        .single();
      if (data) {
        setStudents(prev => prev.map(s =>
          s.user_id === student.user_id ? {
            ...s,
            notes: s.notes.map((n, ni) =>
              ni === noteIdx ? { ...n, id: (data as any).id } : n
            ),
          } : s
        ));
      }
    }

    // Show saved indicator
    setStudents(prev => prev.map(s =>
      s.user_id === student.user_id ? {
        ...s,
        notes: s.notes.map((n, ni) =>
          ni === noteIdx ? { ...n, dirty: false, saving: false, saved: true } : n
        ),
      } : s
    ));

    // Clear saved indicator after 2s
    setTimeout(() => {
      setStudents(prev => prev.map(s =>
        s.user_id === student.user_id ? {
          ...s,
          notes: s.notes.map((n, ni) =>
            ni === noteIdx ? { ...n, saved: false } : n
          ),
        } : s
      ));
    }, 2000);
  }, [eventId, user]);

  const handleNoteChange = (studentId: string, noteIdx: number, value: string) => {
    setStudents(prev => prev.map(s =>
      s.user_id === studentId ? {
        ...s,
        notes: s.notes.map((n, ni) =>
          ni === noteIdx ? { ...n, note: value, dirty: true, saved: false, carryOver: false } : n
        ),
      } : s
    ));

    // Debounced auto-save
    const key = `${studentId}-${noteIdx}`;
    if (debounceTimers.current[key]) clearTimeout(debounceTimers.current[key]);
    debounceTimers.current[key] = setTimeout(() => {
      setStudents(prev => {
        const student = prev.find(s => s.user_id === studentId);
        if (student) {
          const note = student.notes[noteIdx];
          persistNote(student, noteIdx, { ...note, note: value });
        }
        return prev.map(s =>
          s.user_id === studentId ? {
            ...s,
            notes: s.notes.map((n, ni) =>
              ni === noteIdx ? { ...n, saving: true } : n
            ),
          } : s
        );
      });
    }, 800);
  };

  const toggleVisibility = async (studentId: string, noteIdx: number) => {
    const student = students.find(s => s.user_id === studentId);
    if (!student) return;
    const note = student.notes[noteIdx];
    const newVisible = !note.visible_to_student;

    setStudents(prev => prev.map(s =>
      s.user_id === studentId ? {
        ...s,
        notes: s.notes.map((n, ni) =>
          ni === noteIdx ? { ...n, visible_to_student: newVisible } : n
        ),
      } : s
    ));

    if (note.id) {
      await supabase.from("student_day_notes" as any)
        .update({ visible_to_student: newVisible } as any)
        .eq("id", note.id);
    }
  };

  const togglePaused = async (studentId: string) => {
    if (!user) return;
    const student = students.find(s => s.user_id === studentId);
    if (!student) return;

    const newPaused = !student.paused;

    if (newPaused) {
      await supabase.from("student_day_notes" as any)
        .insert({
          event_id: eventId,
          student_user_id: studentId,
          flight_number: -1,
          note: "paused",
          visible_to_student: false,
          instructor_id: user.id,
        } as any);
    } else {
      await supabase.from("student_day_notes" as any)
        .delete()
        .eq("event_id", eventId)
        .eq("student_user_id", studentId)
        .eq("flight_number", -1);
    }

    setStudents(prev => {
      const updated = prev.map(s =>
        s.user_id === studentId ? { ...s, paused: newPaused } : s
      );
      updated.sort((a, b) => {
        if (a.paused !== b.paused) return a.paused ? 1 : -1;
        return a.pilot_name.localeCompare(b.pilot_name);
      });
      return updated;
    });

    toast({ title: newPaused ? t("events.studentPaused") : t("events.studentResumed") });
  };

  if (loading) return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  if (students.length === 0) return <p className="text-sm text-muted-foreground">{t("events.noStudentFlights")}</p>;

  return (
    <div className="space-y-1">
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
        {t("events.coachDayView")} ({students.length})
      </h2>

      {students.map((student) => {
        const isExpanded = expandedId === student.user_id;
        const notesWithContent = student.notes.slice(0, 6).filter(n => n.note.trim()).length;

        return (
          <div key={student.user_id} className="rounded-lg border border-border/50 overflow-hidden bg-card">
            {/* Compact row */}
            <button
              onClick={() => {
                setExpandedId(isExpanded ? null : student.user_id);
                setActiveTab(0);
              }}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors",
                student.paused && "opacity-50",
                isExpanded && "bg-muted/40"
              )}
            >
              <ChevronRight className={cn(
                "h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform",
                isExpanded && "rotate-90"
              )} />
              <span className="text-sm font-medium flex-1 truncate">{student.pilot_name}</span>

              {/* Note dots */}
              <div className="flex gap-0.5">
                {student.notes.slice(0, 6).map((n, i) => (
                  <div
                    key={i}
                    className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      n.note.trim() ? "bg-primary" : "bg-muted-foreground/20"
                    )}
                  />
                ))}
              </div>

              <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                {student.flight_count}<Plane className="h-3 w-3" />
              </span>

              {student.paused && (
                <PauseCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              )}
            </button>

            {/* Expanded content */}
            {isExpanded && (
              <div className="border-t border-border/50">
                {/* Pause toggle */}
                <div className="px-3 py-1.5 flex justify-end border-b border-border/30">
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn("h-7 text-xs gap-1", student.paused && "text-amber-500")}
                    onClick={(e) => { e.stopPropagation(); togglePaused(student.user_id); }}
                  >
                    <PauseCircle className="h-3.5 w-3.5" />
                    {student.paused ? t("events.resumeStudent") : t("events.pauseStudent")}
                  </Button>
                </div>

                {/* Flight tabs F1-F6 */}
                <div className="flex border-b border-border/30">
                  {[0, 1, 2, 3, 4, 5].map(i => {
                    const hasNote = student.notes[i].note.trim();
                    const isActive = activeTab === i;
                    return (
                      <button
                        key={i}
                        onClick={() => setActiveTab(i)}
                        className={cn(
                          "flex-1 py-2 text-xs font-medium relative transition-colors",
                          isActive
                            ? "text-primary border-b-2 border-primary"
                            : "text-muted-foreground hover:text-foreground",
                          i < student.flight_count ? "" : "opacity-40"
                        )}
                      >
                        F{i + 1}
                        {hasNote && (
                          <span className="absolute top-1 right-1/2 translate-x-3 w-1.5 h-1.5 rounded-full bg-primary" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Active flight note */}
                <div className="p-3 space-y-2">
                  <NoteEditor
                    note={student.notes[activeTab]}
                    placeholder={`${t("events.flightSlot")} ${activeTab + 1}...`}
                    onChange={(val) => handleNoteChange(student.user_id, activeTab, val)}
                    onToggleVisibility={() => toggleVisibility(student.user_id, activeTab)}
                    t={t}
                  />

                  {/* Summary */}
                  <div className="pt-2 border-t border-border/30">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <FileText className="h-3.5 w-3.5 text-primary" />
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {t("events.summary")}
                      </span>
                      {student.notes[6].carryOver && (
                        <span className="text-[10px] text-muted-foreground italic">
                          ({t("events.summaryCarryOver")})
                        </span>
                      )}
                    </div>
                    <NoteEditor
                      note={student.notes[6]}
                      placeholder={t("events.coachNotePlaceholder")}
                      onChange={(val) => handleNoteChange(student.user_id, 6, val)}
                      onToggleVisibility={() => toggleVisibility(student.user_id, 6)}
                      t={t}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function NoteEditor({
  note,
  placeholder,
  onChange,
  onToggleVisibility,
  t,
}: {
  note: DayNote;
  placeholder: string;
  onChange: (val: string) => void;
  onToggleVisibility: () => void;
  t: (key: string) => string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <button
          onClick={onToggleVisibility}
          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          title={note.visible_to_student ? t("events.visibleToStudent") : t("events.hiddenFromStudent")}
        >
          {note.visible_to_student
            ? <><Eye className="h-3 w-3 text-primary" /><span>{t("events.visibleToStudent")}</span></>
            : <><EyeOff className="h-3 w-3 text-muted-foreground/50" /><span>{t("events.hiddenFromStudent")}</span></>
          }
        </button>
        {note.saving && (
          <span className="text-[10px] text-muted-foreground animate-pulse">{t("common.saving")}...</span>
        )}
        {note.saved && (
          <span className="text-[10px] text-primary flex items-center gap-0.5">
            <Check className="h-3 w-3" /> {t("common.saved")}
          </span>
        )}
      </div>
      <Textarea
        className="text-xs min-h-[3rem] h-12 resize-none"
        value={note.note}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
