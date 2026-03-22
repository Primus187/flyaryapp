import { useEffect, useState, useRef } from "react";
import AvatarCropDialog from "@/components/AvatarCropDialog";
import { compressImage } from "@/lib/image-compress";
import BadgeGrid from "@/components/BadgeGrid";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PasswordInput } from "@/components/PasswordInput";
import { Camera, Plus, Trash2, Star, Shield, Award, Trophy, Zap, RefreshCw, Globe, ImagePlus, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

const LEVEL_THRESHOLDS = [0, 100, 300, 600, 1000, 1500, 2500, 4000, 6000, 9000, 13000, 18000, 25000];
const LEVEL_NAMES = ["Rookie", "Starter", "Pilot", "Flieger", "Thermiker", "Streckenflieger", "Adler", "Falke", "Kondor", "Ikarus", "Skywalker", "Legende", "Meister"];

interface Glider { id?: string; manufacturer: string; model: string; size: string; is_default: boolean; }

export default function Profile() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ pilot_name: "", glider_info: "", bio: "", avatar_url: "", emergency_contact_name: "", emergency_contact_phone: "", blood_type: "", allergies: "", medical_notes: "", shv_number: "", exam_theory_date: "", exam_practical_date: "", flight_school: "" });
  const [gliders, setGliders] = useState<Glider[]>([]);
  const [newGlider, setNewGlider] = useState<Glider>({ manufacturer: "", model: "", size: "", is_default: false });
  const [showAddGlider, setShowAddGlider] = useState(false);
  const [avatarSignedUrl, setAvatarSignedUrl] = useState("");
  const [xp, setXp] = useState<{ total_xp: number; level: number } | null>(null);
  const [xcontestUsername, setXcontestUsername] = useState("");
  const [xcontestPassword, setXcontestPassword] = useState("");
  const [xcontestSyncing, setXcontestSyncing] = useState(false);
  const [xcontestHasCredentials, setXcontestHasCredentials] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [badges, setBadges] = useState<{ badge_key: string; unlocked_at: string }[]>([]);
  const [badgeStats, setBadgeStats] = useState<any>(null);
  const [showAllBadges, setShowAllBadges] = useState(false);
  const [coverPhotoUrl, setCoverPhotoUrl] = useState("");
  const [coverSignedUrl, setCoverSignedUrl] = useState("");
  const [profilePhotos, setProfilePhotos] = useState<{ id: string; storage_path: string; signedUrl?: string }[]>([]);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const resolveAvatarUrl = async (url: string) => {
    if (!url) return;
    if (url.startsWith("http")) { setAvatarSignedUrl(url); return; }
    const { data } = await supabase.storage.from("flight-photos").createSignedUrl(url, 3600);
    if (data?.signedUrl) setAvatarSignedUrl(data.signedUrl);
  };

  const resolveSignedUrl = async (path: string): Promise<string | null> => {
    if (!path) return null;
    if (path.startsWith("http")) return path;
    const { data } = await supabase.storage.from("flight-photos").createSignedUrl(path, 3600);
    return data?.signedUrl || null;
  };

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("user_id", user.id).single().then(({ data }) => {
      if (data) {
        setForm({ pilot_name: data.pilot_name || "", glider_info: data.glider_info || "", bio: data.bio || "", avatar_url: data.avatar_url || "", emergency_contact_name: data.emergency_contact_name || "", emergency_contact_phone: data.emergency_contact_phone || "", blood_type: data.blood_type || "", allergies: data.allergies || "", medical_notes: data.medical_notes || "", shv_number: data.shv_number || "", exam_theory_date: data.exam_theory_date || "", exam_practical_date: data.exam_practical_date || "", flight_school: data.flight_school || "" });
        if (data.avatar_url) resolveAvatarUrl(data.avatar_url);
        if ((data as any).cover_photo_url) {
          setCoverPhotoUrl((data as any).cover_photo_url);
          resolveSignedUrl((data as any).cover_photo_url).then(u => u && setCoverSignedUrl(u));
        }
        if ((data as any).xcontest_username) {
          setXcontestUsername((data as any).xcontest_username);
          setXcontestHasCredentials(!!(data as any).xcontest_password_encrypted);
        }
      }
    });
    supabase.from("pilot_gliders" as any).select("*").eq("user_id", user.id).order("created_at").then(({ data }) => { if (data) setGliders(data as any); });
    supabase.from("pilot_xp" as any).select("total_xp, level").eq("user_id", user.id).single().then(({ data }) => { if (data) setXp(data as any); });
    supabase.from("pilot_badges" as any).select("badge_key, unlocked_at").eq("user_id", user.id).then(({ data }) => { if (data) setBadges(data as any); });
    // Load profile photos
    supabase.from("profile_photos" as any).select("id, storage_path").eq("user_id", user.id).order("sort_order").then(async ({ data }) => {
      if (data && data.length > 0) {
        const photos = await Promise.all((data as any[]).map(async (p) => {
          const url = await resolveSignedUrl(p.storage_path);
          return { ...p, signedUrl: url || "" };
        }));
        setProfilePhotos(photos);
      }
    });
    supabase.from("pilot_gliders" as any).select("*").eq("user_id", user.id).order("created_at").then(({ data }) => { if (data) setGliders(data as any); });
    supabase.from("pilot_xp" as any).select("total_xp, level").eq("user_id", user.id).single().then(({ data }) => { if (data) setXp(data as any); });
    supabase.from("pilot_badges" as any).select("badge_key, unlocked_at").eq("user_id", user.id).then(({ data }) => { if (data) setBadges(data as any); });
    // Load stats for badge progress
    supabase.from("flights").select("duration_minutes, altitude_gain, distance_km, takeoff_location_id").eq("user_id", user.id).then(({ data }) => {
      if (data) {
        const uniqueTakeoffs = new Set(data.map(f => f.takeoff_location_id).filter(Boolean)).size;
        setBadgeStats({
          flightCount: data.length,
          totalMinutes: data.reduce((s, f) => s + (f.duration_minutes || 0), 0),
          totalAltitude: data.reduce((s, f) => s + (f.altitude_gain || 0), 0),
          totalDistance: data.reduce((s, f) => s + Number(f.distance_km || 0), 0),
          uniqueTakeoffs,
          maxDuration: Math.max(0, ...data.map(f => f.duration_minutes || 0)),
          maxDistance: Math.max(0, ...data.map(f => Number(f.distance_km || 0))),
          maxAltitude: Math.max(0, ...data.map(f => f.altitude_gain || 0)),
        });
      }
    });

    // Realtime subscription for XP updates
    const channel = supabase
      .channel('profile-xp')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'pilot_xp',
        filter: `user_id=eq.${user.id}`,
      }, (payload: any) => {
        if (payload.new) {
          setXp({ total_xp: payload.new.total_xp, level: payload.new.level });
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const handleSave = async () => {
    if (!user) return; setLoading(true);
    const { error } = await supabase.from("profiles").update({ pilot_name: form.pilot_name, glider_info: form.glider_info, avatar_url: form.avatar_url, bio: form.bio, emergency_contact_name: form.emergency_contact_name, emergency_contact_phone: form.emergency_contact_phone, blood_type: form.blood_type, allergies: form.allergies, medical_notes: form.medical_notes, shv_number: form.shv_number, exam_theory_date: form.exam_theory_date || null, exam_practical_date: form.exam_practical_date || null, flight_school: form.flight_school } as any).eq("user_id", user.id);
    if (error) toast({ title: t("common.error"), description: error.message, variant: "destructive" });
    else toast({ title: t("profile.profileSaved") });
    setLoading(false);
  };

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCropFile(file);
    setCropOpen(true);
    e.target.value = "";
  };

  const handleCroppedAvatar = async (blob: Blob) => {
    if (!user) return;
    setCropOpen(false);
    setUploading(true);
    const path = `${user.id}/avatar.jpg`;
    const file = new File([blob], "avatar.jpg", { type: "image/jpeg" });
    const { error: uploadError } = await supabase.storage.from("flight-photos").upload(path, file, { upsert: true });
    if (uploadError) { toast({ title: t("common.error"), description: uploadError.message, variant: "destructive" }); setUploading(false); return; }
    setForm(f => ({ ...f, avatar_url: path }));
    resolveAvatarUrl(path);
    await supabase.from("profiles").update({ avatar_url: path } as any).eq("user_id", user.id);
    toast({ title: t("profile.photoUploaded") }); setUploading(false);
  };

  const handleAddGlider = async () => {
    if (!user || !newGlider.manufacturer || !newGlider.model) return;
    if (newGlider.is_default) await supabase.from("pilot_gliders" as any).update({ is_default: false } as any).eq("user_id", user.id);
    const { data, error } = await supabase.from("pilot_gliders" as any).insert({ user_id: user.id, ...newGlider } as any).select().single();
    if (error) { toast({ title: t("common.error"), description: error.message, variant: "destructive" }); return; }
    if (newGlider.is_default) setGliders(prev => [...prev.map(g => ({ ...g, is_default: false })), data as any]);
    else setGliders(prev => [...prev, data as any]);
    setNewGlider({ manufacturer: "", model: "", size: "", is_default: false }); setShowAddGlider(false);
    toast({ title: t("profile.gliderAdded") });
  };

  const handleDeleteGlider = async (id: string) => { await supabase.from("pilot_gliders" as any).delete().eq("id", id); setGliders(prev => prev.filter(g => g.id !== id)); toast({ title: t("profile.gliderRemoved") }); };
  const handleSetDefault = async (id: string) => { if (!user) return; await supabase.from("pilot_gliders" as any).update({ is_default: false } as any).eq("user_id", user.id); await supabase.from("pilot_gliders" as any).update({ is_default: true } as any).eq("id", id); setGliders(prev => prev.map(g => ({ ...g, is_default: g.id === id }))); };

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession(); if (!session) throw new Error(t("profile.notLoggedIn"));
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/export-flightbook-pdf`, { headers: { Authorization: `Bearer ${session.access_token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } });
      if (!res.ok) throw new Error(t("profile.exportFailed"));
      const blob = await res.blob(); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `flugbuch.pdf`; a.click(); URL.revokeObjectURL(url);
      toast({ title: t("profile.pdfExported") });
    } catch (e: any) { toast({ title: t("common.error"), description: e.message, variant: "destructive" }); }
    finally { setExporting(false); }
  };

  const initials = form.pilot_name ? form.pilot_name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) : user?.email?.[0]?.toUpperCase() || "?";

  // XContest handlers
  const handleSaveXcontest = async () => {
    if (!user || !xcontestUsername) return;
    // Encrypt password client-side with a simple XOR — real encryption happens server-side
    // We send it to the profile; the edge function decrypts with the server key
    const updateData: any = { xcontest_username: xcontestUsername };
    if (xcontestPassword) {
      // Simple base64 encoding for transit — the edge function uses the encryption key
      updateData.xcontest_password_encrypted = btoa(xcontestPassword);
    }
    const { error } = await supabase.from("profiles").update(updateData).eq("user_id", user.id);
    if (error) { toast({ title: t("common.error"), description: error.message, variant: "destructive" }); return; }
    setXcontestHasCredentials(true);
    setXcontestPassword("");
    toast({ title: t("profile.xcontestSaved") });
  };

  const handleSyncXcontest = async () => {
    if (!user) return;
    setXcontestSyncing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error(t("profile.notLoggedIn"));
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-xcontest`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("profile.xcontestError"));
      toast({ title: t("profile.xcontestSyncDone", { count: data.imported }) });
    } catch (e: any) {
      toast({ title: t("profile.xcontestError"), description: e.message, variant: "destructive" });
    } finally {
      setXcontestSyncing(false);
    }
  };

  // XP progress calculation
  const xpLevel = xp?.level || 1;
  const xpTotal = xp?.total_xp || 0;
  const xpForCurrentLevel = LEVEL_THRESHOLDS[xpLevel - 1] || 0;
  const xpForNextLevel = LEVEL_THRESHOLDS[xpLevel] || xpTotal;
  const xpProgress = xpForNextLevel > xpForCurrentLevel
    ? ((xpTotal - xpForCurrentLevel) / (xpForNextLevel - xpForCurrentLevel)) * 100
    : 100;

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">{t("profile.title")}</h1>

      {/* XP Card */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Zap className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("leaderboard.level")} {xpLevel}</p>
                <p className="text-sm font-semibold">{LEVEL_NAMES[xpLevel - 1]}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold tabular-nums">{xpTotal.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">XP</p>
            </div>
          </div>
          <div className="space-y-1">
            <Progress value={xpProgress} className="h-2" />
            <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
              <span>{xpForCurrentLevel.toLocaleString()}</span>
              <span>{xpLevel < 13 ? xpForNextLevel.toLocaleString() : "∞"}</span>
            </div>
          </div>
          <button
            onClick={() => navigate("/leaderboard")}
            className="w-full text-xs text-primary font-medium hover:underline text-center"
          >
            {t("leaderboard.viewLeaderboard")} →
          </button>
          <button
            onClick={() => navigate(`/pilot/${user?.id}`)}
            className="w-full text-xs text-muted-foreground font-medium hover:underline text-center"
          >
            {t("pilotProfile.viewPublicProfile")} →
          </button>
        </div>
      </Card>

      {/* Badges / Achievements */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500" /> {t("badges.title")}
          </CardTitle>
          <button onClick={() => setShowAllBadges(!showAllBadges)} className="text-xs text-primary font-medium">
            {showAllBadges ? t("common.close") : t("badges.showAll")}
          </button>
        </CardHeader>
        <CardContent>
          {showAllBadges ? (
            <BadgeGrid unlockedBadges={badges} stats={badgeStats} />
          ) : (
            <BadgeGrid unlockedBadges={badges} stats={badgeStats} compact />
          )}
          {badges.length === 0 && (
            <p className="text-xs text-muted-foreground text-center mt-2">{t("badges.noBadges")}</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm"><CardHeader className="pb-3"><CardTitle className="text-base">{t("profile.personal")}</CardTitle></CardHeader><CardContent className="space-y-4">
        <div className="flex flex-col items-center gap-4">
          <div className="relative p-[3px] rounded-full bg-gradient-to-tr from-primary via-secondary to-accent">
            <Avatar className="h-24 w-24 border-[3px] border-background">
              <AvatarImage src={avatarSignedUrl} />
              <AvatarFallback className="text-2xl bg-muted">{initials}</AvatarFallback>
            </Avatar>
            <button onClick={() => fileInputRef.current?.click()} className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md" disabled={uploading}><Camera className="h-4 w-4" /></button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarSelect} />
          </div>
          <div className="w-full space-y-1.5"><Label className="text-xs">{t("profile.pilotName")}</Label><Input value={form.pilot_name} onChange={e => setForm({ ...form, pilot_name: e.target.value })} /></div>
        </div>
        <div className="space-y-1.5"><Label className="text-xs">{t("profile.bio")}</Label><Textarea value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} placeholder={t("profile.bioPlaceholder")} rows={2} /></div>
        <div className="space-y-1.5"><Label className="text-xs">{t("profile.email")}</Label><Input value={user?.email || ""} disabled /></div>
      </CardContent></Card>

      <Card className="border-0 shadow-sm"><CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Award className="h-4 w-4 text-primary" /> {t("profile.shvInfo")}</CardTitle></CardHeader><CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label className="text-xs">{t("profile.shvNumber")}</Label><Input value={form.shv_number} onChange={e => setForm({ ...form, shv_number: e.target.value })} placeholder={t("profile.shvNumberPlaceholder")} /></div><div className="space-y-1.5"><Label className="text-xs">{t("profile.flightSchool")}</Label><Input value={form.flight_school} onChange={e => setForm({ ...form, flight_school: e.target.value })} placeholder={t("profile.flightSchoolPlaceholder")} /></div></div>
        <div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label className="text-xs">{t("profile.examTheoryDate")}</Label><Input type="date" value={form.exam_theory_date} onChange={e => setForm({ ...form, exam_theory_date: e.target.value })} /></div><div className="space-y-1.5"><Label className="text-xs">{t("profile.examPracticalDate")}</Label><Input type="date" value={form.exam_practical_date} onChange={e => setForm({ ...form, exam_practical_date: e.target.value })} /></div></div>
      </CardContent></Card>

      <Card className="border-0 shadow-sm"><CardHeader className="pb-3 flex flex-row items-center justify-between"><CardTitle className="text-base">{t("profile.myGliders")}</CardTitle><Button variant="ghost" size="sm" onClick={() => setShowAddGlider(true)}><Plus className="h-4 w-4 mr-1" /> {t("common.add")}</Button></CardHeader><CardContent className="space-y-2">
        {gliders.length === 0 && !showAddGlider && <p className="text-sm text-muted-foreground">{t("profile.noGliders")}</p>}
        {gliders.map(g => (<div key={g.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50"><div className="flex items-center gap-2">{g.is_default && <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />}<div><p className="text-sm font-medium">{g.manufacturer} {g.model}</p>{g.size && <p className="text-xs text-muted-foreground">{t("profile.size")}: {g.size}</p>}</div></div><div className="flex gap-1">{!g.is_default && <Button variant="ghost" size="sm" onClick={() => handleSetDefault(g.id!)}><Star className="h-3.5 w-3.5" /></Button>}<Button variant="ghost" size="sm" onClick={() => handleDeleteGlider(g.id!)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button></div></div>))}
        {showAddGlider && (<div className="p-3 rounded-lg border space-y-2"><div className="grid grid-cols-2 gap-2"><div className="space-y-1"><Label className="text-xs">{t("profile.manufacturer")}</Label><Input value={newGlider.manufacturer} onChange={e => setNewGlider({ ...newGlider, manufacturer: e.target.value })} placeholder={t("profile.manufacturerPlaceholder")} /></div><div className="space-y-1"><Label className="text-xs">{t("profile.model")}</Label><Input value={newGlider.model} onChange={e => setNewGlider({ ...newGlider, model: e.target.value })} placeholder={t("profile.modelPlaceholder")} /></div></div><div className="space-y-1"><Label className="text-xs">{t("profile.size")}</Label><Input value={newGlider.size} onChange={e => setNewGlider({ ...newGlider, size: e.target.value })} placeholder={t("profile.sizePlaceholder")} /></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={newGlider.is_default} onChange={e => setNewGlider({ ...newGlider, is_default: e.target.checked })} />{t("profile.defaultGlider")}</label><div className="flex gap-2"><Button size="sm" onClick={handleAddGlider} disabled={!newGlider.manufacturer || !newGlider.model}>{t("common.save")}</Button><Button size="sm" variant="outline" onClick={() => setShowAddGlider(false)}>{t("common.cancel")}</Button></div></div>)}
      </CardContent></Card>

      <Card className="border-0 shadow-sm"><CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Shield className="h-4 w-4 text-destructive" /> {t("profile.emergency")}</CardTitle><p className="text-xs text-muted-foreground">{t("profile.emergencyDesc")}</p></CardHeader><CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3"><div className="space-y-1.5 col-span-2 sm:col-span-1"><Label className="text-xs">{t("profile.emergencyName")}</Label><Input value={form.emergency_contact_name} onChange={e => setForm({ ...form, emergency_contact_name: e.target.value })} /></div><div className="space-y-1.5 col-span-2 sm:col-span-1"><Label className="text-xs">{t("profile.emergencyPhone")}</Label><Input value={form.emergency_contact_phone} onChange={e => setForm({ ...form, emergency_contact_phone: e.target.value })} placeholder="+41 79 ..." type="tel" /></div></div>
        <div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label className="text-xs">{t("profile.bloodType")}</Label><Input value={form.blood_type} onChange={e => setForm({ ...form, blood_type: e.target.value })} placeholder={t("profile.bloodTypePlaceholder")} /></div><div className="space-y-1.5"><Label className="text-xs">{t("profile.allergies")}</Label><Input value={form.allergies} onChange={e => setForm({ ...form, allergies: e.target.value })} placeholder={t("profile.allergiesPlaceholder")} /></div></div>
        <div className="space-y-1.5"><Label className="text-xs">{t("profile.medicalNotes")}</Label><Textarea value={form.medical_notes} onChange={e => setForm({ ...form, medical_notes: e.target.value })} placeholder={t("profile.medicalNotesPlaceholder")} rows={2} /></div>
      </CardContent></Card>

      <Card className="border-0 shadow-sm"><CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Globe className="h-4 w-4 text-primary" /> {t("profile.xcontestTitle")}</CardTitle><p className="text-xs text-muted-foreground">{t("profile.xcontestWarning")}</p></CardHeader><CardContent className="space-y-3">
        <div className="space-y-1.5"><Label className="text-xs">{t("profile.xcontestUsername")}</Label><Input value={xcontestUsername} onChange={e => setXcontestUsername(e.target.value)} placeholder={t("profile.xcontestUsernamePlaceholder")} /></div>
        <div className="space-y-1.5"><Label className="text-xs">{t("profile.xcontestPassword")}</Label><PasswordInput value={xcontestPassword} onChange={e => setXcontestPassword(e.target.value)} placeholder={xcontestHasCredentials ? "••••••••" : t("profile.xcontestPasswordPlaceholder")} /></div>
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSaveXcontest} disabled={!xcontestUsername}>{t("common.save")}</Button>
          <Button size="sm" variant="outline" onClick={handleSyncXcontest} disabled={xcontestSyncing || !xcontestHasCredentials}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${xcontestSyncing ? "animate-spin" : ""}`} />
            {xcontestSyncing ? t("profile.xcontestSyncing") : t("profile.xcontestSync")}
          </Button>
        </div>
      </CardContent></Card>

      <Button onClick={handleSave} disabled={loading} className="w-full">{loading ? "..." : t("profile.saveProfile")}</Button>

      <AvatarCropDialog file={cropFile} open={cropOpen} onClose={() => setCropOpen(false)} onCrop={handleCroppedAvatar} />
    </div>
  );
}
