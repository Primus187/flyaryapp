import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/contexts/ThemeContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PasswordInput } from "@/components/PasswordInput";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Sun, Moon, Monitor, Key, FileDown, GraduationCap, Bell, FileSpreadsheet, Trash2, ShieldAlert } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { exportFlightsCsv, downloadBlob } from "@/lib/csv-export";

function TrainingLevelCard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [level, setLevel] = useState("grundkurs");
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("training_level").eq("user_id", user.id).single().then(({ data }) => {
      if (data && (data as any).training_level) setLevel((data as any).training_level);
    });
  }, [user]);
  const handleChange = async (v: string) => {
    setLevel(v);
    if (user) {
      await supabase.from("profiles").update({ training_level: v } as any).eq("user_id", user.id);
      toast({ title: t("common.saved") });
    }
  };
  const levels = [
    { value: "grundkurs", label: t("training.grundkurs") },
    { value: "brevetkurs", label: t("training.brevetkurs") },
    { value: "siku", label: t("training.siku") },
    { value: "pilot", label: t("training.pilot") },
  ];
  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><GraduationCap className="h-4 w-4" /> {t("settings.trainingLevel")}</CardTitle></CardHeader>
      <CardContent>
        <Select value={level} onValueChange={handleChange}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{levels.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
}

interface GroupOption { id: string; name: string; }

