import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { LogOut, MapPin, Upload, FileDown } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Profile() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [form, setForm] = useState({ pilot_name: "", glider_info: "" });

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("pilot_name, glider_info").eq("user_id", user.id).single().then(({ data }) => {
      if (data) setForm({ pilot_name: data.pilot_name || "", glider_info: data.glider_info || "" });
    });
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    const { error } = await supabase.from("profiles").update(form).eq("user_id", user.id);
    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Profil gespeichert" });
    }
    setLoading(false);
  };

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Nicht angemeldet");

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/export-flightbook-pdf`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );

      if (!res.ok) throw new Error("Export fehlgeschlagen");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `flugbuch.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "PDF exportiert" });
    } catch (e: any) {
      toast({ title: "Fehler", description: e.message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Profil</h1>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3"><CardTitle className="text-base">Pilotendaten</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Pilotenname</Label>
            <Input value={form.pilot_name} onChange={(e) => setForm({ ...form, pilot_name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Schirm-Info</Label>
            <Input value={form.glider_info} onChange={(e) => setForm({ ...form, glider_info: e.target.value })} placeholder="z.B. Gin Explorer 3, M" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">E-Mail</Label>
            <Input value={user?.email || ""} disabled />
          </div>
          <Button onClick={handleSave} disabled={loading} className="w-full">
            {loading ? "..." : "Speichern"}
          </Button>
        </CardContent>
      </Card>

      <Button variant="outline" className="w-full gap-2" onClick={handleExportPdf} disabled={exporting}>
        <FileDown className="h-4 w-4" /> {exporting ? "Exportiere..." : "Flugbuch als PDF exportieren"}
      </Button>

      <Button variant="outline" className="w-full gap-2" onClick={() => navigate("/import")}>
        <Upload className="h-4 w-4" /> Flüge importieren (.xlsx)
      </Button>

      <Button variant="outline" className="w-full gap-2" onClick={() => navigate("/import-locations")}>
        <MapPin className="h-4 w-4" /> Orte importieren (.csv)
      </Button>

      <Button variant="ghost" className="w-full gap-2 text-destructive" onClick={signOut}>
        <LogOut className="h-4 w-4" /> Abmelden
      </Button>
    </div>
  );
}
