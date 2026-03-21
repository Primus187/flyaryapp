import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";

export default function EventForm() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const duplicateId = searchParams.get("duplicate");
  const isEdit = !!id;
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    group_id: "",
    title: "",
    description: "",
    status: "announced",
    event_date: "",
    event_time: "09:00",
    signup_deadline: "",
    event_type: "",
    meeting_point: "",
    instructor: "",
    launch_helper: "",
    max_participants: "",
  });

  useEffect(() => {
    if (!user) return;
    const fetchGroups = async () => {
      const { data } = await supabase
        .from("group_members")
        .select("group_id, role, groups(id, name)")
        .eq("user_id", user.id)
        .eq("role", "admin");
      if (data) setGroups(data.map((m: any) => m.groups).filter(Boolean));
    };
    fetchGroups();
  }, [user]);

  useEffect(() => {
    if (!isEdit || !id) return;
    supabase.from("flight_events").select("*").eq("id", id).single().then(({ data }) => {
      if (!data) return;
      const d = new Date(data.event_date);
      setForm({
        group_id: data.group_id,
        title: data.title,
        description: data.description || "",
        status: data.status,
        event_date: d.toISOString().split("T")[0],
        event_time: d.toTimeString().slice(0, 5),
        signup_deadline: data.signup_deadline ? new Date(data.signup_deadline).toISOString().split("T")[0] : "",
        event_type: data.event_type || "",
        meeting_point: data.meeting_point || "",
        instructor: data.instructor || "",
        launch_helper: data.launch_helper || "",
        max_participants: data.max_participants?.toString() || "",
      });
    });
  }, [isEdit, id]);

  const handleSave = async () => {
    if (!user || !form.title || !form.event_date || !form.group_id) {
      toast({ title: "Bitte Pflichtfelder ausfüllen", variant: "destructive" });
      return;
    }
    setLoading(true);
    const eventDate = new Date(`${form.event_date}T${form.event_time || "09:00"}`).toISOString();
    const payload = {
      group_id: form.group_id,
      title: form.title,
      description: form.description || null,
      status: form.status as any,
      event_date: eventDate,
      signup_deadline: form.signup_deadline ? new Date(form.signup_deadline).toISOString() : null,
      event_type: form.event_type || null,
      meeting_point: form.meeting_point || null,
      instructor: form.instructor || null,
      launch_helper: form.launch_helper || null,
      max_participants: form.max_participants ? parseInt(form.max_participants) : null,
      created_by: user.id,
    };

    if (isEdit) {
      const { created_by, ...updatePayload } = payload;
      const { error } = await supabase.from("flight_events").update(updatePayload).eq("id", id);
      if (error) toast({ title: "Fehler", description: error.message, variant: "destructive" });
      else { toast({ title: "Termin aktualisiert" }); navigate(`/events/${id}`); }
    } else {
      const { error } = await supabase.from("flight_events").insert(payload);
      if (error) toast({ title: "Fehler", description: error.message, variant: "destructive" });
      else { toast({ title: "Termin erstellt" }); navigate("/events"); }
    }
    setLoading(false);
  };

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="text-xl font-bold tracking-tight">{isEdit ? "Termin bearbeiten" : "Neuer Termin"}</h1>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Gruppe *</Label>
            <Select value={form.group_id} onValueChange={v => setForm({ ...form, group_id: v })}>
              <SelectTrigger><SelectValue placeholder="Gruppe wählen" /></SelectTrigger>
              <SelectContent>
                {groups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Titel *</Label>
            <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="z.B. Höhenflüge Niesen" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Datum *</Label>
              <Input type="date" value={form.event_date} onChange={e => setForm({ ...form, event_date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Uhrzeit</Label>
              <Input type="time" value={form.event_time} onChange={e => setForm({ ...form, event_time: e.target.value })} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="announced">Angekündigt</SelectItem>
                <SelectItem value="confirmed">Bestätigt</SelectItem>
                <SelectItem value="cancelled">Abgesagt</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Terminart</Label>
            <Input value={form.event_type} onChange={e => setForm({ ...form, event_type: e.target.value })} placeholder="z.B. Höhenflüge, Thermikflüge" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Treffpunkt</Label>
            <Input value={form.meeting_point} onChange={e => setForm({ ...form, meeting_point: e.target.value })} placeholder="z.B. Talstation Niesenbahn" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Fluglehrer</Label>
              <Input value={form.instructor} onChange={e => setForm({ ...form, instructor: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Starthelfer</Label>
              <Input value={form.launch_helper} onChange={e => setForm({ ...form, launch_helper: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Anmeldefrist</Label>
              <Input type="date" value={form.signup_deadline} onChange={e => setForm({ ...form, signup_deadline: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Max. Teilnehmer</Label>
              <Input type="number" value={form.max_participants} onChange={e => setForm({ ...form, max_participants: e.target.value })} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Beschreibung</Label>
            <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} />
          </div>

          <Button className="w-full" onClick={handleSave} disabled={loading}>
            {loading ? "..." : isEdit ? "Aktualisieren" : "Erstellen"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