export default function Settings() {
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [includeNoGroup, setIncludeNoGroup] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteFlightsOpen, setDeleteFlightsOpen] = useState(false);
  const [deleteFlightsConfirm, setDeleteFlightsConfirm] = useState("");
  const [deletingFlights, setDeletingFlights] = useState(false);
  const [deleteLocationsOpen, setDeleteLocationsOpen] = useState(false);
  const [deleteLocationsConfirm, setDeleteLocationsConfirm] = useState("");
  const [deletingLocations, setDeletingLocations] = useState(false);
  const { isSupported: pushSupported, isSubscribed: pushEnabled, toggle: togglePush, loading: pushLoading } = usePushNotifications();
  useEffect(() => {
    if (!user) return;
    supabase.from("group_members").select("group_id, groups(id, name)").eq("user_id", user.id).then(({ data }) => {
      if (data) {
        const g = data.map((gm: any) => ({ id: gm.groups.id, name: gm.groups.name }));
        setGroups(g);
        setSelectedGroupIds(g.map((x: GroupOption) => x.id));
      }
    });
  }, [user]);

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    localStorage.setItem("flyary-language", lng);
  };

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error(t("profile.notLoggedIn"));
      const params = new URLSearchParams();
      if (groups.length > 0) {
        if (selectedGroupIds.length > 0) params.set("group_ids", selectedGroupIds.join(","));
        params.set("include_no_group", includeNoGroup.toString());
      }
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/export-flightbook-pdf${params.toString() ? `?${params}` : ""}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${session.access_token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY }
      });
      if (!res.ok) throw new Error(t("profile.exportFailed"));
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl; a.download = `flugbuch.pdf`; a.click(); URL.revokeObjectURL(blobUrl);
      toast({ title: t("profile.pdfExported") });
      setExportDialogOpen(false);
    } catch (e: any) { toast({ title: t("common.error"), description: e.message, variant: "destructive" }); }
    finally { setExporting(false); }
  };

  const toggleGroup = (id: string) => {
    setSelectedGroupIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const handleExportCsv = async () => {
    if (!user) return;
    setExportingCsv(true);
    try {
      const { rows, blob } = await exportFlightsCsv(user.id);
      downloadBlob(blob, `flyary-flights-${new Date().toISOString().slice(0, 10)}.csv`);
      toast({ title: t("settings.csvExported"), description: `${rows} ${t("settings.csvRows")}` });
    } catch (e: any) {
      toast({ title: t("common.error"), description: e.message, variant: "destructive" });
    } finally {
      setExportingCsv(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error(t("profile.notLoggedIn"));
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Failed");
      }
      await supabase.auth.signOut();
      localStorage.clear();
      toast({ title: t("settings.accountDeleted") });
      navigate("/auth", { replace: true });
    } catch (e: any) {
      toast({ title: t("common.error"), description: e.message, variant: "destructive" });
      setDeleting(false);
    }
  };

  const clearBucketFolder = async (bucket: string) => {
    if (!user) return;
    try {
      const { data } = await supabase.storage.from(bucket).list(user.id, { limit: 1000 });
      if (!data || data.length === 0) return;
      const paths: string[] = [];
      for (const entry of data) {
        if (entry.name) {
          // recurse one level for sub-folders (e.g. flight_id folders)
          const { data: sub } = await supabase.storage.from(bucket).list(`${user.id}/${entry.name}`, { limit: 1000 });
          if (sub && sub.length > 0) {
            for (const s of sub) paths.push(`${user.id}/${entry.name}/${s.name}`);
          } else {
            paths.push(`${user.id}/${entry.name}`);
          }
        }
      }
      if (paths.length > 0) await supabase.storage.from(bucket).remove(paths);
    } catch { /* ignore */ }
  };

  const handleDeleteAllFlights = async () => {
    if (!user) return;
    setDeletingFlights(true);
    try {
      const { error } = await supabase.from("flights").delete().eq("user_id", user.id);
      if (error) throw error;
      await Promise.all([
        clearBucketFolder("flight-photos"),
        clearBucketFolder("flight-videos"),
        clearBucketFolder("igc-files"),
      ]);
      toast({ title: t("settings.allFlightsDeleted", "Alle Flüge gelöscht") });
      setDeleteFlightsOpen(false);
      setDeleteFlightsConfirm("");
    } catch (e: any) {
      toast({ title: t("common.error"), description: e.message, variant: "destructive" });
    } finally {
      setDeletingFlights(false);
    }
  };

  const handleDeleteAllLocations = async () => {
    if (!user) return;
    setDeletingLocations(true);
    try {
      // Detach from flights first to avoid FK issues
      await supabase.from("flights").update({ takeoff_location_id: null } as any).eq("user_id", user.id);
      await supabase.from("flights").update({ landing_location_id: null } as any).eq("user_id", user.id);
      const { error } = await supabase.from("locations").delete().eq("user_id", user.id);
      if (error) throw error;
      toast({ title: t("settings.allLocationsDeleted", "Alle Orte gelöscht") });
      setDeleteLocationsOpen(false);
      setDeleteLocationsConfirm("");
    } catch (e: any) {
      toast({ title: t("common.error"), description: e.message, variant: "destructive" });
    } finally {
      setDeletingLocations(false);
    }
  };

  const themes = [
    { value: "light" as const, label: t("settings.light"), icon: Sun },
    { value: "dark" as const, label: t("settings.dark"), icon: Moon },
    { value: "system" as const, label: t("settings.system"), icon: Monitor },
  ];

  const languages = [
    { value: "de", label: t("settings.german"), flag: "🇩🇪" },
    { value: "fr", label: t("settings.french"), flag: "🇫🇷" },
    { value: "en", label: t("settings.english"), flag: "🇬🇧" },
  ];

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold tracking-tight">{t("settings.title")}</h1>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3"><CardTitle className="text-base">{t("settings.theme")}</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2">
            {themes.map(({ value, label, icon: Icon }) => (
              <button key={value} onClick={() => setTheme(value)}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-colors ${theme === value ? "border-primary bg-primary/5" : "border-transparent bg-muted/50 hover:bg-muted"}`}>
                <Icon className={`h-5 w-5 ${theme === value ? "text-primary" : "text-muted-foreground"}`} />
                <span className={`text-xs font-medium ${theme === value ? "text-primary" : "text-muted-foreground"}`}>{label}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3"><CardTitle className="text-base">{t("settings.language")}</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {languages.map(({ value, label, flag }) => (
            <button key={value} onClick={() => changeLanguage(value)}
              className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${i18n.language === value ? "bg-primary/5 border-2 border-primary" : "bg-muted/50 border-2 border-transparent hover:bg-muted"}`}>
              <span className="text-xl">{flag}</span>
              <span className={`text-sm font-medium ${i18n.language === value ? "text-primary" : "text-foreground"}`}>{label}</span>
            </button>
          ))}
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Key className="h-4 w-4" /> {t("profile.changePassword")}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">{t("auth.newPasswordLabel")}</Label>
            <PasswordInput value={newPassword} onChange={e => setNewPassword(e.target.value)} minLength={6} placeholder={t("profile.newPasswordPlaceholder")} />
          </div>
          <Button size="sm" disabled={changingPassword || newPassword.length < 6} onClick={async () => {
            setChangingPassword(true);
            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) toast({ title: t("common.error"), description: error.message, variant: "destructive" });
            else { toast({ title: t("auth.passwordChanged"), description: t("auth.passwordChangedDesc") }); setNewPassword(""); }
            setChangingPassword(false);
          }}>{changingPassword ? "..." : t("auth.changePassword")}</Button>
        </CardContent>
      </Card>

      <TrainingLevelCard />

      {pushSupported && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Bell className="h-4 w-4" /> {t("settings.pushNotifications")}</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t("settings.pushDesc")}</span>
              <Switch checked={pushEnabled} onCheckedChange={togglePush} disabled={pushLoading} />
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3"><CardTitle className="text-base">{t("settings.exportImport")}</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Button variant="outline" className="w-full gap-2 justify-start" onClick={() => groups.length > 0 ? setExportDialogOpen(true) : handleExportPdf()} disabled={exporting}>
            <FileDown className="h-4 w-4" /> {exporting ? t("profile.exporting") : t("profile.exportPdf")}
          </Button>
          <Button variant="outline" className="w-full gap-2 justify-start" onClick={handleExportCsv} disabled={exportingCsv}>
            <FileSpreadsheet className="h-4 w-4" /> {exportingCsv ? t("profile.exporting") : t("settings.exportCsv")}
          </Button>
          <p className="text-[11px] text-muted-foreground pt-1">{t("settings.exportHint")}</p>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3"><CardTitle className="text-base">{t("settings.dataImport")}</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Button variant="outline" className="w-full gap-2 justify-start" onClick={() => navigate("/import")}>
            <FileSpreadsheet className="h-4 w-4" /> {t("more.importFlights")}
          </Button>
          <Button variant="outline" className="w-full gap-2 justify-start" onClick={() => navigate("/import-locations")}>
            <FileSpreadsheet className="h-4 w-4" /> {t("more.importLocations")}
          </Button>
        </CardContent>
      </Card>

      <Card className="border border-destructive/30 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2 text-destructive">
            <ShieldAlert className="h-4 w-4" /> {t("settings.dangerZone")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button variant="outline" className="w-full gap-2 justify-start border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => { setDeleteFlightsConfirm(""); setDeleteFlightsOpen(true); }}>
            <Trash2 className="h-4 w-4" /> {t("settings.deleteAllFlights", "Alle Flüge löschen")}
          </Button>
          <Button variant="outline" className="w-full gap-2 justify-start border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => { setDeleteLocationsConfirm(""); setDeleteLocationsOpen(true); }}>
            <Trash2 className="h-4 w-4" /> {t("settings.deleteAllLocations", "Alle Orte löschen")}
          </Button>
          <Button variant="destructive" className="w-full gap-2" onClick={() => { setDeleteConfirm(""); setDeleteOpen(true); }}>
            <Trash2 className="h-4 w-4" /> {t("settings.deleteAccount")}
          </Button>
          <p className="text-[11px] text-muted-foreground mt-2">{t("settings.deleteAccountHint")}</p>

        </CardContent>
      </Card>

      <Dialog open={deleteFlightsOpen} onOpenChange={(v) => !deletingFlights && setDeleteFlightsOpen(v)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" /> {t("settings.deleteAllFlights", "Alle Flüge löschen")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">{t("settings.deleteAllFlightsWarning", "Alle deine Flüge, Fotos, Videos und IGC-Tracks werden unwiderruflich gelöscht.")}</p>
            <p className="text-muted-foreground">{t("settings.typeDeleteToConfirm", "Tippe DELETE zum Bestätigen.")}</p>
            <Input value={deleteFlightsConfirm} onChange={(e) => setDeleteFlightsConfirm(e.target.value)} placeholder="DELETE" autoFocus />
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button variant="destructive" className="w-full" disabled={deletingFlights || deleteFlightsConfirm !== "DELETE"} onClick={handleDeleteAllFlights}>
              {deletingFlights ? t("common.loading") : t("settings.deleteAllFlights", "Alle Flüge löschen")}
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => setDeleteFlightsOpen(false)} disabled={deletingFlights}>{t("common.cancel")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteLocationsOpen} onOpenChange={(v) => !deletingLocations && setDeleteLocationsOpen(v)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" /> {t("settings.deleteAllLocations", "Alle Orte löschen")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">{t("settings.deleteAllLocationsWarning", "Alle deine Start- und Landeplätze werden gelöscht. Bestehende Flüge bleiben erhalten, verlieren aber die Ortsverknüpfung.")}</p>
            <p className="text-muted-foreground">{t("settings.typeDeleteToConfirm", "Tippe DELETE zum Bestätigen.")}</p>
            <Input value={deleteLocationsConfirm} onChange={(e) => setDeleteLocationsConfirm(e.target.value)} placeholder="DELETE" autoFocus />
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button variant="destructive" className="w-full" disabled={deletingLocations || deleteLocationsConfirm !== "DELETE"} onClick={handleDeleteAllLocations}>
              {deletingLocations ? t("common.loading") : t("settings.deleteAllLocations", "Alle Orte löschen")}
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => setDeleteLocationsOpen(false)} disabled={deletingLocations}>{t("common.cancel")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      <Dialog open={deleteOpen} onOpenChange={(v) => !deleting && setDeleteOpen(v)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" /> {t("settings.deleteAccount")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">{t("settings.deleteAccountWarning")}</p>
            <p className="text-muted-foreground">{t("settings.deleteAccountConfirmHint")}</p>
            <Input
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder="DELETE"
              autoFocus
            />
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              variant="destructive"
              className="w-full"
              disabled={deleting || deleteConfirm !== "DELETE"}
              onClick={handleDeleteAccount}
            >
              {deleting ? t("common.loading") : t("settings.deleteAccountConfirm")}
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              {t("common.cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("settings.exportFilter")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{t("settings.selectGroups")}</p>
            {groups.map((g) => (
              <label key={g.id} className="flex items-center gap-3 cursor-pointer">
                <Checkbox checked={selectedGroupIds.includes(g.id)} onCheckedChange={() => toggleGroup(g.id)} />
                <span className="text-sm">{g.name}</span>
              </label>
            ))}
            <label className="flex items-center gap-3 cursor-pointer">
              <Checkbox checked={includeNoGroup} onCheckedChange={(c) => setIncludeNoGroup(!!c)} />
              <span className="text-sm">{t("settings.noGroup")}</span>
            </label>
          </div>
          <DialogFooter>
            <Button onClick={handleExportPdf} disabled={exporting} className="w-full gap-2">
              <FileDown className="h-4 w-4" /> {exporting ? t("profile.exporting") : t("profile.exportPdf")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
