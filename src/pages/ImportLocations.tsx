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
import { Upload, ArrowLeft, MapPin, CheckCircle2, RefreshCw } from "lucide-react";
import { parseLocationsCsv, type ParsedLocation } from "@/lib/csv-location-import";
import { Badge } from "@/components/ui/badge";

type ImportState = "idle" | "preview" | "importing" | "done";

interface LocationToProcess extends ParsedLocation {
  existingId?: string;
  isNew: boolean;
}

export default function ImportLocations() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<ImportState>("idle");
  const [toProcess, setToProcess] = useState<LocationToProcess[]>([]);
  const [progress, setProgress] = useState(0);
  const [resultInserted, setResultInserted] = useState(0);
  const [resultUpdated, setResultUpdated] = useState(0);

  const typeLabel = (ty: string) => ty === "takeoff" ? t("locations.takeoff") : ty === "landing" ? t("locations.landingPlace") : t("locations.both");

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseLocationsCsv(text);
      if (parsed.length === 0) { toast({ title: t("import.noLocationsFound"), description: t("import.noLocationsFoundDesc"), variant: "destructive" }); return; }

      const { data: existing } = await supabase.from("locations").select("id, name").eq("user_id", user!.id);
      const existingMap = new Map((existing || []).map((l) => [l.name.toLowerCase(), l.id]));

      const items: LocationToProcess[] = parsed.map((l) => {
        const existingId = existingMap.get(l.name.toLowerCase());
        return { ...l, existingId, isNew: !existingId };
      });

      setToProcess(items);
      setState("preview");
    } catch { toast({ title: t("import.readError"), description: t("import.readErrorDesc"), variant: "destructive" }); }
  };

  const handleImport = async () => {
    if (!user || toProcess.length === 0) return;
    setState("importing"); setProgress(0);
    try {
      const batchSize = 50;
      let inserted = 0, updated = 0;
      for (let i = 0; i < toProcess.length; i += batchSize) {
        const batch = toProcess.slice(i, i + batchSize);
        for (const loc of batch) {
          const row = {
            name: loc.name,
            type: loc.type as any,
            latitude: loc.latitude,
            longitude: loc.longitude,
            altitude: loc.altitude,
            description: [loc.country, loc.notes].filter(Boolean).join(" · ") || null,
            country_code: loc.country && loc.country.length === 2 ? loc.country.toUpperCase() : null,
          };
          if (loc.existingId) {
            // Update existing — only overwrite non-empty values
            const updates: Record<string, any> = {};
            if (loc.latitude !== 0 || loc.longitude !== 0) { updates.latitude = loc.latitude; updates.longitude = loc.longitude; }
            if (loc.altitude) updates.altitude = loc.altitude;
            if (row.description) updates.description = row.description;
            if (row.country_code) updates.country_code = row.country_code;
            updates.type = loc.type;
            if (Object.keys(updates).length > 0) {
              const { error } = await supabase.from("locations").update(updates).eq("id", loc.existingId);
              if (error) throw error;
              updated++;
            }
          } else {
            const { error } = await supabase.from("locations").insert({ user_id: user.id, ...row });
            if (error) throw error;
            inserted++;
          }
        }
        setProgress(Math.round(((i + batch.length) / toProcess.length) * 100));
      }
      setResultInserted(inserted);
      setResultUpdated(updated);
      setState("done");
    } catch (err: any) {
      toast({ title: t("import.importFailed"), description: err.message, variant: "destructive" });
      setState("preview");
    }
  };

  const newCount = toProcess.filter(l => l.isNew).length;
  const updateCount = toProcess.filter(l => !l.isNew).length;

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto space-y-4">
      <button onClick={() => navigate("/profile")} className="flex items-center gap-1 text-sm text-muted-foreground mb-2"><ArrowLeft className="h-4 w-4" /> {t("import.backToProfile")}</button>
      <h1 className="text-2xl font-bold tracking-tight">{t("import.importLocations")}</h1>

      {state === "idle" && (
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-6 space-y-4 text-center">
            <MapPin className="h-12 w-12 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground" dangerouslySetInnerHTML={{ __html: t("import.selectCsv") }} />
            <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />
            <Button onClick={() => fileRef.current?.click()} className="gap-2"><Upload className="h-4 w-4" /> {t("import.selectFile")}</Button>
          </CardContent>
        </Card>
      )}

      {state === "preview" && (
        <>
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t("import.preview")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-3 text-sm flex-wrap">
                {newCount > 0 && <Badge variant="default">{newCount} {t("import.newLocations")}</Badge>}
                {updateCount > 0 && <Badge variant="secondary"><RefreshCw className="h-3 w-3 mr-1" />{updateCount} {t("import.updateExisting")}</Badge>}
              </div>
              <div className="max-h-64 overflow-auto rounded border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">{t("import.nameCol")}</TableHead>
                      <TableHead className="text-xs">{t("import.typeCol")}</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {toProcess.slice(0, 30).map((l, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs py-1.5">{l.name}</TableCell>
                        <TableCell className="text-xs py-1.5">{typeLabel(l.type)}</TableCell>
                        <TableCell className="text-xs py-1.5">
                          {l.isNew
                            ? <Badge variant="default" className="text-[10px] px-1.5 py-0">{t("import.new")}</Badge>
                            : <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{t("import.update")}</Badge>
                          }
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {toProcess.length > 30 && <p className="text-xs text-muted-foreground text-center py-2">… {t("import.andMore", { count: toProcess.length - 30 })}</p>}
              </div>
            </CardContent>
          </Card>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => { setState("idle"); setToProcess([]); }}>{t("common.cancel")}</Button>
            <Button className="flex-1" onClick={handleImport}>{t("import.importFlightsAction")}</Button>
          </div>
        </>
      )}

      {state === "importing" && (
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-6 space-y-3 text-center">
            <p className="text-sm font-medium">{t("import.importing")}…</p>
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground">{progress}%</p>
          </CardContent>
        </Card>
      )}

      {state === "done" && (
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-6 space-y-4 text-center">
            <CheckCircle2 className="h-12 w-12 mx-auto text-green-600" />
            <div className="text-sm font-medium space-y-1">
              {resultInserted > 0 && <p>{resultInserted} {t("import.newLocations")} {t("import.importDone")}</p>}
              {resultUpdated > 0 && <p>{resultUpdated} {t("import.locationsUpdated")}</p>}
            </div>
            <Button onClick={() => navigate("/locations")} className="w-full">{t("import.toLocations")}</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
