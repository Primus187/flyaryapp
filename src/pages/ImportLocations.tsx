import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Upload, ArrowLeft, MapPin, CheckCircle2 } from "lucide-react";
import { parseLocationsCsv, type ParsedLocation } from "@/lib/csv-location-import";

type ImportState = "idle" | "preview" | "importing" | "done";

export default function ImportLocations() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<ImportState>("idle");
  const [locations, setLocations] = useState<ParsedLocation[]>([]);
  const [newLocations, setNewLocations] = useState<ParsedLocation[]>([]);
  const [skippedCount, setSkippedCount] = useState(0);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(0);

  const typeLabel = (ty: string) => ty === "takeoff" ? t("locations.takeoff") : ty === "landing" ? t("locations.landingPlace") : t("locations.both");

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      const text = await file.text(); const parsed = parseLocationsCsv(text);
      if (parsed.length === 0) { toast({ title: t("import.noLocationsFound"), description: t("import.noLocationsFoundDesc"), variant: "destructive" }); return; }
      setLocations(parsed);
      const { data: existing } = await supabase.from("locations").select("name").eq("user_id", user!.id);
      const existingNames = new Set((existing || []).map((l) => l.name.toLowerCase()));
      const missing = parsed.filter((l) => !existingNames.has(l.name.toLowerCase()));
      setNewLocations(missing); setSkippedCount(parsed.length - missing.length); setState("preview");
    } catch { toast({ title: t("import.readError"), description: t("import.readErrorDesc"), variant: "destructive" }); }
  };

  const handleImport = async () => {
    if (!user || newLocations.length === 0) return; setState("importing"); setProgress(0);
    try {
      const batchSize = 50; let inserted = 0;
      for (let i = 0; i < newLocations.length; i += batchSize) {
        const batch = newLocations.slice(i, i + batchSize).map((l) => ({ user_id: user.id, name: l.name, type: l.type as any, latitude: l.latitude, longitude: l.longitude, altitude: l.altitude, description: [l.country, l.notes].filter(Boolean).join(" · ") || null }));
        const { error } = await supabase.from("locations").insert(batch); if (error) throw error;
        inserted += batch.length; setProgress(Math.round((inserted / newLocations.length) * 100));
      }
      setResult(inserted); setState("done");
    } catch (err: any) { toast({ title: t("import.importFailed"), description: err.message, variant: "destructive" }); setState("preview"); }
  };

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto space-y-4">
      <button onClick={() => navigate("/profile")} className="flex items-center gap-1 text-sm text-muted-foreground mb-2"><ArrowLeft className="h-4 w-4" /> {t("import.backToProfile")}</button>
      <h1 className="text-2xl font-bold tracking-tight">{t("import.importLocations")}</h1>
      {state === "idle" && (<Card className="border-0 shadow-sm"><CardContent className="pt-6 space-y-4 text-center"><MapPin className="h-12 w-12 mx-auto text-muted-foreground" /><p className="text-sm text-muted-foreground" dangerouslySetInnerHTML={{ __html: t("import.selectCsv") }} /><input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" /><Button onClick={() => fileRef.current?.click()} className="gap-2"><Upload className="h-4 w-4" /> {t("import.selectFile")}</Button></CardContent></Card>)}
      {state === "preview" && (<><Card className="border-0 shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-base">{t("import.preview")}</CardTitle></CardHeader><CardContent className="space-y-3"><div className="flex gap-4 text-sm"><span className="font-medium">{newLocations.length} {t("import.newLocations")}</span>{skippedCount > 0 && <span className="text-muted-foreground">{skippedCount} {t("import.alreadyExists")}</span>}</div><div className="max-h-64 overflow-auto rounded border"><Table><TableHeader><TableRow><TableHead className="text-xs">{t("import.nameCol")}</TableHead><TableHead className="text-xs">{t("import.typeCol")}</TableHead><TableHead className="text-xs">{t("import.altitudeCol")}</TableHead></TableRow></TableHeader><TableBody>{newLocations.slice(0, 30).map((l, i) => (<TableRow key={i}><TableCell className="text-xs py-1.5">{l.name}</TableCell><TableCell className="text-xs py-1.5">{typeLabel(l.type)}</TableCell><TableCell className="text-xs py-1.5">{l.altitude ? `${l.altitude}m` : "—"}</TableCell></TableRow>))}</TableBody></Table>{newLocations.length > 30 && <p className="text-xs text-muted-foreground text-center py-2">… {t("import.andMore", { count: newLocations.length - 30 })}</p>}</div></CardContent></Card><div className="flex gap-2"><Button variant="outline" className="flex-1" onClick={() => { setState("idle"); setLocations([]); setNewLocations([]); }}>{t("common.cancel")}</Button><Button className="flex-1" onClick={handleImport} disabled={newLocations.length === 0}>{newLocations.length === 0 ? t("import.allExist") : t("import.importFlightsAction")}</Button></div></>)}
      {state === "importing" && (<Card className="border-0 shadow-sm"><CardContent className="pt-6 space-y-3 text-center"><p className="text-sm font-medium">{t("import.importing")}…</p><Progress value={progress} className="h-2" /><p className="text-xs text-muted-foreground">{progress}%</p></CardContent></Card>)}
      {state === "done" && (<Card className="border-0 shadow-sm"><CardContent className="pt-6 space-y-4 text-center"><CheckCircle2 className="h-12 w-12 mx-auto text-green-600" /><p className="text-sm font-medium">{result} {t("import.newLocations")} {t("import.importDone")}</p><Button onClick={() => navigate("/locations")} className="w-full">{t("import.toLocations")}</Button></CardContent></Card>)}
    </div>
  );
}
