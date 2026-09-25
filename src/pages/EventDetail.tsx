import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ArrowLeft, Calendar, MapPin, User, Users, Clock, CheckCircle2, XCircle, Pencil, Copy, ImagePlus, Trash2, Share2, X, Mountain, BookOpen, Hourglass, ShieldCheck, AlertTriangle, MoreHorizontal, ChevronDown } from "lucide-react";
import EventChannel from "@/components/chat/EventChannel";
import EventStaff from "@/components/EventStaff";
import EventProgram from "@/components/EventProgram";
import EventCarpools from "@/components/EventCarpools";
import EquipmentQuotaHint from "@/components/school/EquipmentQuotaHint";
import StudentEquipmentHint from "@/components/school/StudentEquipmentHint";
import IncidentReportDialog from "@/components/school/IncidentReportDialog";
import AlternativeDateSuggestion from "@/components/school/AlternativeDateSuggestion";
import EventPublishPreviewDialog from "@/components/EventPublishPreviewDialog";
import EventBriefingTasks from "@/components/EventBriefingTasks";
import DayCheckIn from "@/components/flightday/DayCheckIn";
import FlightDayStations from "@/components/flightday/FlightDayStations";
import LegacyCoachNotes from "@/components/flightday/LegacyCoachNotes";
import { opensOnFlightDay, type FlightDayRole } from "@/lib/flight-day";
import StudentDayFeedback from "@/components/StudentDayFeedback";
import EventAnnounceDialog from "@/components/EventAnnounceDialog";
import EmergencyInfoDialog from "@/components/EmergencyInfoDialog";
import { compressImage } from "@/lib/image-compress";
import { getSignedUrls } from "@/lib/signed-url-cache";
import { useToast } from "@/hooks/use-toast";
import { useActiveStudents } from "@/hooks/use-active-students";

