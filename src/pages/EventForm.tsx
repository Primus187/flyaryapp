import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, X, ClipboardList, MapPin, CalendarDays, Users, PlaneTakeoff, BookOpen, Mountain, TentTree, Presentation, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { DEFAULT_FLIGHT_PREP_DE } from "@/lib/event-message";

interface BriefingTask { id?: string; label: string; task_type: string; assigned_user_id: string; sort_order: number; }
interface TrainingItem { id: string; name: string; category_name: string; }
interface MemberOption { user_id: string; name: string; functions: string[]; }
interface MeetingRow { time: string; place: string; }

type EventCategory = "height_flight" | "basic_course" | "experienced" | "camp_air" | "lecture";

const normalizeCategory = (category?: string | null): EventCategory => {
  if (category === "multi_day") return "camp_air";
  if (category === "school_event") return "lecture";
  if (category === "basic_course" || category === "experienced" || category === "camp_air" || category === "lecture") return category;
  return "height_flight";
};

const parseMeetingRows = (value: string): MeetingRow[] => {
  const rows = (value || "")
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean)
    .map(line => {
      const m = line.match(/^(\d{1,2}[:.]\d{2})\s*(.*)$/);
      return m ? { time: m[1].replace(".", ":"), place: m[2] } : { time: "", place: line };
    });
  return rows.length > 0 ? rows : [{ time: "", place: "" }];
};

const serializeMeetingRows = (rows: MeetingRow[]): string =>
  rows.map(r => [r.time.trim(), r.place.trim()].filter(Boolean).join(" ")).filter(Boolean).join("\n");

