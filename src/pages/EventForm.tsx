import { useEffect, useState } from "react";
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
import { ArrowLeft, Plus, X, ClipboardList } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";

interface BriefingTask { id?: string; label: string; task_type: string; assigned_user_id: string; sort_order: number; }
interface TrainingItem { id: string; name: string; category_name: string; }

export default function EventForm() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const duplicateId = searchParams.get("duplicate");
  const isEdit = !!id;
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [signedUpUsers, setSignedUpUsers] = useState<{ user_id: string; name: string }[]>([]);
  const [briefingTasks, setBriefingTasks] = useState<BriefingTask[]>([]);
  const [newTaskLabel, setNewTaskLabel] = useState("");
  const [trainingItems, setTrainingItems] = useState<TrainingItem[]>([]);
  const [selectedManeuverIds, setSelectedManeuverIds] = useState<string[]>([]);
  const [form, setForm] = useState({
    group_id: "", title: "", description: "", status: "announced", event_date: "", event_time: "09:00",
    signup_deadline: "", event_type: "", meeting_point: "", instructor: "", launch_helper: "",
    max_participants: "", chat_link: "", flight_area: "", day_topic: "", departure_info: "", flight_prep_notes: "",
    event_category: "height_flight", end_date: "", series_count: "1",
  });

  useEffect(() => {
    if (!user) return;
    const fetchGroups = async () => {
      const { data } = await supabase.from("group_members").select("group_id, role, groups(id, name, group_type)").eq("user_id", user.id);
      if (data) { const eligible = data.filter((m: any) => m.role === "admin" || m.groups?.group_type === "pilot_group"); setGroups(eligible.map((m: any) => m.groups).filter(Boolean)); }
    };
    fetchGroups();
    supabase.from("training_items").select("id, name, category_id, training_categories(name)").order("sort_order").then(({ data }) => {
      if (data) setTrainingItems(data.map((item: any) => ({ id: item.id, name: item.name, category_name: item.training_categories?.name || "" })));
    });
  }, [user]);

  useEffect(() => {
    const loadId = isEdit ? id : duplicateId; if (!loadId) return;
    const loadEvent = async () => {
      const { data } = await supabase.from("flight_events").select("*").eq("id", loadId).single();
      if (!data) return;
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
        event_category: (data as any).event_category || "height_flight",
        end_date: (data as any).end_date || "", series_count: "1",
      });

      // Load briefing tasks
      if (isEdit || duplicateId) {
        const { data: tasks } = await supabase.from("event_briefing_tasks" as any).select("*").eq("event_id", loadId).order("sort_order" as any);
        if (tasks) setBriefingTasks((tasks as any[]).map((t: any) => ({
          id: duplicateId ? undefined : t.id, label: t.label, task_type: t.task_type,
          assigned_user_id: duplicateId ? "" : t.assigned_user_id || "", sort_order: t.sort_order,
        })));

        const { data: maneuvers } = await supabase.from("event_maneuvers" as any).select("training_item_id").eq("event_id", loadId);
        if (maneuvers) setSelectedManeuverIds((maneuvers as any[]).map((m: any) => m.training_item_id));
      }

      // Load signups for assignment dropdown
      const { data: sups } = await supabase.from("event_signups").select("user_id").eq("event_id", loadId).eq("signed_up", true);
      if (sups && sups.length > 0) {
        const ids = sups.map(s => s.user_id);
        const { data: profs } = await supabase.from("profiles").select("user_id, pilot_name").in("user_id", ids);
        if (profs) setSignedUpUsers(profs.map(p => ({ user_id: p.user_id, name: p.pilot_name || "?" })));
      }
    };
    loadEvent();
  }, [isEdit, id, duplicateId]);

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
    const eventDate = new Date(`${form.event_date}T${form.event_time || "09:00"}`).toISOString();
    const payload: any = {
      group_id: form.group_id, title: form.title, description: form.description || null,
      status: form.status, event_date: eventDate,
      signup_deadline: form.signup_deadline ? new Date(form.signup_deadline).toISOString() : null,
      event_type: form.event_type || null, meeting_point: form.meeting_point || null,
      instructor: form.instructor || null, launch_helper: form.launch_helper || null,
      max_participants: form.max_participants ? parseInt(form.max_participants) : null,
      chat_link: form.chat_link || null, created_by: user.id,
      flight_area: form.flight_area || null, day_topic: form.day_topic || null,
      departure_info: form.departure_info || null, flight_prep_notes: form.flight_prep_notes || null,
      event_category: form.event_category,
      end_date: form.event_category === "multi_day" && form.end_date ? form.end_date : null,
    };

    let eventId: string;
    if (isEdit) {
      const { created_by, ...updatePayload } = payload;
      const { error } = await supabase.from("flight_events").update(updatePayload).eq("id", id);
      if (error) { toast({ title: t("common.error"), description: error.message, variant: "destructive" }); setLoading(false); return; }
      eventId = id!;
    } else {
      const { data, error } = await supabase.from("flight_events").insert(payload).select("id").single();
      if (error) { toast({ title: t("common.error"), description: error.message, variant: "destructive" }); setLoading(false); return; }
      eventId = data.id;
    }

    // Save briefing tasks
    if (isEdit) await supabase.from("event_briefing_tasks" as any).delete().eq("event_id", eventId);
    if (briefingTasks.length > 0) {
      await supabase.from("event_briefing_tasks" as any).insert(
        briefingTasks.map((t, i) => ({
          event_id: eventId, label: t.label, task_type: t.task_type,
          assigned_user_id: t.assigned_user_id || null, sort_order: i,
        })) as any
      );
    }

    // Save maneuvers
    if (isEdit) await supabase.from("event_maneuvers" as any).delete().eq("event_id", eventId);
    if (selectedManeuverIds.length > 0) {
      await supabase.from("event_maneuvers" as any).insert(
        selectedManeuverIds.map((itemId, i) => ({
          event_id: eventId, training_item_id: itemId, sort_order: i,
        })) as any
      );
    }

    toast({ title: isEdit ? t("events.eventUpdated") : t("events.eventCreated") });
    navigate(isEdit ? `/events/${id}` : "/events");
    setLoading(false);
  };

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="text-xl font-bold tracking-tight">{isEdit ? t("events.editEvent") : t("events.createEvent")}</h1>
      </div>
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5"><Label className="text-xs">{t("events.group")} *</Label><Select value={form.group_id} onValueChange={v => setForm({ ...form, group_id: v })}><SelectTrigger><SelectValue placeholder={t("events.groupSelect")} /></SelectTrigger><SelectContent>{groups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label className="text-xs">{t("events.titleLabel")} *</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder={t("events.titlePlaceholder")} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label className="text-xs">{t("events.date")} *</Label><Input type="date" value={form.event_date} onChange={e => setForm({ ...form, event_date: e.target.value })} /></div>
            <div className="space-y-1.5"><Label className="text-xs">{t("events.time")}</Label><Input type="time" value={form.event_time} onChange={e => setForm({ ...form, event_time: e.target.value })} /></div>
          </div>
          <div className="space-y-1.5"><Label className="text-xs">{t("events.status")}</Label><Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="announced">{t("events.statusAnnounced")}</SelectItem><SelectItem value="confirmed">{t("events.statusConfirmed")}</SelectItem><SelectItem value="cancelled">{t("events.statusCancelled")}</SelectItem></SelectContent></Select></div>
          <div className="space-y-1.5"><Label className="text-xs">{t("events.eventType")}</Label><Input value={form.event_type} onChange={e => setForm({ ...form, event_type: e.target.value })} placeholder={t("events.eventTypePlaceholder")} /></div>
          <div className="space-y-1.5"><Label className="text-xs">{t("events.meetingPoint")}</Label><Input value={form.meeting_point} onChange={e => setForm({ ...form, meeting_point: e.target.value })} placeholder={t("events.meetingPointPlaceholder")} /></div>
          <div className="space-y-1.5"><Label className="text-xs">{t("events.flightArea")}</Label><Input value={form.flight_area} onChange={e => setForm({ ...form, flight_area: e.target.value })} placeholder={t("events.flightAreaPlaceholder")} /></div>
          <div className="space-y-1.5"><Label className="text-xs">{t("events.dayTopic")}</Label><Input value={form.day_topic} onChange={e => setForm({ ...form, day_topic: e.target.value })} placeholder={t("events.dayTopicPlaceholder")} /></div>
          <div className="space-y-1.5"><Label className="text-xs">{t("events.departureInfo")}</Label><Textarea value={form.departure_info} onChange={e => setForm({ ...form, departure_info: e.target.value })} placeholder={t("events.departureInfoPlaceholder")} rows={3} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label className="text-xs">{t("events.instructor")}</Label><Input value={form.instructor} onChange={e => setForm({ ...form, instructor: e.target.value })} /></div>
            <div className="space-y-1.5"><Label className="text-xs">{t("events.launchHelper")}</Label><Input value={form.launch_helper} onChange={e => setForm({ ...form, launch_helper: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label className="text-xs">{t("events.signupDeadline")}</Label><Input type="date" value={form.signup_deadline} onChange={e => setForm({ ...form, signup_deadline: e.target.value })} /></div>
            <div className="space-y-1.5"><Label className="text-xs">{t("events.maxParticipants")}</Label><Input type="number" value={form.max_participants} onChange={e => setForm({ ...form, max_participants: e.target.value })} /></div>
          </div>
          <div className="space-y-1.5"><Label className="text-xs">{t("events.chatLink")}</Label><Input value={form.chat_link} onChange={e => setForm({ ...form, chat_link: e.target.value })} placeholder={t("events.chatLinkPlaceholder")} /></div>
          <div className="space-y-1.5"><Label className="text-xs">{t("events.flightPrep")}</Label><Textarea value={form.flight_prep_notes} onChange={e => setForm({ ...form, flight_prep_notes: e.target.value })} placeholder={t("events.flightPrepPlaceholder")} rows={3} /></div>
          <div className="space-y-1.5"><Label className="text-xs">{t("events.description")}</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} /></div>
        </CardContent>
      </Card>

      {/* Briefing Tasks */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-primary" />
            <Label className="text-sm font-semibold">{t("events.briefingLabel")}</Label>
          </div>
          {briefingTasks.map((task, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input value={task.label} onChange={e => setBriefingTasks(prev => prev.map((t, j) => j === i ? { ...t, label: e.target.value } : t))} className="flex-1 text-sm" />
              {signedUpUsers.length > 0 && (
                <Select value={task.assigned_user_id} onValueChange={v => setBriefingTasks(prev => prev.map((t, j) => j === i ? { ...t, assigned_user_id: v === "__none__" ? "" : v } : t))}>
                  <SelectTrigger className="w-32"><SelectValue placeholder={t("events.assignTo")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {signedUpUsers.map(u => <SelectItem key={u.user_id} value={u.user_id}>{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
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
        <Card className="border-0 shadow-sm">
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
