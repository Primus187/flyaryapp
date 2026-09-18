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
    max_participants: "", flight_area: "", day_topic: "", departure_info: "", flight_prep_notes: "",
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
        max_participants: data.max_participants?.toString() || "",
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
    const meetingPoint = isHeight ? serializeMeetingRows(meetingRows) : form.meeting_point;
    const eventDate = new Date(`${form.event_date}T${form.event_time || "09:00"}`).toISOString();
    const payload: any = {
      group_id: form.group_id, title: form.title, description: form.description || null,
      status: form.status, event_date: eventDate,
      signup_deadline: form.signup_deadline ? new Date(form.signup_deadline).toISOString() : null,
      event_type: isExperienced ? form.event_type || null : null, meeting_point: meetingPoint || null,
      instructor: form.instructor || null, launch_helper: isHeight ? form.launch_helper || null : null,
      max_participants: form.max_participants ? parseInt(form.max_participants) : null,
      created_by: user.id,
      flight_area: isHeight || isExperienced ? form.flight_area || null : null,
      day_topic: isHeight || isBasicCourse || isLecture ? form.day_topic || null : null,
      departure_info: isHeight || isCamp ? form.departure_info || null : null,
      flight_prep_notes: isHeight || isBasicCourse ? form.flight_prep_notes || null : null,
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
    <div className="px-4 pt-5 pb-8 max-w-lg mx-auto space-y-4">
      <header className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={goBack} aria-label={t("common.back")}><ArrowLeft className="h-5 w-5" /></Button>
        <div>
          <h1 className="text-xl font-bold tracking-tight">{isEdit ? t("events.editEvent") : t("events.createEvent")}</h1>
          <p className="text-xs text-muted-foreground">{t("events.formSubtitle")}</p>
        </div>
      </header>

      <section className="space-y-2" aria-labelledby="event-category-heading">
        <Label id="event-category-heading" className="text-sm font-semibold">{t("events.chooseCategory")}</Label>
        <div className="grid grid-cols-2 gap-2">
          {categoryOptions.map(({ value, icon: Icon }, index) => (
            <Button key={value} type="button" variant={form.event_category === value ? "default" : "outline"} className={`h-auto min-h-16 justify-start gap-2 px-3 py-3 ${index === categoryOptions.length - 1 ? "col-span-2" : ""}`} onClick={() => setForm(previous => ({ ...previous, event_category: value }))}>
              <Icon className="h-5 w-5 shrink-0" />
              <span className="text-left text-sm whitespace-normal">{t(`events.categories.${value}`)}</span>
            </Button>
          ))}
        </div>
      </section>

      <Card className="border-border/60 bg-card/80 shadow-sm backdrop-blur-sm">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-2 border-b border-border/60 pb-3"><CalendarDays className="h-4 w-4 text-primary" /><Label className="text-sm font-semibold">{t("events.sections.basics")}</Label></div>
          {!fromSchool || isEdit ? (
            <div className="space-y-1.5"><Label className="text-xs">{t("events.group")} *</Label><Select value={form.group_id} onValueChange={value => setForm(previous => ({ ...previous, group_id: value }))}><SelectTrigger><SelectValue placeholder={t("events.groupSelect")} /></SelectTrigger><SelectContent>{groups.map(group => <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>)}</SelectContent></Select></div>
          ) : groups.find(group => group.id === form.group_id) ? (
            <div className="rounded-md bg-muted px-3 py-2"><p className="text-xs text-muted-foreground">{t("events.group")}</p><p className="text-sm font-medium">{groups.find(group => group.id === form.group_id)?.name}</p></div>
          ) : null}
          <div className="space-y-1.5"><Label className="text-xs">{t("events.titleLabel")} *</Label><Input value={form.title} onChange={event => setForm(previous => ({ ...previous, title: event.target.value }))} placeholder={t(`events.placeholders.${form.event_category}.title`)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label className="text-xs">{isCamp ? t("events.startDate") : t("events.date")} *</Label><Input type="date" value={form.event_date} onChange={event => setForm(previous => ({ ...previous, event_date: event.target.value }))} /></div>
            {isCamp ? <div className="space-y-1.5"><Label className="text-xs">{t("events.endDate")} *</Label><Input type="date" value={form.end_date} min={form.event_date} onChange={event => setForm(previous => ({ ...previous, end_date: event.target.value }))} /></div> : <div className="space-y-1.5"><Label className="text-xs">{t("events.time")}</Label><Input type="time" value={form.event_time} onChange={event => setForm(previous => ({ ...previous, event_time: event.target.value }))} /></div>}
          </div>
          {isCamp && <div className="space-y-1.5"><Label className="text-xs">{t("events.time")}</Label><Input type="time" value={form.event_time} onChange={event => setForm(previous => ({ ...previous, event_time: event.target.value }))} /></div>}
          <div className="space-y-1.5"><Label className="text-xs">{t("events.status")}</Label><Select value={form.status} onValueChange={value => setForm(previous => ({ ...previous, status: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="announced">{t("events.statusAnnounced")}</SelectItem><SelectItem value="confirmed">{t("events.statusConfirmed")}</SelectItem><SelectItem value="cancelled">{t("events.statusCancelled")}</SelectItem></SelectContent></Select></div>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/80 shadow-sm backdrop-blur-sm">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-2 border-b border-border/60 pb-3"><MapPin className="h-4 w-4 text-primary" /><Label className="text-sm font-semibold">{t(`events.sections.${form.event_category}`)}</Label></div>
          {isHeight ? (
            <div className="space-y-2">
              <Label className="text-xs">{t("events.meetingPointShort")}</Label>
              {meetingRows.map((row, index) => <div key={index} className="flex gap-2"><Input type="time" value={row.time} onChange={event => updateMeetingRow(index, { time: event.target.value })} className="w-28" /><Input value={row.place} onChange={event => updateMeetingRow(index, { place: event.target.value })} placeholder={t("events.meetingPointPlaceholder")} className="min-w-0 flex-1" />{meetingRows.length > 1 && <Button type="button" variant="ghost" size="icon" className="shrink-0" onClick={() => setMeetingRows(previous => previous.filter((_, rowIndex) => rowIndex !== index))}><X className="h-4 w-4" /></Button>}</div>)}
              <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => setMeetingRows(previous => [...previous, { time: "", place: "" }])}><Plus className="h-4 w-4" />{t("events.addMeetingPoint")}</Button>
            </div>
          ) : <div className="space-y-1.5"><Label className="text-xs">{isCamp ? t("events.destinationAccommodation") : isExperienced ? t("events.locationOrArea") : t("events.location")}</Label><Input value={form.meeting_point} onChange={event => setForm(previous => ({ ...previous, meeting_point: event.target.value }))} placeholder={t(`events.placeholders.${form.event_category}.location`)} /></div>}

          {(isHeight || isExperienced) && <div className="space-y-1.5"><Label className="text-xs">{t("events.flightArea")}</Label><Input value={form.flight_area} onChange={event => setForm(previous => ({ ...previous, flight_area: event.target.value }))} placeholder={t("events.flightAreaPlaceholder")} /></div>}
          {(isHeight || isBasicCourse) && <div className="space-y-1.5"><Label className="text-xs">{isBasicCourse ? t("events.dayContents") : t("events.dayTopic")}</Label><Input value={form.day_topic} onChange={event => setForm(previous => ({ ...previous, day_topic: event.target.value }))} placeholder={t(`events.placeholders.${form.event_category}.topic`)} /></div>}
          {isExperienced && <div className="space-y-1.5"><Label className="text-xs">{t("events.requiredLevel")}</Label><Input value={form.event_type} onChange={event => setForm(previous => ({ ...previous, event_type: event.target.value }))} placeholder={t("events.placeholders.experienced.level")} /></div>}
          {isLecture && <div className="space-y-1.5"><Label className="text-xs">{t("events.topic")}</Label><Input value={form.day_topic} onChange={event => setForm(previous => ({ ...previous, day_topic: event.target.value }))} placeholder={t("events.placeholders.lecture.topic")} /></div>}
          {(isHeight || isCamp) && <div className="space-y-1.5"><Label className="text-xs">{isCamp ? t("events.travelInfo") : t("events.returnInfo")}</Label><Textarea value={form.departure_info} onChange={event => setForm(previous => ({ ...previous, departure_info: event.target.value }))} placeholder={t(`events.placeholders.${form.event_category}.travel`)} rows={3} /></div>}
          {isBasicCourse && <div className="space-y-1.5"><Label className="text-xs">{t("events.materialNotes")}</Label><Textarea value={form.flight_prep_notes} onChange={event => setForm(previous => ({ ...previous, flight_prep_notes: event.target.value }))} placeholder={t("events.placeholders.basic_course.material")} rows={3} /></div>}
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/80 shadow-sm backdrop-blur-sm">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-2 border-b border-border/60 pb-3"><Users className="h-4 w-4 text-primary" /><Label className="text-sm font-semibold">{t("events.sections.team")}</Label></div>
          <div className={isHeight ? "grid grid-cols-2 gap-3" : "space-y-1.5"}>
            <div className="space-y-1.5"><Label className="text-xs">{isLecture ? t("events.speaker") : isHeight ? t("events.instructor") : t("events.lead")}</Label>{memberSelect(selectedMemberId(form.instructor), value => setNamedMember("instructor", value), "w-full")}</div>
            {isHeight && <div className="space-y-1.5"><Label className="text-xs">{t("events.launchHelper")}</Label>{memberSelect(selectedMemberId(form.launch_helper), value => setNamedMember("launch_helper", value), "w-full")}</div>}
          </div>
          {isLecture && <div className="space-y-1.5"><Label className="text-xs">{t("events.externalSpeaker")}</Label><Input value={form.instructor} onChange={event => setForm(previous => ({ ...previous, instructor: event.target.value }))} placeholder={t("events.externalSpeakerPlaceholder")} /></div>}
          <div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label className="text-xs">{t("events.signupDeadline")}</Label><Input type="date" value={form.signup_deadline} onChange={event => setForm(previous => ({ ...previous, signup_deadline: event.target.value }))} /></div><div className="space-y-1.5"><Label className="text-xs">{t("events.maxParticipants")}</Label><Input type="number" min="1" value={form.max_participants} onChange={event => setForm(previous => ({ ...previous, max_participants: event.target.value }))} /></div></div>
        </CardContent>
      </Card>

      {isHeight && <Card className="border-border/60 bg-card/80 shadow-sm backdrop-blur-sm"><CardContent className="p-4 space-y-4"><div className="flex items-center gap-2 border-b border-border/60 pb-3"><ClipboardList className="h-4 w-4 text-primary" /><Label className="text-sm font-semibold">{t("events.briefingShort")}</Label></div>{briefingTasks.map((task, index) => <div key={`${task.task_type}-${index}`} className="flex items-center gap-2"><Input value={task.label} onChange={event => setBriefingTasks(previous => previous.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item))} className="min-w-0 flex-1 text-sm" />{memberSelect(task.assigned_user_id, value => setBriefingTasks(previous => previous.map((item, itemIndex) => itemIndex === index ? { ...item, assigned_user_id: value } : item)))}<Button type="button" variant="ghost" size="icon" className="shrink-0" onClick={() => removeBriefingTask(index)}><X className="h-4 w-4" /></Button></div>)}<div className="flex gap-2"><Input value={newTaskLabel} onChange={event => setNewTaskLabel(event.target.value)} placeholder={t("events.briefingTaskPlaceholder")} className="text-sm" onKeyDown={event => event.key === "Enter" && (event.preventDefault(), addBriefingTask())} /><Button type="button" variant="outline" size="icon" onClick={addBriefingTask}><Plus className="h-4 w-4" /></Button></div></CardContent></Card>}

      {isHeight && trainingItems.length > 0 && (
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
                      <Button type="button" variant="ghost" size="icon" className="h-5 w-5" onClick={() => setSelectedManeuverIds(prev => prev.filter(x => x !== mid))}><X className="h-3 w-3" /></Button>
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

      <Card className="border-border/60 bg-card/80 shadow-sm backdrop-blur-sm"><CardContent className="p-4 space-y-3"><div className="flex items-center gap-2"><PlaneTakeoff className="h-4 w-4 text-primary" /><Label className="text-sm font-semibold">{isHeight ? t("events.heightFlightCommunication") : t("events.sections.details")}</Label></div>{isHeight && <div className="space-y-1.5"><Label className="text-xs">{t("events.flightPrep")}</Label><Textarea value={form.flight_prep_notes} onChange={event => setForm(previous => ({ ...previous, flight_prep_notes: event.target.value }))} placeholder={t("events.flightPrepPlaceholder")} rows={6} /></div>}<div className="space-y-1.5"><Label className="text-xs">{isHeight ? t("events.signature") : isCamp || isExperienced ? t("events.programDescription") : t("events.description")}</Label><Textarea value={form.description} onChange={event => setForm(previous => ({ ...previous, description: event.target.value }))} placeholder={isHeight ? t("events.signaturePlaceholder") : t(`events.placeholders.${form.event_category}.description`)} rows={4} /></div></CardContent></Card>

      <Button className="w-full gap-2" onClick={handleSave} disabled={loading || (isCamp && !form.end_date)}><Save className="h-4 w-4" />{loading ? "..." : isEdit ? t("common.update") : t("common.create")}</Button>
    </div>
  );
}