export default function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { hash } = useLocation();
  // ?tab=… keeps the open tab on reload/back; #coaching (student dossier) and the former
  // ?tab=coaching now lead to the flying day tab.
  const rawTab = searchParams.get("tab") || (hash === "#coaching" ? "day" : null);
  const requestedTab = rawTab === "coaching" ? "day" : rawTab;
  const [dayRole, setDayRole] = useState<FlightDayRole | null>(null);
  const [event, setEvent] = useState<any>(null);
  const [signups, setSignups] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [isStaff, setIsStaff] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  // The day team (launch helpers included, migration 0062) hides students whose training is paused or cancelled.
  const inactive = useActiveStudents(event?.group_id, (isStaff || dayRole !== null) && event?.groups?.group_type === "school");
  const [isStudent, setIsStudent] = useState(false);
  const [isCreator, setIsCreator] = useState(false);
  const [loading, setLoading] = useState(true);
  const [photos, setPhotos] = useState<{ id: string; url: string; storage_path: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [incidentDialogOpen, setIncidentDialogOpen] = useState(false);
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
    // One RPC (RLS-checked, see migration 0019) instead of ~11 sequential requests; avatar and
    // photos are then signed in a single parallel step.
    const fetchData = async () => {
      const { data, error } = await supabase.rpc("event_detail_data", { _event_id: id });
      const detail = data as any; // eslint-disable-line @typescript-eslint/no-explicit-any -- untyped RPC payload
      if (error || !detail?.event) { navigate("/events"); return; }
      const ev = detail.event;
      setEvent(ev);
      setGroupName(ev.groups?.name || "");
      setIsCreator(ev.created_by === user.id);
      setSignups(detail.signups || []);
      // Role on this flying day (instructor / launch helper, also via the event's staff list).
      if (ev.groups?.group_type === "school") {
        const { data: role } = await supabase.rpc("flight_day_role", { _user_id: user.id, _event_id: id });
        setDayRole(role === "instructor" || role === "helper" ? role : null);
      }

      const members: { user_id: string; role: string }[] = detail.members || [];
      const me = members.find(m => m.user_id === user.id);
      const staffRoles: string[] = detail.myFunctions || [];
      setIsAdmin(me?.role === "admin");
      setIsStudent(ev.groups?.group_type === "school" && (staffRoles.includes("student") || (staffRoles.length === 0 && me?.role === "member")));
      setIsStaff(me?.role === "admin" || staffRoles.includes("instructor") || staffRoles.includes("school_lead"));
      const map: Record<string, string> = {};
      Object.entries((detail.profiles || {}) as Record<string, string | null>).forEach(([uid, name]) => { map[uid] = name || t("common.unknown"); });
      setProfiles(map);
      setBriefingTasks(detail.briefingTasks || []);
      setManeuverNames(detail.maneuverNames || []);

      const photoRows: { id: string; storage_path: string }[] = detail.photos || [];
      const myAvatar: string = detail.me?.avatar_url || "";
      const toSign = [...photoRows.map(p => p.storage_path), ...(myAvatar && !myAvatar.startsWith("http") ? [myAvatar] : [])];
      const signed = await getSignedUrls("flight-photos", toSign);
      setPilotName(detail.me?.pilot_name || "Pilot");
      setAvatarUrl(myAvatar.startsWith("http") ? myAvatar : signed[myAvatar] || "");
      setPhotos(photoRows.map(p => ({ id: p.id, url: signed[p.storage_path] || "", storage_path: p.storage_path })));
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
    let added = 0;
    let failed = 0;
    try {
      for (const file of Array.from(e.target.files)) {
        const compressed = await compressImage(file);
        // Own folder first: storage only accepts uploads under <user id>/ (migration 0061).
        const path = `${user.id}/events/${id}/${Date.now()}_${compressed.name}`;
        const { error: uploadError } = await supabase.storage.from("flight-photos").upload(path, compressed);
        if (uploadError) { failed++; continue; }
        const { error: rowError } = await supabase.from("event_photos").insert({ event_id: id, storage_path: path });
        // Without its row the file would stay invisible and orphaned.
        if (rowError) { failed++; await supabase.storage.from("flight-photos").remove([path]); continue; }
        added++;
      }
      await loadPhotos(id);
      if (failed > 0) toast({ title: t("flights.photoUploadFailed"), variant: "destructive" });
      if (added > 0) toast({ title: t("flights.photoAdded") });
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
    void queryClient.invalidateQueries({ queryKey: ["dashboard", user.id] });
    await refetchSignups();
  };

  const toggleSchoolConfirm = async (signup: any) => {
    if (!id) return;
    // RPC: RLS only lets people update their own signup, so the direct UPDATE was silently ignored.
    const { error } = await supabase.rpc("set_signup_confirmed", { _event_id: id, _student_id: signup.user_id, _confirmed: !signup.confirmed_by_school });
    if (error) { toast({ title: t("common.error"), description: error.message, variant: "destructive" }); return; }
    await refetchSignups();
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">{t("common.loading")}</div>;
  if (!event) return null;

  const mySignup = signups.find(s => s.user_id === user?.id);
  const isSignedUp = mySignup?.signed_up ?? false;
  const myWaitlist = isSignedUp && mySignup?.status === "waitlist";
  const confirmedSignups = signups.filter(s => s.signed_up && s.status !== "waitlist");
  const waitlistSignups = signups.filter(s => s.signed_up && s.status === "waitlist");
  const activeDay = event && new Date(event.event_date) >= new Date(new Date().setHours(0, 0, 0, 0)) && event.status !== "cancelled";
  const hideInactive = activeDay && (isStaff || dayRole !== null) && event?.groups?.group_type === "school" && !showInactive;
  const activeListReady = !hideInactive || (!inactive.isPending && !inactive.isError);
  const visibleConfirmed = activeListReady ? confirmedSignups.filter(s => !hideInactive || !inactive.data?.includes(s.user_id)) : [];
  const visibleWaitlist = activeListReady ? waitlistSignups.filter(s => !hideInactive || !inactive.data?.includes(s.user_id)) : [];
  const totalSignedUp = confirmedSignups.length;
  const deadlinePassed = !!event.signup_deadline && new Date(event.signup_deadline) < new Date();
  const statusLabel = event.status === "confirmed" ? t("events.statusConfirmed") : event.status === "cancelled" ? t("events.statusCancelled") : t("events.statusAnnounced");
  const statusColor = event.status === "confirmed" ? "bg-green-100 text-green-800 hover:bg-green-100/80 dark:bg-green-900/30 dark:text-green-400" : event.status === "cancelled" ? "bg-red-100 text-red-800 hover:bg-red-100/80 dark:bg-red-900/30 dark:text-red-400" : "bg-blue-100 text-blue-800 hover:bg-blue-100/80 dark:bg-blue-900/30 dark:text-blue-400";
  const isPast = new Date(event.event_date) < new Date();

  const isSchool = event.groups?.group_type === "school";
  const isHeight = event.event_category === "height_flight";
  const eventDay = new Date(event.event_date);
  const multiDay = !!event.end_date && event.end_date !== event.event_date.slice(0, 10);
  const dateLabel = multiDay
    ? `${eventDay.toLocaleDateString(locale, { day: "numeric", month: "short" })} – ${new Date(event.end_date + "T00:00:00").toLocaleDateString(locale, { day: "numeric", month: "short" })}`
    : `${eventDay.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" })} · ${eventDay.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}`;
  const canSignUp = !isPast && event.status !== "cancelled";
  const canChangeStatus = isStaff || isAdmin;
  // Tabs: students and members see what concerns them; planning is for school staff, the flying
  // day (check-in, coaching) for the day's team including launch helpers.
  const showDayTab = isSchool && dayRole !== null;
  const tabs = [
    "overview",
    "participants",
    ...(isStaff ? ["planning"] : []),
    ...(showDayTab ? ["day"] : []),
    ...(isStudent && isPast ? ["feedback"] : []),
    "chat",
  ];
  // On the day of the event the team lands directly on the flying day.
  const defaultTab = showDayTab && opensOnFlightDay(event.event_date, new Date(), dayRole) ? "day" : "overview";
  const activeTab = requestedTab && tabs.includes(requestedTab) ? requestedTab : defaultTab;
  const selectTab = (tab: string) => {
    const next = new URLSearchParams(searchParams);
    if (tab === defaultTab) next.delete("tab"); else next.set("tab", tab);
    setSearchParams(next, { replace: true });
  };
  const presenceLabel = (s: { presence?: string | null }) => s.presence === "present" ? t("flightDay.status.present") : s.presence === "absent" ? t("flightDay.status.absent") : null;
  const changeStatus = async (next: "announced" | "confirmed" | "cancelled") => {
    if (next === event.status) return;
    if (next === "cancelled" && !confirm(t("events.cancelEventConfirm"))) return;
    // RPC: school staff (not only admins) may change the status, and a refusal is reported.
    const { error } = await supabase.rpc("set_event_status", { _event_id: id, _status: next });
    if (error) { toast({ title: t("common.error"), description: error.message, variant: "destructive" }); return; }
    setEvent((prev: any) => ({ ...prev, status: next }));
    toast({ title: t("events.statusChanged") });
  };
  const facts = [
    { icon: MapPin, label: t("events.meetingPoint"), value: event.meeting_point },
    { icon: Calendar, label: t("events.date"), value: multiDay ? dateLabel : null },
    { icon: Mountain, label: t("events.flightArea"), value: event.flight_area },
    { icon: BookOpen, label: t("events.dayTopic"), value: event.day_topic },
    { icon: User, label: t("events.instructor"), value: event.instructor },
    { icon: User, label: t("events.launchHelper"), value: event.launch_helper },
    { icon: Calendar, label: t("events.eventTypeLabel"), value: event.event_type },
  ].filter((d) => d.value);
  const statusOptions = [
    { value: "announced" as const, label: t("events.statusAnnounced") },
    { value: "confirmed" as const, label: t("events.statusConfirmed") },
    { value: "cancelled" as const, label: t("events.statusCancelled") },
  ];
  const statusBadge = <Badge className={`${statusColor} text-[10px] px-1.5 py-0 gap-0.5`}>{statusLabel}{canChangeStatus && <ChevronDown className="h-3 w-3" />}</Badge>;

  const participantRow = (s: any) => (
    <div key={s.user_id} className="flex items-center gap-2 py-2">
      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
      <span className="text-sm flex-1 truncate">{profiles[s.user_id] || t("events.pilot")}</span>
      {showDayTab && presenceLabel(s) && (
        <Badge variant={s.presence === "present" ? "secondary" : "outline"} className="text-[9px] px-1.5 py-0 h-4 shrink-0">{presenceLabel(s)}</Badge>
      )}
      {s.confirmed_by_school && <ShieldCheck className="h-4 w-4 text-green-600 shrink-0" />}
      {isStaff && <EmergencyInfoDialog eventId={id!} userId={s.user_id} pilotName={profiles[s.user_id] || t("events.pilot")} />}
      {isStaff && (
        <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 shrink-0" onClick={() => toggleSchoolConfirm(s)}>
          {s.confirmed_by_school ? t("events.unconfirm") : t("events.confirm")}
        </Button>
      )}
    </div>
  );

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto space-y-3">
      {/* Header: title, one compact meta line; admin actions in one menu */}
      <div className="flex items-start gap-1">
        <Button variant="ghost" size="icon" className="shrink-0 -ml-2" onClick={() => navigate("/events")}><ArrowLeft className="h-5 w-5" /></Button>
        <div className="flex-1 min-w-0 pt-1">
          <h1 className="text-xl font-bold tracking-tight leading-tight">{event.title}</h1>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{dateLabel}</span>
            {canChangeStatus ? (
              // School staff set the day's status directly (announced → confirmed / cancelled).
              <DropdownMenu>
                <DropdownMenuTrigger aria-label={t("events.changeStatus")}>{statusBadge}</DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {statusOptions.map((o) => (
                    <DropdownMenuItem key={o.value} onClick={() => void changeStatus(o.value)}>
                      <CheckCircle2 className={`h-4 w-4 mr-2 ${o.value === event.status ? "text-primary" : "opacity-0"}`} />{o.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : statusBadge}
            {event.event_category && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{t(`events.categories.${event.event_category}`, { defaultValue: event.event_category })}</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">{groupName}</p>
        </div>
        {(isAdmin || isCreator || (isStaff && isSchool)) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0" aria-label={t("events.moreActions")}><MoreHorizontal className="h-5 w-5" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {isAdmin && <DropdownMenuItem onClick={() => navigate(`/events/${id}/edit`)}><Pencil className="h-4 w-4 mr-2" />{t("common.edit")}</DropdownMenuItem>}
              {isAdmin && <DropdownMenuItem onClick={() => navigate(`/events/new?duplicate=${id}`)}><Copy className="h-4 w-4 mr-2" />{t("events.duplicate")}</DropdownMenuItem>}
              {isCreator && <DropdownMenuItem onClick={() => fileInputRef.current?.click()} disabled={uploading}><ImagePlus className="h-4 w-4 mr-2" />{t("events.addPhotos")}</DropdownMenuItem>}
              {isCreator && (!event.published_to_feed
                ? <DropdownMenuItem onClick={() => setShowPreview(true)}><Share2 className="h-4 w-4 mr-2" />{t("events.publishToFeed")}</DropdownMenuItem>
                : <DropdownMenuItem onClick={handleUnpublish}><X className="h-4 w-4 mr-2" />{t("events.unpublishFromFeed")}</DropdownMenuItem>)}
              {isStaff && isSchool && <DropdownMenuItem onClick={() => setIncidentDialogOpen(true)}><AlertTriangle className="h-4 w-4 mr-2" />{t("school.safety.reportForEvent")}</DropdownMenuItem>}
              {isAdmin && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={async () => {
                    if (!confirm(t("events.deleteEventConfirm"))) return;
                    // Child rows (signups, chat, briefing, day notes, photos) cascade in the database;
                    // deleting them one by one first lost them whenever the event delete itself failed.
                    const { error: deleteError } = await supabase.from("flight_events").delete().eq("id", id!);
                    if (deleteError) {
                      toast({ title: t("common.error"), description: deleteError.message, variant: "destructive" });
                      return;
                    }
                    toast({ title: t("events.eventDeleted") });
                    navigate("/events");
                  }}><Trash2 className="h-4 w-4 mr-2" />{t("common.delete")}</DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
      </div>

      {/* Sign-up strip: participants, deadline and the pilot's own action in one row */}
      {canSignUp && (
        <div className="flex items-center gap-3 rounded-xl bg-card shadow-sm px-3 py-2.5">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium flex items-center gap-1.5">
              <Users className="h-4 w-4 text-primary" />{totalSignedUp}{event.max_participants ? ` / ${event.max_participants}` : ""} {t("events.signedUpShort")}
            </p>
            {(event.signup_deadline || (isSignedUp && mySignup?.confirmed_by_school)) && (
              <p className="text-[11px] text-muted-foreground truncate">
                {isSignedUp && mySignup?.confirmed_by_school
                  ? <span className="text-green-600 dark:text-green-400">{t("events.confirmedBySchool")}</span>
                  : `${t("events.signupDeadline")}: ${new Date(event.signup_deadline).toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" })}`}
              </p>
            )}
          </div>
          <Button
            size="sm"
            className={`shrink-0 gap-1.5 ${isSignedUp && !myWaitlist ? "bg-green-600 hover:bg-green-700" : ""}`}
            variant={isSignedUp ? "default" : "outline"}
            onClick={toggleSignup}
            disabled={!isSignedUp && deadlinePassed}
          >
            {myWaitlist ? <Hourglass className="h-4 w-4" /> : isSignedUp ? <CheckCircle2 className="h-4 w-4" /> : null}
            {myWaitlist
              ? t("events.onWaitlist", { position: mySignup?.waitlist_position || "?" })
              : isSignedUp
                ? t("events.signedUpAction")
                : deadlinePassed
                  ? t("events.deadlinePassed")
                  : t("events.signUp")}
          </Button>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={selectTab}>
        {/* Underlined tab bar, stays visible while scrolling */}
        <TabsList className="sticky top-0 z-20 w-full h-auto justify-start gap-5 rounded-none border-b bg-background/95 backdrop-blur p-0 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => (
            <TabsTrigger key={tab} value={tab}
              className="relative shrink-0 rounded-none border-b-2 border-transparent bg-transparent px-0.5 pb-2.5 pt-2 text-sm font-medium text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none">
              {t(`events.tabs.${tab}`)}
              {tab === "participants" && totalSignedUp > 0 && (
                <span className="ml-1.5 rounded-full bg-muted px-1.5 py-px text-[10px] text-muted-foreground">{totalSignedUp}</span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Overview: the facts of the day (once), then briefing, programme, travel, folded prep */}
        <TabsContent value="overview" className="space-y-3 mt-3">
          {isStaff && event.status === "cancelled" && isSchool && (
            <AlternativeDateSuggestion eventId={id!} groupId={event.group_id} eventDate={event.event_date} />
          )}
          {isPast && event.status !== "cancelled" && <p className="text-xs text-muted-foreground">{t("events.pastEvent")}</p>}
          {isStudent && isHeight && canSignUp && user && (
            <StudentEquipmentHint key={`${event.group_id}:${user.id}`} groupId={event.group_id} studentUserId={user.id} />
          )}
          {facts.length > 0 && (
            <Card className="border-0 shadow-sm"><CardContent className="p-0 divide-y">
              {facts.map((d) => (
                <div key={d.label} className="flex items-start gap-3 px-3 py-2.5">
                  <d.icon className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1"><p className="text-[11px] text-muted-foreground">{d.label}</p><p className="text-sm whitespace-pre-line">{d.value}</p></div>
                </div>
              ))}
            </CardContent></Card>
          )}
          {event.description && <p className="text-sm whitespace-pre-wrap px-1">{event.description}</p>}
          <EventBriefingTasks tasks={briefingTasks} profiles={profiles} maneuverNames={maneuverNames} />
          {!isStaff && <EventProgram eventId={id!} eventDate={event.event_date} endDate={event.end_date || null} canManage={false} />}
          {event.departure_info && (
            <Card className="border-0 shadow-sm"><CardContent className="p-3"><h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{t("events.departureInfo")}</h3><p className="text-sm whitespace-pre-wrap">{event.departure_info}</p></CardContent></Card>
          )}
          <EventCarpools eventId={id!} isSignedUp={isSignedUp} />
          {event.flight_prep_notes && (
            <Collapsible className="rounded-lg bg-card shadow-sm">
              <CollapsibleTrigger className="flex w-full items-center justify-between p-3 text-left group">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("events.flightPrep")}</span>
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent className="px-3 pb-3"><p className="text-sm whitespace-pre-wrap">{event.flight_prep_notes}</p></CollapsibleContent>
            </Collapsible>
          )}
          {isCreator && photos.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("events.photos")}</h2>
              <div className="grid grid-cols-3 gap-2">
                {photos.map(p => (
                  <div key={p.id} className="relative aspect-square">
                    <img src={p.url} alt="" className="w-full h-full object-cover rounded-lg" />
                    <button onClick={() => handleDeletePhoto(p.id, p.storage_path)} aria-label={t("common.delete")}
                      className="absolute top-1 right-1 bg-destructive/80 text-destructive-foreground rounded-full p-1">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Participants: names for everyone; confirmation, emergency data and attendance for staff */}
        <TabsContent value="participants" className="space-y-3 mt-3">
          {isStaff && isSchool && event.event_category === "basic_course" && event.status !== "cancelled" && (
            <EquipmentQuotaHint groupId={event.group_id} eventDate={event.event_date} signups={signups} />
          )}
          {(isStaff || dayRole !== null) && activeDay && isSchool && <div className="space-y-1">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />{t("journeys.includeInactive")}</label>
            <p className="text-xs text-muted-foreground">{t("journeys.inactiveHint")}</p>
            {inactive.isError && <div role="alert"><p>{t("performance.loadFailed")}</p><Button onClick={() => void inactive.refetch()}>{t("performance.retry")}</Button></div>}
            {inactive.isPending && <p role="status">{t("common.loading")}</p>}
          </div>}
          {visibleConfirmed.length === 0
            ? activeListReady && <p className="text-sm text-muted-foreground">{t("events.noSignups")}</p>
            : <Card className="border-0 shadow-sm"><CardContent className="px-3 py-1 divide-y">{visibleConfirmed.map(participantRow)}</CardContent></Card>}
          {visibleWaitlist.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5"><Hourglass className="h-3 w-3" /> {t("events.waitlist")}</h2>
              <Card className="border-0 shadow-sm"><CardContent className="px-3 py-1 divide-y">{visibleWaitlist.map(s => (
                <div key={s.user_id} className="flex items-center gap-2 py-2">
                  <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 shrink-0">#{s.waitlist_position || "?"}</Badge>
                  <span className="text-sm">{profiles[s.user_id] || t("events.pilot")}</span>
                </div>))}</CardContent></Card>
            </div>
          )}
        </TabsContent>

        {/* Planning (staff): announcement, team, day programme */}
        {isStaff && (
          <TabsContent value="planning" className="space-y-3 mt-3">
            {isHeight && <EventAnnounceDialog event={event} profiles={profiles} briefingTasks={briefingTasks} maneuverNames={maneuverNames} />}
            <EventStaff eventId={id!} groupId={event.group_id} canManage={isStaff} isSchool={isSchool} eventDate={event.event_date} />
            <EventProgram eventId={id!} eventDate={event.event_date} endDate={event.end_date || null} canManage={isStaff} />
          </TabsContent>
        )}

        {/* Flying day (instructors and launch helpers): check-in; instructors also coach and book */}
        {showDayTab && (
          <TabsContent value="day" className="space-y-3 mt-3">
            <DayCheckIn eventId={id!} signups={visibleConfirmed} profiles={profiles} onChanged={refetchSignups} />
            {dayRole && <FlightDayStations eventId={id!} eventCategory={event.event_category || null} eventDate={event.event_date} role={dayRole} signups={visibleConfirmed} profiles={profiles} canWriteSummary={isStaff} onDayChanged={refetchSignups} />}
            {/* Former coaching sheet (F1–F6, read only), readable through is_group_staff. */}
            {isStaff && <LegacyCoachNotes eventId={id!} profiles={profiles} />}
          </TabsContent>
        )}

        {isStudent && isPast && (
          <TabsContent value="feedback" className="space-y-3 mt-3">
            <StudentDayFeedback eventId={id!} />
          </TabsContent>
        )}

        <TabsContent value="chat" className="mt-3">
          <EventChannel eventId={id!} />
        </TabsContent>
      </Tabs>

      {isStaff && isSchool && (
        <IncidentReportDialog groupId={event.group_id} open={incidentDialogOpen} onOpenChange={setIncidentDialogOpen} presetEventId={id} />
      )}
      <EventPublishPreviewDialog open={showPreview} onOpenChange={setShowPreview} onPublish={handlePublish} event={event} pilotName={pilotName} avatarUrl={avatarUrl} groupName={groupName} photos={photos.map(p => ({ id: p.id, url: p.url }))} loading={publishing} />
    </div>
  );
}
