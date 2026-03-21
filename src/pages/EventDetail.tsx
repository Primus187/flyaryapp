import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calendar, MapPin, User, Users, Clock, CheckCircle2, XCircle, Pencil, Copy } from "lucide-react";

export default function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [event, setEvent] = useState<any>(null);
  const [signups, setSignups] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !user) return;
    const fetch = async () => {
      const { data: ev } = await supabase.from("flight_events").select("*, groups(name)").eq("id", id).single();
      if (!ev) { navigate("/events"); return; }
      setEvent(ev);

      const { data: sups } = await supabase.from("event_signups").select("*").eq("event_id", id);
      setSignups(sups || []);

      // Get member names
      const { data: members } = await supabase.from("group_members").select("user_id, role").eq("group_id", ev.group_id);
      if (members) {
        const me = members.find((m: any) => m.user_id === user.id);
        setIsAdmin(me?.role === "admin");
        const userIds = (sups || []).map((s: any) => s.user_id);
        if (userIds.length > 0) {
          const { data: profs } = await supabase.from("profiles").select("user_id, pilot_name").in("user_id", userIds);
          if (profs) {
            const map: Record<string, string> = {};
            profs.forEach((p: any) => { map[p.user_id] = p.pilot_name || "Unbekannt"; });
            setProfiles(map);
          }
        }
      }
      setLoading(false);
    };
    fetch();
  }, [id, user]);

  const toggleSignup = async () => {
    if (!user || !id) return;
    const existing = signups.find(s => s.user_id === user.id);
    if (existing) {
      const newVal = !existing.signed_up;
      await supabase.from("event_signups").update({ signed_up: newVal, updated_at: new Date().toISOString() }).eq("event_id", id).eq("user_id", user.id);
      setSignups(prev => prev.map(s => s.user_id === user.id ? { ...s, signed_up: newVal } : s));
    } else {
      await supabase.from("event_signups").insert({ event_id: id, user_id: user.id, signed_up: true });
      setSignups(prev => [...prev, { event_id: id, user_id: user.id, signed_up: true }]);
    }
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Laden...</div>;
  if (!event) return null;

  const isSignedUp = signups.find(s => s.user_id === user?.id)?.signed_up ?? false;
  const totalSignedUp = signups.filter(s => s.signed_up).length;
  const statusLabel = event.status === "confirmed" ? "Bestätigt" : event.status === "cancelled" ? "Abgesagt" : "Angekündigt";
  const statusVariant: "default" | "secondary" | "destructive" = event.status === "confirmed" ? "default" : event.status === "cancelled" ? "destructive" : "secondary";
  const isPast = new Date(event.event_date) < new Date();

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate("/events")}><ArrowLeft className="h-5 w-5" /></Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold tracking-tight">{event.title}</h1>
          <p className="text-xs text-muted-foreground">{event.groups?.name}</p>
        </div>
        <Badge variant={statusVariant}>{statusLabel}</Badge>
        {isAdmin && (
          <>
            <Button variant="ghost" size="icon" onClick={() => navigate(`/events/new?duplicate=${id}`)}>
              <Copy className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => navigate(`/events/${id}/edit`)}>
              <Pencil className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>

      {!isPast && event.status !== "cancelled" && (
        <Button
          className="w-full gap-2"
          variant={isSignedUp ? "default" : "outline"}
          onClick={toggleSignup}
        >
          {isSignedUp ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          {isSignedUp ? "Angemeldet — Abmelden?" : "Anmelden"}
        </Button>
      )}

      <div className="grid grid-cols-2 gap-3">
        <InfoCard icon={Calendar} label="Datum" value={new Date(event.event_date).toLocaleDateString("de-CH", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} />
        {event.event_type && <InfoCard icon={Calendar} label="Art" value={event.event_type} />}
        {event.meeting_point && <InfoCard icon={MapPin} label="Treffpunkt" value={event.meeting_point} />}
        {event.instructor && <InfoCard icon={User} label="Fluglehrer" value={event.instructor} />}
        {event.launch_helper && <InfoCard icon={User} label="Starthelfer" value={event.launch_helper} />}
        {event.signup_deadline && <InfoCard icon={Clock} label="Anmeldefrist" value={new Date(event.signup_deadline).toLocaleDateString("de-CH", { day: "numeric", month: "short", year: "numeric" })} />}
        <InfoCard icon={Users} label="Teilnehmer" value={`${totalSignedUp}${event.max_participants ? ` / ${event.max_participants}` : ""}`} />
      </div>

      {event.description && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3">
            <p className="text-sm whitespace-pre-wrap">{event.description}</p>
          </CardContent>
        </Card>
      )}

      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Teilnehmer</h2>
        {signups.filter(s => s.signed_up).length === 0 ? (
          <p className="text-sm text-muted-foreground">Noch keine Anmeldungen</p>
        ) : (
          <div className="space-y-1">
            {signups.filter(s => s.signed_up).map(s => (
              <Card key={s.user_id} className="border-0 shadow-sm">
                <CardContent className="p-2.5 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm">{profiles[s.user_id] || "Pilot"}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        {signups.filter(s => !s.signed_up).length > 0 && (
          <>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 mt-4">Abgemeldet</h2>
            <div className="space-y-1">
              {signups.filter(s => !s.signed_up).map(s => (
                <Card key={s.user_id} className="border-0 shadow-sm">
                  <CardContent className="p-2.5 flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm text-muted-foreground">{profiles[s.user_id] || "Pilot"}</span>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function InfoCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-3">
        <div className="flex items-center gap-1.5 mb-0.5">
          <Icon className="h-3.5 w-3.5 text-primary" />
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
        </div>
        <p className="text-sm font-medium">{value}</p>
      </CardContent>
    </Card>
  );
}
