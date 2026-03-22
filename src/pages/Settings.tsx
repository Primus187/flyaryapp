import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/contexts/ThemeContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PasswordInput } from "@/components/PasswordInput";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Sun, Moon, Monitor, Key, FileDown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function Settings() {
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [exporting, setExporting] = useState(false);

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    localStorage.setItem("flyary-language", lng);
  };

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error(t("profile.notLoggedIn"));
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/export-flightbook-pdf`, {
        headers: { Authorization: `Bearer ${session.access_token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY }
      });
      if (!res.ok) throw new Error(t("profile.exportFailed"));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `flugbuch.pdf`; a.click(); URL.revokeObjectURL(url);
      toast({ title: t("profile.pdfExported") });
    } catch (e: any) { toast({ title: t("common.error"), description: e.message, variant: "destructive" }); }
    finally { setExporting(false); }
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

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3"><CardTitle className="text-base">{t("settings.exportImport")}</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Button variant="outline" className="w-full gap-2" onClick={handleExportPdf} disabled={exporting}>
            <FileDown className="h-4 w-4" /> {exporting ? t("profile.exporting") : t("profile.exportPdf")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
