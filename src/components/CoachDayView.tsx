import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Eye, EyeOff, Plane, FileText, Check, PauseCircle, ChevronRight, ArrowRightCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

import { coachNoteAutosave, type NoteDraft } from "@/lib/note-autosave";
import { useActiveStudents } from "@/hooks/use-active-students";

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
  is_next_step?: boolean;
  dirty?: boolean;
  saving?: boolean;
  saved?: boolean;
  carryOver?: boolean;
  error?: boolean;
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
  const [loadError, setLoadError] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0); // 0-5 for F1-F6
  const [, refreshDrafts] = useState(0);
  const prefix = `${user?.id}:${eventId}:`;
  const keyFor = (studentId: string, index: number) => `${prefix}${studentId}:${index}`;
  const activeDay = new Date(eventDate) >= new Date(new Date().setHours(0, 0, 0, 0));
  const activeStudents = useActiveStudents(groupId, activeDay);
  useEffect(() => coachNoteAutosave.subscribe(() => refreshDrafts(n => n + 1)), []);
  useEffect(() => () => {
    void coachNoteAutosave.flushPrefix(prefix);
  }, [prefix]);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setLoadError(false);
    try {

    // Get signed-up students for this event
    const { data: signupData, error: signupError } = await supabase
      .from("event_signups")
      .select("user_id")
      .eq("event_id", eventId)
      .eq("signed_up", true);
    if (signupError) throw signupError;

    const signedUpIds = (signupData || []).map(s => s.user_id);

    const { data: members, error: membersError } = await supabase
      .from("group_members")
      .select("user_id, role")
      .eq("group_id", groupId);
    if (membersError) throw membersError;
    if (!members || members.length === 0) { setStudents([]); setLoading(false); return; }

    // Only show students (members) who are signed up for this event
    const memberIds = members.filter(m => m.role === "member").map(m => m.user_id);
    // Only students who signed up (confirmed or waitlist) for this event
    const studentIds = memberIds.filter(id => signedUpIds.includes(id));
    if (studentIds.length === 0) { setStudents([]); setLoading(false); return; }

    const dateStr = new Date(eventDate).toISOString().split("T")[0];

    const [profilesRes, flightsRes, notesRes] = await Promise.all([
      supabase.from("profiles").select("user_id, pilot_name").in("user_id", studentIds),
      supabase.from("flights").select("user_id").in("user_id", studentIds).eq("date", dateStr),
      supabase.from("student_day_notes" as any).select("*").eq("event_id", eventId),
    ]);
    if (profilesRes.error || flightsRes.error || notesRes.error) throw profilesRes.error || flightsRes.error || notesRes.error;

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

    const carryOverMap: Record<string, string> = {};
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
        is_next_step: summaryNote?.is_next_step ?? false,
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
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [eventId, eventDate, groupId, user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const draftNote = (studentId: string, index: number, original: DayNote): DayNote => {
    const draft = coachNoteAutosave.get(keyFor(studentId, index));
    return draft ? { ...original, ...draft.value, dirty: draft.revision !== draft.savedRevision,
      saving: draft.saving, saved: draft.savedRevision === draft.revision, error: draft.error } : original;
  };

  const editNote = (studentId: string, index: number, patch: Partial<NoteDraft>) => {
    if (!user) return;
    const student = students.find(s => s.user_id === studentId);
    if (!student) return;
    const original = draftNote(studentId, index, student.notes[index]);
    const value: NoteDraft = { id: original.id || crypto.randomUUID(), note: original.note,
      visible_to_student: original.visible_to_student, is_next_step: original.is_next_step ?? false, ...patch };
    coachNoteAutosave.edit(keyFor(studentId, index), value, async (snapshot) => {
      const { error } = await supabase.from("student_day_notes" as any).upsert({
        ...snapshot, event_id: eventId, student_user_id: studentId,
        flight_number: student.notes[index].flight_number, instructor_id: user.id,
      } as any).select("id").single();
      if (error) throw error;
    });
  };

  const handleNoteChange = (studentId: string, index: number, note: string) => editNote(studentId, index, { note });
  const toggleVisibility = (studentId: string, index: number) => {
    const student = students.find(s => s.user_id === studentId);
    if (student) editNote(studentId, index, { visible_to_student: !draftNote(studentId, index, student.notes[index]).visible_to_student });
  };
  const toggleNextStep = (studentId: string) => {
    const student = students.find(s => s.user_id === studentId);
    if (student) editNote(studentId, 6, { is_next_step: !draftNote(studentId, 6, student.notes[6]).is_next_step });
  };

  const togglePaused = async (studentId: string) => {
    if (!user) return;
    const student = students.find(s => s.user_id === studentId);
    if (!student) return;

    const newPaused = !student.paused;

    if (newPaused) {
      const { error } = await supabase.from("student_day_notes" as any)
        .insert({
          event_id: eventId,
          student_user_id: studentId,
          flight_number: -1,
          note: "paused",
          visible_to_student: false,
          instructor_id: user.id,
        } as any);
      if (error) { toast({ title: t("journeys.saveFailed"), variant: "destructive" }); return; }
    } else {
      const { error } = await supabase.from("student_day_notes" as any)
        .delete()
        .eq("event_id", eventId)
        .eq("student_user_id", studentId)
        .eq("flight_number", -1);
      if (error) { toast({ title: t("journeys.saveFailed"), variant: "destructive" }); return; }
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

    toast({ title: newPaused ? t("journeys.pausedToday") : t("journeys.resumedToday") });
  };

  const visibleStudents = students.filter(student => !activeDay || !activeStudents.data?.includes(student.user_id));
  if (loadError || (activeDay && activeStudents.isError)) return <div role="alert"><p>{t("performance.loadFailed")}</p><Button onClick={() => { void fetchData(); if (activeDay) void activeStudents.refetch(); }}>{t("performance.retry")}</Button></div>;
  if (loading || (activeDay && activeStudents.isPending)) return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  if (visibleStudents.length === 0) return <p className="text-sm text-muted-foreground">{t("events.noStudentFlights")}</p>;

  return (
    <div className="space-y-1">
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
        {t("events.coachDayView")} ({visibleStudents.length})
      </h2>

      {visibleStudents.map((rawStudent) => {
        const student = { ...rawStudent, notes: rawStudent.notes.map((note, index) => draftNote(rawStudent.user_id, index, note)) };
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

              {student.notes[6].is_next_step && (
                <span title={t("events.nextStepToggle")}>
                  <ArrowRightCircle className="h-3.5 w-3.5 text-primary shrink-0" />
                </span>
              )}

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
                    {student.paused ? t("journeys.resumeToday") : t("journeys.pauseToday")}
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
                    onSave={() => void coachNoteAutosave.flush(keyFor(student.user_id, activeTab))}
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
                      onToggleNextStep={() => toggleNextStep(student.user_id)}
                      onSave={() => void coachNoteAutosave.flush(keyFor(student.user_id, 6))}
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
  onToggleNextStep,
  onSave,
  t,
}: {
  note: DayNote;
  placeholder: string;
  onChange: (val: string) => void;
  onToggleVisibility: () => void;
  onToggleNextStep?: () => void;
  onSave: () => void;
  t: (key: string) => string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between flex-wrap gap-1">
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
        {onToggleNextStep && (
          <button
            onClick={onToggleNextStep}
            className={cn(
              "flex items-center gap-1 text-[10px] transition-colors",
              note.is_next_step ? "text-primary font-medium" : "text-muted-foreground hover:text-foreground"
            )}
            title={t("events.nextStepToggle")}
          >
            <ArrowRightCircle className="h-3 w-3" />
            <span>{t("events.nextStepToggle")}</span>
          </button>
        )}
        {note.saving && (
          <span className="text-[10px] text-muted-foreground animate-pulse">{t("common.saving")}...</span>
        )}
        {note.saved && (
          <span className="text-[10px] text-primary flex items-center gap-0.5">
            <Check className="h-3 w-3" /> {t("common.saved")}
          </span>
        )}
      </div>
      {note.error && <p role="alert" className="text-xs text-destructive">{t("journeys.noteFailed")}</p>}
      {note.dirty && !note.saving && <Button size="sm" variant="outline" onClick={onSave}>{t(note.error ? "performance.retry" : "common.save")}</Button>}
      <Textarea
        className="text-xs min-h-[3rem] h-12 resize-none"
        value={note.note}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        onBlur={onSave}
      />
    </div>
  );
}
