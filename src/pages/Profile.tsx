import { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/PasswordInput";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Plus, Trash2, Star, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";

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
  const [form, setForm] = useState({ pilot_name: "", glider_info: "", bio: "", avatar_url: "", emergency_contact_name: "", emergency_contact_phone: "", blood_type: "", allergies: "", medical_notes: "" });
  const [gliders, setGliders] = useState<Glider[]>([]);
  const [newGlider, setNewGlider] = useState<Glider>({ manufacturer: "", model: "", size: "", is_default: false });
  const [showAddGlider, setShowAddGlider] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("user_id", user.id).single().then(({ data }) => {
      if (data) setForm({ pilot_name: data.pilot_name || "", glider_info: data.glider_info || "", bio: (data as any).bio || "", avatar_url: data.avatar_url || "", emergency_contact_name: (data as any).emergency_contact_name || "", emergency_contact_phone: (data as any).emergency_contact_phone || "", blood_type: (data as any).blood_type || "", allergies: (data as any).allergies || "", medical_notes: (data as any).medical_notes || "" });
    });
    supabase.from("pilot_gliders" as any).select("*").eq("user_id", user.id).order("created_at").then(({ data }) => { if (data) setGliders(data as any); });
  }, [user]);

  const handleSave = async () => {
    if (!user) return; setLoading(true);
    const { error } = await supabase.from("profiles").update({ pilot_name: form.pilot_name, glider_info: form.glider_info, avatar_url: form.avatar_url, bio: form.bio, emergency_contact_name: form.emergency_contact_name, emergency_contact_phone: form.emergency_contact_phone, blood_type: form.blood_type, allergies: form.allergies, medical_notes: form.medical_notes } as any).eq("user_id", user.id);
    if (error) toast({ title: t("common.error"), description: error.message, variant: "destructive" });
    else toast({ title: t("profile.profileSaved") });
    setLoading(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !user) return; setUploading(true);
    const ext = file.name.split(".").pop(); const path = `${user.id}/avatar.${ext}`;
    const { error: uploadError } = await supabase.storage.from("flight-photos").upload(path, file, { upsert: true });
    if (uploadError) { toast({ title: t("common.error"), description: uploadError.message, variant: "destructive" }); setUploading(false); return; }
    const { data: { publicUrl } } = supabase.storage.from("flight-photos").getPublicUrl(path);
    setForm(f => ({ ...f, avatar_url: publicUrl }));
    await supabase.from("profiles").update({ avatar_url: publicUrl } as any).eq("user_id", user.id);
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

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">{t("profile.title")}</h1>
      <Card className="border-0 shadow-sm"><CardHeader className="pb-3"><CardTitle className="text-base">{t("profile.personal")}</CardTitle></CardHeader><CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="relative"><Avatar className="h-20 w-20"><AvatarImage src={form.avatar_url} /><AvatarFallback className="text-lg bg-primary/10">{initials}</AvatarFallback></Avatar><button onClick={() => fileInputRef.current?.click()} className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-sm" disabled={uploading}><Camera className="h-3.5 w-3.5" /></button><input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} /></div>
          <div className="flex-1 space-y-1.5"><Label className="text-xs">{t("profile.pilotName")}</Label><Input value={form.pilot_name} onChange={e => setForm({ ...form, pilot_name: e.target.value })} /></div>
        </div>
        <div className="space-y-1.5"><Label className="text-xs">{t("profile.bio")}</Label><Textarea value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} placeholder={t("profile.bioPlaceholder")} rows={2} /></div>
        <div className="space-y-1.5"><Label className="text-xs">{t("profile.email")}</Label><Input value={user?.email || ""} disabled /></div>
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

      <Button onClick={handleSave} disabled={loading} className="w-full">{loading ? "..." : t("profile.saveProfile")}</Button>
    </div>
  );
}