export default function EventForm() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const duplicateId = searchParams.get("duplicate");
  const schoolGroupId = searchParams.get("group");
  const fromSchool = !!schoolGroupId;
  const isEdit = !!id;
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [briefingTasks, setBriefingTasks] = useState<BriefingTask[]>([]);
  const [newTaskLabel, setNewTaskLabel] = useState("");
  const [trainingItems, setTrainingItems] = useState<TrainingItem[]>([]);
  const [selectedManeuverIds, setSelectedManeuverIds] = useState<string[]>([]);
  const [meetingRows, setMeetingRows] = useState<MeetingRow[]>([{ time: "", place: "" }]);
  const prefilledRef = useRef(false);
  const [form, setForm] = useState({
    group_id: "", title: "", description: "", status: "announced", event_date: "", event_time: "09:00",
    signup_deadline: "", event_type: "", meeting_point: "", instructor: "", launch_helper: "",
    max_participants: "", chat_link: "", flight_area: "", day_topic: "", departure_info: "", flight_prep_notes: "",
    event_category: "height_flight" as EventCategory, end_date: "",
  });

  const isHeight = form.event_category === "height_flight";
  const isCamp = form.event_category === "camp_air";
  const isLecture = form.event_category === "lecture";
  const isExperienced = form.event_category === "experienced";
  const isBasicCourse = form.event_category === "basic_course";

  useEffect(() => {
    if (!user) return;
    const fetchGroups = async () => {
      const { data } = await supabase.from("group_members").select("group_id, role, groups(id, name, group_type)").eq("user_id", user.id);
      if (data) {
        const eligible = data.filter((m: any) => m.role === "admin" || m.groups?.group_type === "pilot_group");
        const availableGroups = eligible.map((m: any) => m.groups).filter(Boolean);
        setGroups(availableGroups);
        if (!isEdit && schoolGroupId && availableGroups.some((group: any) => group.id === schoolGroupId)) {
          setForm(previous => ({ ...previous, group_id: schoolGroupId }));
        }
      }
    };
    fetchGroups();
    supabase.from("training_items").select("id, name, category_id, training_categories(name)").order("sort_order").then(({ data }) => {
      if (data) setTrainingItems(data.map((item: any) => ({ id: item.id, name: item.name, category_name: item.training_categories?.name || "" })));
    });
  }, [user, isEdit, schoolGroupId]);

  // Load group members (for instructor / launch helper / briefing pickers)
  useEffect(() => {
    if (!form.group_id) { setMembers([]); return; }
    const load = async () => {
      const { data: gm } = await supabase.from("group_members").select("user_id").eq("group_id", form.group_id);
      const ids = (gm || []).map((m: any) => m.user_id);
      if (ids.length === 0) { setMembers([]); return; }
      const [{ data: profs }, { data: funcs }] = await Promise.all([
        supabase.from("profiles").select("user_id, pilot_name").in("user_id", ids),
        supabase.from("group_member_functions" as any).select("user_id, function").eq("group_id", form.group_id),
      ]);
      const funcMap: Record<string, string[]> = {};
      ((funcs as any[]) || []).forEach((f: any) => {
        if (!funcMap[f.user_id]) funcMap[f.user_id] = [];
        funcMap[f.user_id].push(f.function);
      });
      const opts: MemberOption[] = ids.map(uid => ({
        user_id: uid,
        name: (profs || []).find((p: any) => p.user_id === uid)?.pilot_name || "Pilot",
        functions: funcMap[uid] || [],
      }));
      const rank = (o: MemberOption) => (o.functions.includes("instructor") || o.functions.includes("school_lead") ? 0 : o.functions.includes("launch_helper") ? 1 : 2);
      opts.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
      setMembers(opts);
    };
    load();
  }, [form.group_id]);

  useEffect(() => {
    const loadId = isEdit ? id : duplicateId; if (!loadId) return;
    const loadEvent = async () => {
      const { data } = await supabase.from("flight_events").select("*").eq("id", loadId).single();
      if (!data) return;
      prefilledRef.current = true;
      const d = new Date(data.event_date);
      setForm({
        group_id: data.group_id, title: data.title, description: data.description || "",
        status: duplicateId ? "announced" : data.status, event_date: duplicateId ? "" : d.toISOString().split("T")[0],
        event_time: duplicateId ? "09:00" : d.toTimeString().slice(0, 5),
        signup_deadline: data.signup_deadline ? new Date(data.signup_deadline).toISOString().split("T")[0] : "",
        event_type: data.event_type || "", meeting_point: data.meeting_point || "",
        instructor: data.instructor || "", launch_helper: data.launch_helper || "",
        max_participants: data.max_participants?.toString() || "", chat_link: data.chat_link || "",
        flight_area: (data as any).flight_area || "", day_topic: (data as any).day_topic || "",
        departure_info: (data as any).departure_info || "", flight_prep_notes: (data as any).flight_prep_notes || "",
         event_category: normalizeCategory((data as any).event_category),
        end_date: (data as any).end_date || "",
      });
      setMeetingRows(parseMeetingRows(data.meeting_point || ""));

      // Load briefing tasks
      const { data: tasks } = await supabase.from("event_briefing_tasks" as any).select("*").eq("event_id", loadId).order("sort_order" as any);
      if (tasks) setBriefingTasks((tasks as any[]).map((t: any) => ({
        id: duplicateId ? undefined : t.id, label: t.label, task_type: t.task_type,
        assigned_user_id: duplicateId ? "" : t.assigned_user_id || "", sort_order: t.sort_order,
      })));

      const { data: maneuvers } = await supabase.from("event_maneuvers" as any).select("training_item_id").eq("event_id", loadId);
      if (maneuvers) setSelectedManeuverIds((maneuvers as any[]).map((m: any) => m.training_item_id));
    };
    loadEvent();
  }, [isEdit, id, duplicateId]);

  // Prefill the standard altitude-flight briefing + flight preparation for new events
  useEffect(() => {
    if (prefilledRef.current || !isHeight) return;
    prefilledRef.current = true;
    setBriefingTasks([
      { label: t("events.briefingDefaults.meteo"), task_type: "meteo", assigned_user_id: "", sort_order: 0 },
      { label: t("events.briefingDefaults.flight_area"), task_type: "flight_area", assigned_user_id: "", sort_order: 1 },
      { label: t("events.briefingDefaults.day_topic"), task_type: "day_topic", assigned_user_id: "", sort_order: 2 },
    ]);
    setForm(prev => ({ ...prev, flight_prep_notes: prev.flight_prep_notes || DEFAULT_FLIGHT_PREP_DE }));
  }, [isHeight, t]);

  const updateMeetingRow = (index: number, patch: Partial<MeetingRow>) => {
    setMeetingRows(prev => prev.map((r, i) => i === index ? { ...r, ...patch } : r));
  };

  const addBriefingTask = () => {
    if (!newTaskLabel.trim()) return;
    setBriefingTasks(prev => [...prev, { label: newTaskLabel.trim(), task_type: "custom", assigned_user_id: "", sort_order: prev.length }]);
    setNewTaskLabel("");
  };

  const removeBriefingTask = (index: number) => {
    setBriefingTasks(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!user || !form.title || !form.event_date || !form.group_id) { toast({ title: t("events.fillRequired"), variant: "destructive" }); return; }
    setLoading(true);
    const meetingPoint = serializeMeetingRows(meetingRows) || form.meeting_point;
    const eventDate = new Date(`${form.event_date}T${form.event_time || "09:00"}`).toISOString();
    const payload: any = {
      group_id: form.group_id, title: form.title, description: form.description || null,
      status: form.status, event_date: eventDate,
      signup_deadline: form.signup_deadline ? new Date(form.signup_deadline).toISOString() : null,
      event_type: form.event_type || null, meeting_point: meetingPoint || null,
      instructor: form.instructor || null, launch_helper: form.launch_helper || null,
      max_participants: form.max_participants ? parseInt(form.max_participants) : null,
      chat_link: form.chat_link || null, created_by: user.id,
      flight_area: form.flight_area || null, day_topic: form.day_topic || null,
      departure_info: form.departure_info || null, flight_prep_notes: form.flight_prep_notes || null,
      event_category: form.event_category,
      end_date: isCamp && form.end_date ? form.end_date : null,
    };

    let eventId: string;
    if (isEdit) {
      const { created_by, ...updatePayload } = payload;
      const { error } = await supabase.from("flight_events").update(updatePayload).eq("id", id);
      if (error) { toast({ title: t("common.error"), description: error.message, variant: "destructive" }); setLoading(false); return; }
      if (!id) { setLoading(false); return; }
      eventId = id;
    } else {
      const { data, error } = await supabase.from("flight_events").insert(payload as any).select("id");
      if (error) { toast({ title: t("common.error"), description: error.message, variant: "destructive" }); setLoading(false); return; }
      eventId = (data as any[])[0].id;
    }

    // Save briefing tasks
    if (isEdit) await supabase.from("event_briefing_tasks" as any).delete().eq("event_id", eventId);
    if (isHeight && briefingTasks.length > 0) {
      await supabase.from("event_briefing_tasks" as any).insert(
        briefingTasks.map((t, i) => ({
          event_id: eventId, label: t.label, task_type: t.task_type,
          assigned_user_id: t.assigned_user_id || null, sort_order: i,
        })) as any
      );
    }

    // Save maneuvers
    if (isEdit) await supabase.from("event_maneuvers" as any).delete().eq("event_id", eventId);
    if (isHeight && selectedManeuverIds.length > 0) {
      await supabase.from("event_maneuvers" as any).insert(
        selectedManeuverIds.map((itemId, i) => ({
          event_id: eventId, training_item_id: itemId, sort_order: i,
        })) as any
      );
    }

    toast({ title: isEdit ? t("events.eventUpdated") : t("events.eventCreated") });
    navigate(isEdit ? `/events/${id}` : fromSchool ? "/school" : "/events");
    setLoading(false);
  };

  const memberSelect = (value: string, onChange: (v: string) => void, className = "w-32") => (
    <Select value={value} onValueChange={v => onChange(v === "__none__" ? "" : v)}>
      <SelectTrigger className={className}><SelectValue placeholder={t("events.assignTo")} /></SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">—</SelectItem>
        {members.map(m => (
          <SelectItem key={m.user_id} value={m.user_id}>
            {m.name}{m.functions.includes("instructor") ? ` · ${t("school.functions.instructor")}` : m.functions.includes("launch_helper") ? ` · ${t("school.functions.launch_helper")}` : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const selectedMemberId = (name: string) => members.find(member => member.name === name)?.user_id || "";
  const setNamedMember = (field: "instructor" | "launch_helper", userId: string) => {
    setForm(previous => ({ ...previous, [field]: members.find(member => member.user_id === userId)?.name || "" }));
  };

  const categoryOptions: { value: EventCategory; icon: typeof Mountain }[] = [
    { value: "height_flight", icon: Mountain },
    { value: "basic_course", icon: BookOpen },
    { value: "experienced", icon: PlaneTakeoff },
    { value: "camp_air", icon: TentTree },
    { value: "lecture", icon: Presentation },
  ];

  const goBack = () => navigate(fromSchool && !isEdit ? "/school" : isEdit && id ? `/events/${id}` : "/events");

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
        <div>
          <h1 className="text-xl font-bold tracking-tight">{isEdit ? t("events.editEvent") : t("events.createEvent")}</h1>
          {isHeight && <p className="text-xs text-muted-foreground">{t("events.heightFlightFormSubtitle")}</p>}
        </div>
      </div>
      <Card className="border-border/60 bg-card/80 shadow-sm backdrop-blur-sm">
        <CardContent className="p-4 space-y-3">
          {isHeight && <div className="flex items-center gap-2 border-b border-border/60 pb-3"><CalendarDays className="h-4 w-4 text-primary" /><Label className="text-sm font-semibold">{t("events.heightFlightBasics")}</Label></div>}
          <div className="space-y-1.5"><Label className="text-xs">{t("events.group")} *</Label><Select value={form.group_id} onValueChange={v => setForm({ ...form, group_id: v })}><SelectTrigger><SelectValue placeholder={t("events.groupSelect")} /></SelectTrigger><SelectContent>{groups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label className="text-xs">{t("events.titleLabel")} *</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder={t("events.titlePlaceholder")} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label className="text-xs">{t("events.date")} *</Label><Input type="date" value={form.event_date} onChange={e => setForm({ ...form, event_date: e.target.value })} /></div>
            <div className="space-y-1.5"><Label className="text-xs">{t("events.time")}</Label><Input type="time" value={form.event_time} onChange={e => setForm({ ...form, event_time: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label className="text-xs">{t("events.status")}</Label><Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="announced">{t("events.statusAnnounced")}</SelectItem><SelectItem value="confirmed">{t("events.statusConfirmed")}</SelectItem><SelectItem value="cancelled">{t("events.statusCancelled")}</SelectItem></SelectContent></Select></div>
            <div className="space-y-1.5"><Label className="text-xs">{t("events.category")}</Label><Select value={form.event_category} onValueChange={v => setForm({ ...form, event_category: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
              <SelectItem value="height_flight">{t("events.categories.height_flight")}</SelectItem>
              <SelectItem value="basic_course">{t("events.categories.basic_course")}</SelectItem>
              <SelectItem value="school_event">{t("events.categories.school_event")}</SelectItem>
              <SelectItem value="experienced">{t("events.categories.experienced")}</SelectItem>
              <SelectItem value="multi_day">{t("events.categories.multi_day")}</SelectItem>
            </SelectContent></Select></div>
          </div>
          {form.event_category === "multi_day" && (
            <div className="space-y-1.5"><Label className="text-xs">{t("events.endDate")}</Label><Input type="date" value={form.end_date} min={form.event_date} onChange={e => setForm({ ...form, end_date: e.target.value })} /></div>
          )}
          {!isHeight && (
            <div className="space-y-1.5"><Label className="text-xs">{t("events.eventType")}</Label><Input value={form.event_type} onChange={e => setForm({ ...form, event_type: e.target.value })} placeholder={t("events.eventTypePlaceholder")} /></div>
          )}

          {isHeight && <div className="flex items-center gap-2 border-t border-border/60 pt-4"><MapPin className="h-4 w-4 text-primary" /><Label className="text-sm font-semibold">{t("events.heightFlightPlan")}</Label></div>}
          {/* Meeting points */}
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1"><MapPin className="h-3 w-3 text-primary" />{t("events.meetingPointShort")}</Label>
            {meetingRows.map((row, i) => (
              <div key={i} className="flex gap-2">
                <Input type="time" value={row.time} onChange={e => updateMeetingRow(i, { time: e.target.value })} className="w-28" />
                <Input value={row.place} onChange={e => updateMeetingRow(i, { place: e.target.value })} placeholder={t("events.meetingPointPlaceholder")} className="flex-1" />
                {meetingRows.length > 1 && (
                  <Button type="button" variant="ghost" size="icon" className="shrink-0 h-9 w-9" onClick={() => setMeetingRows(prev => prev.filter((_, j) => j !== i))}><X className="h-3.5 w-3.5" /></Button>
                )}
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => setMeetingRows(prev => [...prev, { time: "", place: "" }])}>
              <Plus className="h-3.5 w-3.5" />{t("events.addMeetingPoint")}
            </Button>
          </div>

          <div className="space-y-1.5"><Label className="text-xs">{t("events.flightArea")}</Label><Input value={form.flight_area} onChange={e => setForm({ ...form, flight_area: e.target.value })} placeholder={t("events.flightAreaPlaceholder")} /></div>
          <div className="space-y-1.5"><Label className="text-xs">{t("events.dayTopic")}</Label><Input value={form.day_topic} onChange={e => setForm({ ...form, day_topic: e.target.value })} placeholder={t("events.dayTopicPlaceholder")} /></div>
          <div className="space-y-1.5"><Label className="text-xs">{t("events.returnInfo")}</Label><Textarea value={form.departure_info} onChange={e => setForm({ ...form, departure_info: e.target.value })} placeholder={t("events.returnInfoPlaceholder")} rows={2} /></div>

          {isHeight && <div className="flex items-center gap-2 border-t border-border/60 pt-4"><Users className="h-4 w-4 text-primary" /><Label className="text-sm font-semibold">{t("events.heightFlightTeam")}</Label></div>}
          {isHeight ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs">{t("events.instructor")}</Label>{memberSelect(members.some(m => m.name === form.instructor) ? (members.find(m => m.name === form.instructor)?.user_id || "") : "", v => setForm({ ...form, instructor: members.find(m => m.user_id === v)?.name || "" }), "w-full")}</div>
              <div className="space-y-1.5"><Label className="text-xs">{t("events.launchHelper")}</Label>{memberSelect(members.some(m => m.name === form.launch_helper) ? (members.find(m => m.name === form.launch_helper)?.user_id || "") : "", v => setForm({ ...form, launch_helper: members.find(m => m.user_id === v)?.name || "" }), "w-full")}</div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs">{t("events.instructor")}</Label><Input value={form.instructor} onChange={e => setForm({ ...form, instructor: e.target.value })} /></div>
              <div className="space-y-1.5"><Label className="text-xs">{t("events.launchHelper")}</Label><Input value={form.launch_helper} onChange={e => setForm({ ...form, launch_helper: e.target.value })} /></div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label className="text-xs">{t("events.signupDeadline")}</Label><Input type="date" value={form.signup_deadline} onChange={e => setForm({ ...form, signup_deadline: e.target.value })} /></div>
            <div className="space-y-1.5"><Label className="text-xs">{t("events.maxParticipants")}</Label><Input type="number" value={form.max_participants} onChange={e => setForm({ ...form, max_participants: e.target.value })} /></div>
          </div>
          {!isHeight && (
            <div className="space-y-1.5"><Label className="text-xs">{t("events.chatLink")}</Label><Input value={form.chat_link} onChange={e => setForm({ ...form, chat_link: e.target.value })} placeholder={t("events.chatLinkPlaceholder")} /></div>
          )}
          {isHeight && <div className="flex items-center gap-2 border-t border-border/60 pt-4"><PlaneTakeoff className="h-4 w-4 text-primary" /><Label className="text-sm font-semibold">{t("events.heightFlightCommunication")}</Label></div>}
          <div className="space-y-1.5"><Label className="text-xs">{t("events.flightPrep")}</Label><Textarea value={form.flight_prep_notes} onChange={e => setForm({ ...form, flight_prep_notes: e.target.value })} placeholder={t("events.flightPrepPlaceholder")} rows={6} /></div>
          <div className="space-y-1.5"><Label className="text-xs">{isHeight ? t("events.signature") : t("events.description")}</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder={isHeight ? t("events.signaturePlaceholder") : ""} rows={2} /></div>
        </CardContent>
      </Card>

      {/* Briefing Tasks */}
      <Card className="border-border/60 bg-card/80 shadow-sm backdrop-blur-sm">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-primary" />
            <Label className="text-sm font-semibold">{t("events.briefingShort")}</Label>
          </div>
          {briefingTasks.map((task, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input value={task.label} onChange={e => setBriefingTasks(prev => prev.map((t, j) => j === i ? { ...t, label: e.target.value } : t))} className="flex-1 text-sm" />
              {memberSelect(task.assigned_user_id, v => setBriefingTasks(prev => prev.map((t, j) => j === i ? { ...t, assigned_user_id: v } : t)))}
              <Button type="button" variant="ghost" size="icon" className="shrink-0 h-8 w-8" onClick={() => removeBriefingTask(i)}><X className="h-3 w-3" /></Button>
            </div>
          ))}
          <div className="flex gap-2">
            <Input value={newTaskLabel} onChange={e => setNewTaskLabel(e.target.value)} placeholder={t("events.briefingTaskPlaceholder")} className="text-sm" onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addBriefingTask())} />
            <Button type="button" variant="outline" size="sm" onClick={addBriefingTask}><Plus className="h-4 w-4" /></Button>
          </div>
        </CardContent>
      </Card>

      {/* Planned Maneuvers */}
      {trainingItems.length > 0 && (
        <Card className="border-border/60 bg-card/80 shadow-sm backdrop-blur-sm">
          <CardContent className="p-4 space-y-3">
            <Label className="text-sm font-semibold">{t("events.plannedManeuvers")}</Label>
            {selectedManeuverIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedManeuverIds.map(mid => {
                  const item = trainingItems.find(ti => ti.id === mid);
                  return item ? (
                    <Badge key={mid} variant="secondary" className="gap-1 pr-1">
                      {item.name}
                      <button type="button" onClick={() => setSelectedManeuverIds(prev => prev.filter(x => x !== mid))}><X className="h-3 w-3" /></button>
                    </Badge>
                  ) : null;
                })}
              </div>
            )}
            <Popover>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="w-full"><Plus className="h-4 w-4 mr-1" /> {t("events.addManeuver")}</Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 max-h-64 overflow-y-auto p-2" align="start">
                {(() => {
                  const categories = [...new Set(trainingItems.map(ti => ti.category_name))];
                  return categories.map(cat => (
                    <div key={cat} className="mb-2">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium px-2 py-1">{cat}</p>
                      {trainingItems.filter(ti => ti.category_name === cat).map(ti => (
                        <label key={ti.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer text-sm">
                          <Checkbox checked={selectedManeuverIds.includes(ti.id)} onCheckedChange={checked => setSelectedManeuverIds(prev => checked ? [...prev, ti.id] : prev.filter(x => x !== ti.id))} />
                          {ti.name}
                        </label>
                      ))}
                    </div>
                  ));
                })()}
              </PopoverContent>
            </Popover>
          </CardContent>
        </Card>
      )}

      <Button className="w-full" onClick={handleSave} disabled={loading}>{loading ? "..." : isEdit ? t("common.update") : t("common.create")}</Button>
    </div>
  );
}
