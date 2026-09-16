import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calendar, MapPin, User, Users, Clock, CheckCircle2, XCircle, Pencil, Copy, MessageCircle, ImagePlus, Trash2, Share2, X, Mountain, BookOpen, Hourglass, ShieldCheck } from "lucide-react";
import EventChat from "@/components/EventChat";
import EventStaff from "@/components/EventStaff";
import EventProgram from "@/components/EventProgram";
import EventCarpools from "@/components/EventCarpools";
import EventPublishPreviewDialog from "@/components/EventPublishPreviewDialog";
import EventBriefingTasks from "@/components/EventBriefingTasks";
import EventStudentFlights from "@/components/EventStudentFlights";
import CoachDayView from "@/components/CoachDayView";
import StudentDayFeedback from "@/components/StudentDayFeedback";
import TelegramTextGenerator from "@/components/TelegramTextGenerator";
import { compressImage } from "@/lib/image-compress";
import { useToast } from "@/hooks/use-toast";

export default function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [event, setEvent] = useState<any>(null);
  const [signups, setSignups] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [isStaff, setIsStaff] = useState(false);
  const [isCreator, setIsCreator] = useState(false);
  const [loading, setLoading] = useState(true);
  const [photos, setPhotos] = useState<{ id: string; url: string; storage_path: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [pilotName, setPilotName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [groupName, setGroupName] = useState("");
  const [briefingTasks, setBriefingTasks] = useState<any[]>([]);
  const [maneuverNames, setManeuverNames] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const locale = i18n.language === "fr" ? "fr-CH" : i18n.language === "en" ? "en-GB" : "de-CH";

  useEffect(() => {
    if (!id || !user) return;
    const fetchData = async () => {
      const { data: ev } = await supabase.from("flight_events").select("*, groups(name)").eq("id", id).single();
      if (!ev) { navigate("/events"); return; }
      setEvent(ev);
      setGroupName(ev.groups?.name || "");
      setIsCreator(ev.created_by === user.id);

      const { data: sups } = await supabase.from("event_signups").select("*").eq("event_id", id);
      setSignups(sups || []);

      const { data: members } = await supabase.from("group_members").select("user_id, role").eq("group_id", ev.group_id);
      if (members) {
        const me = members.find((m: any) => m.user_id === user.id);
        setIsAdmin(me?.role === "admin");
        const { data: myFuncs } = await supabase.from("group_member_functions" as any).select("function").eq("group_id", ev.group_id).eq("user_id", user.id);
        const staffRoles = ((myFuncs as any[]) || []).map((f) => f.function);
        setIsStaff(me?.role === "admin" || staffRoles.includes("instructor") || staffRoles.includes("school_lead"));
        const allUserIds = [...new Set([...(sups || []).map((s: any) => s.user_id), ...members.map(m => m.user_id)])];
        if (allUserIds.length > 0) {
          const { data: profs } = await supabase.from("profiles").select("user_id, pilot_name").in("user_id", allUserIds);
          if (profs) {
            const map: Record<string, string> = {};
            profs.forEach((p: any) => { map[p.user_id] = p.pilot_name || t("common.unknown"); });
            setProfiles(map);
          }
        }
      }

      // Load own profile
      const { data: myProf } = await supabase.from("profiles").select("pilot_name, avatar_url").eq("user_id", user.id).single();
      if (myProf) {
        setPilotName(myProf.pilot_name || "Pilot");
        if (myProf.avatar_url) {
          if (myProf.avatar_url.startsWith("http")) setAvatarUrl(myProf.avatar_url);
          else {
            const { data: signed } = await supabase.storage.from("flight-photos").createSignedUrl(myProf.avatar_url, 3600);
            if (signed?.signedUrl) setAvatarUrl(signed.signedUrl);
          }
        }
      }

      // Load briefing tasks
      const { data: tasks } = await supabase.from("event_briefing_tasks" as any).select("*").eq("event_id", id).order("sort_order" as any);
      if (tasks) setBriefingTasks(tasks as any[]);

      // Load planned maneuvers
      const { data: maneuvers } = await supabase.from("event_maneuvers" as any).select("training_item_id").eq("event_id", id);
      if (maneuvers && (maneuvers as any[]).length > 0) {
        const itemIds = (maneuvers as any[]).map((m: any) => m.training_item_id);
        const { data: items } = await supabase.from("training_items").select("id, name").in("id", itemIds);
        if (items) setManeuverNames(items.map(i => i.name));
      }

      await loadPhotos(id);
      setLoading(false);
    };
    fetchData();
  }, [id, user]);

  const loadPhotos = async (eventId: string) => {
    const { data: photoRows } = await supabase.from("event_photos").select("id, storage_path").eq("event_id", eventId);
    if (photoRows && photoRows.length > 0) {
      const paths = photoRows.map(p => p.storage_path);
      const { data: signedUrls } = await supabase.storage.from("flight-photos").createSignedUrls(paths, 3600);
      const urlMap: Record<string, string> = {};
      signedUrls?.forEach(s => { if (s.signedUrl) urlMap[s.path] = s.signedUrl; });
      setPhotos(photoRows.map(p => ({ id: p.id, url: urlMap[p.storage_path] || "", storage_path: p.storage_path })));
    } else { setPhotos([]); }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !user || !id) return;
    setUploading(true);
    try {
      for (const file of Array.from(e.target.files)) {
        const compressed = await compressImage(file);
        const path = `events/${user.id}/${id}/${Date.now()}_${compressed.name}`;
        const { error: uploadError } = await supabase.storage.from("flight-photos").upload(path, compressed);
        if (uploadError) { toast({ title: t("flights.photoUploadFailed"), variant: "destructive" }); continue; }
        await supabase.from("event_photos").insert({ event_id: id, storage_path: path });
      }
      await loadPhotos(id);
      toast({ title: t("flights.photoAdded") });
    } finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
  };

  const handleDeletePhoto = async (photoId: string, storagePath: string) => {
    await supabase.storage.from("flight-photos").remove([storagePath]);
    await supabase.from("event_photos").delete().eq("id", photoId);
    setPhotos(prev => prev.filter(p => p.id !== photoId));
    toast({ title: t("flights.photoDeleted") });
  };

  const handlePublish = async (selectedPhotoIds: string[], feedDescription: string) => {
    if (!id) return;
    setPublishing(true);
    await supabase.from("flight_events").update({ published_to_feed: true, published_at: new Date().toISOString(), feed_description: feedDescription || null } as any).eq("id", id);
    setEvent((prev: any) => ({ ...prev, published_to_feed: true, published_at: new Date().toISOString(), feed_description: feedDescription }));
    setPublishing(false); setShowPreview(false);
    toast({ title: t("events.publishedToFeed") });
  };

  const handleUnpublish = async () => {
    if (!id) return;
    await supabase.from("flight_events").update({ published_to_feed: false, published_at: null } as any).eq("id", id);
    setEvent((prev: any) => ({ ...prev, published_to_feed: false, published_at: null }));
    toast({ title: t("events.unpublishedFromFeed") });
  };

  const refetchSignups = async () => {
    if (!id) return;
    const { data: sups } = await supabase.from("event_signups").select("*").eq("event_id", id);
    setSignups(sups || []);
  };

  const toggleSignup = async () => {
    if (!user || !id) return;
    const existing = signups.find(s => s.user_id === user.id);
    let error: any = null;
    if (existing) {
      const newVal = !existing.signed_up;
      ({ error } = await supabase.from("event_signups").update({ signed_up: newVal, updated_at: new Date().toISOString() }).eq("event_id", id).eq("user_id", user.id));
    } else {
      ({ error } = await supabase.from("event_signups").insert({ event_id: id, user_id: user.id, signed_up: true }));
    }
    if (error) {
      toast({ title: t("common.error"), description: error.message.includes("deadline") ? t("events.deadlinePassed") : error.message, variant: "destructive" });
      return;
    }
    await refetchSignups();
  };

  const toggleSchoolConfirm = async (signup: any) => {
    if (!id) return;
    await supabase.from("event_signups").update({ confirmed_by_school: !signup.confirmed_by_school, updated_at: new Date().toISOString() } as any).eq("id", signup.id);
    await refetchSignups();
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">{t("common.loading")}</div>;
  if (!event) return null;

  const mySignup = signups.find(s => s.user_id === user?.id);
  const isSignedUp = mySignup?.signed_up ?? false;
  const myWaitlist = isSignedUp && mySignup?.status === "waitlist";
  const confirmedSignups = signups.filter(s => s.signed_up && s.status !== "waitlist");
  const waitlistSignups = signups.filter(s => s.signed_up && s.status === "waitlist");
  const totalSignedUp = confirmedSignups.length;
  const deadlinePassed = !!event.signup_deadline && new Date(event.signup_deadline) < new Date();
  const statusLabel = event.status === "confirmed" ? t("events.statusConfirmed") : event.status === "cancelled" ? t("events.statusCancelled") : t("events.statusAnnounced");
  const statusColor = event.status === "confirmed" ? "bg-green-100 text-green-800 hover:bg-green-100/80 dark:bg-green-900/30 dark:text-green-400" : event.status === "cancelled" ? "bg-red-100 text-red-800 hover:bg-red-100/80 dark:bg-red-900/30 dark:text-red-400" : "bg-blue-100 text-blue-800 hover:bg-blue-100/80 dark:bg-blue-900/30 dark:text-blue-400";
  const isPast = new Date(event.event_date) < new Date();

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate("/events")}><ArrowLeft className="h-5 w-5" /></Button>
        <div className="flex-1"><h1 className="text-xl font-bold tracking-tight">{event.title}</h1><p className="text-xs text-muted-foreground">{groupName}</p></div>
        <Badge className={statusColor}>{statusLabel}</Badge>
        {event.event_category && (
          <Badge variant="secondary">{t(`events.categories.${event.event_category}`, { defaultValue: event.event_category })}</Badge>
        )}
        {isAdmin && (
          <>
            <Button variant="ghost" size="icon" onClick={() => navigate(`/events/new?duplicate=${id}`)}><Copy className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" onClick={() => navigate(`/events/${id}/edit`)}><Pencil className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={async () => {
              if (!confirm(t("events.deleteEventConfirm"))) return;
              await supabase.from("event_signups").delete().eq("event_id", id!);
              await supabase.from("event_briefing_tasks").delete().eq("event_id", id!);
              await supabase.from("event_maneuvers").delete().eq("event_id", id!);
              await supabase.from("event_messages").delete().eq("event_id", id!);
              await supabase.from("student_day_notes").delete().eq("event_id", id!);
              await supabase.from("event_photos").delete().eq("event_id", id!);
              await supabase.from("flight_events").delete().eq("id", id!);
              toast({ title: t("events.eventDeleted") });
              navigate("/events");
            }}><Trash2 className="h-4 w-4" /></Button>
          </>
        )}
      </div>

      {!isPast && event.status !== "cancelled" && (
        <>
          <Button
            className={`w-full gap-2 ${isSignedUp && !myWaitlist ? "bg-green-600 hover:bg-green-700" : ""}`}
            variant={isSignedUp ? "default" : "outline"}
            onClick={toggleSignup}
            disabled={!isSignedUp && deadlinePassed}
          >
            {myWaitlist ? <Hourglass className="h-4 w-4" /> : isSignedUp ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            {myWaitlist
              ? t("events.onWaitlist", { position: mySignup?.waitlist_position || "?" })
              : isSignedUp
                ? t("events.signedUpAction")
                : deadlinePassed
                  ? t("events.deadlinePassed")
                  : t("events.signUp")}
          </Button>
          {isSignedUp && mySignup?.confirmed_by_school && (
            <p className="text-xs text-center text-green-600 dark:text-green-400 flex items-center justify-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5" /> {t("events.confirmedBySchool")}
            </p>
          )}
        </>
      )}

      {event.chat_link && <Button variant="outline" className="w-full gap-2" asChild><a href={event.chat_link} target="_blank" rel="noopener noreferrer"><MessageCircle className="h-4 w-4" />{t("events.openGroupChat")}</a></Button>}

      {/* Telegram text copy - only for admins */}
      {isAdmin && (
        <TelegramTextGenerator event={event} profiles={profiles} briefingTasks={briefingTasks} maneuverNames={maneuverNames} />
      )}

      {/* Photos section */}
      {isCreator && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("events.photos")}</h2>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              <ImagePlus className="h-3.5 w-3.5" />{t("events.addPhotos")}
            </Button>
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
          </div>
          {photos.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {photos.map(p => (
                <div key={p.id} className="relative group aspect-square">
                  <img src={p.url} alt="" className="w-full h-full object-cover rounded-lg" />
                  <button onClick={() => handleDeletePhoto(p.id, p.storage_path)}
                    className="absolute top-1 right-1 bg-destructive/80 text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Publish to feed */}
      {isCreator && (
        <div className="flex gap-2">
          {!event.published_to_feed ? (
            <Button variant="outline" className="flex-1 gap-2" onClick={() => setShowPreview(true)}>
              <Share2 className="h-4 w-4" />{t("events.publishToFeed")}
            </Button>
          ) : (
            <Button variant="outline" className="flex-1 gap-2 text-destructive" onClick={handleUnpublish}>
              <X className="h-4 w-4" />{t("events.unpublishFromFeed")}
            </Button>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <InfoCard icon={Calendar} label={t("events.date")} value={new Date(event.event_date).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" })} />
        <InfoCard icon={Clock} label={t("events.time")} value={new Date(event.event_date).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })} />
        {event.event_type && <InfoCard icon={Calendar} label={t("events.eventTypeLabel")} value={event.event_type} />}
        {event.meeting_point && <InfoCard icon={MapPin} label={t("events.meetingPoint")} value={event.meeting_point} />}
        {event.flight_area && <InfoCard icon={Mountain} label={t("events.flightArea")} value={event.flight_area} />}
        {event.day_topic && <InfoCard icon={BookOpen} label={t("events.dayTopic")} value={event.day_topic} />}
        {event.instructor && <InfoCard icon={User} label={t("events.instructor")} value={event.instructor} />}
        {event.launch_helper && <InfoCard icon={User} label={t("events.launchHelper")} value={event.launch_helper} />}
        {event.signup_deadline && <InfoCard icon={Clock} label={t("events.signupDeadline")} value={new Date(event.signup_deadline).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })} />}
        <InfoCard icon={Users} label={t("events.participants")} value={`${totalSignedUp}${event.max_participants ? ` / ${event.max_participants}` : ""}`} />
      </div>

      {/* Departure info */}
      {event.departure_info && (
        <Card className="border-0 shadow-sm"><CardContent className="p-3"><h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{t("events.departureInfo")}</h3><p className="text-sm whitespace-pre-wrap">{event.departure_info}</p></CardContent></Card>
      )}

      {event.description && <Card className="border-0 shadow-sm"><CardContent className="p-3"><p className="text-sm whitespace-pre-wrap">{event.description}</p></CardContent></Card>}

      {/* Flight prep notes */}
      {event.flight_prep_notes && (
        <Card className="border-0 shadow-sm"><CardContent className="p-3"><h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{t("events.flightPrep")}</h3><p className="text-sm whitespace-pre-wrap">{event.flight_prep_notes}</p></CardContent></Card>
      )}

      {/* Briefing tasks & maneuvers */}
      <EventBriefingTasks tasks={briefingTasks} profiles={profiles} maneuverNames={maneuverNames} />

      {/* Participants */}
      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t("events.participants")}</h2>
        {signups.filter(s => s.signed_up).length === 0 ? <p className="text-sm text-muted-foreground">{t("events.noSignups")}</p> : (
          <div className="space-y-1">{signups.filter(s => s.signed_up).map(s => (<Card key={s.user_id} className="border-0 shadow-sm"><CardContent className="p-2.5 flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary shrink-0" /><span className="text-sm">{profiles[s.user_id] || t("events.pilot")}</span></CardContent></Card>))}</div>
        )}
        {signups.filter(s => !s.signed_up).length > 0 && (
          <><h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 mt-4">{t("events.unregistered")}</h2><div className="space-y-1">{signups.filter(s => !s.signed_up).map(s => (<Card key={s.user_id} className="border-0 shadow-sm"><CardContent className="p-2.5 flex items-center gap-2"><XCircle className="h-4 w-4 text-muted-foreground shrink-0" /><span className="text-sm text-muted-foreground">{profiles[s.user_id] || t("events.pilot")}</span></CardContent></Card>))}</div></>
        )}
      </div>

      {/* Student flights - admin only (simple view) */}
      <EventStudentFlights eventId={id!} eventDate={event.event_date} groupId={event.group_id} isAdmin={isAdmin} />

      {/* Coach batch evaluation - admin only */}
      {isAdmin && (
        <CoachDayView eventId={id!} eventDate={event.event_date} groupId={event.group_id} />
      )}

      {/* Student feedback view - non-admin only */}
      {!isAdmin && (
        <StudentDayFeedback eventId={id!} />
      )}

      <EventChat eventId={id!} groupId={event.group_id} />

      <EventPublishPreviewDialog open={showPreview} onOpenChange={setShowPreview} onPublish={handlePublish} event={event} pilotName={pilotName} avatarUrl={avatarUrl} groupName={groupName} photos={photos.map(p => ({ id: p.id, url: p.url }))} loading={publishing} />
    </div>
  );
}

function InfoCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return <Card className="border-0 shadow-sm"><CardContent className="p-3"><div className="flex items-center gap-1.5 mb-0.5"><Icon className="h-3.5 w-3.5 text-primary" /><span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span></div><p className="text-sm font-medium">{value}</p></CardContent></Card>;
}
