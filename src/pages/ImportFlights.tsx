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
import { Upload, ArrowLeft, FileSpreadsheet, CheckCircle2 } from "lucide-react";
import { parseXlsx, collectUniqueLocations, splitDuplicates, totals, type ExistingFlight, type ParsedFlight } from "@/lib/xlsx-import";
import { fetchAllPages } from "@/lib/csv-export";

const hhmm = (minutes: number) => `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;

type ImportState = "idle" | "preview" | "importing" | "done";

export default function ImportFlights() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<ImportState>("idle");
  const [flights, setFlights] = useState<ParsedFlight[]>([]);
  const [invalidRows, setInvalidRows] = useState<number[]>([]);
  // Rows of the file that are already in the logbook (repeated import) and the file totals, for the comparison with Flightbook.
  const [duplicates, setDuplicates] = useState<ParsedFlight[]>([]);
  const [fileTotals, setFileTotals] = useState({ flights: 0, minutes: 0 });
  const [newLocations, setNewLocations] = useState<{ name: string; country: string; type: "takeoff" | "landing" | "both" }[]>([]);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState({ flights: 0, locations: 0 });

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      const buf = await file.arrayBuffer(); const { flights: parsed, invalidRows: invalid } = parseXlsx(buf);
      setInvalidRows(invalid);
      if (parsed.length === 0) { toast({ title: t("import.noFlightsFound"), description: t("import.noFlightsFoundDesc"), variant: "destructive" }); return; }
      const logged = await fetchAllPages<{ date: string; duration_minutes: number | null; source: string | null; source_ref: string | null; takeoff: { name: string } | null; landing: { name: string } | null }>((from, to) =>
        supabase.from("flights").select("date, duration_minutes, source, source_ref, takeoff:locations!flights_takeoff_location_id_fkey(name), landing:locations!flights_landing_location_id_fkey(name)")
          .eq("user_id", user!.id).order("id", { ascending: true }).range(from, to) as never);
      const known: ExistingFlight[] = logged.map((e) => ({ date: e.date, duration_minutes: e.duration_minutes, source: e.source, source_ref: e.source_ref, takeoff_name: e.takeoff?.name ?? null, landing_name: e.landing?.name ?? null }));
      const { fresh, duplicates: dupes } = splitDuplicates(parsed, known);
      // All rows of the file, so that new + already present + unreadable add up to it.
      setFileTotals({ flights: parsed.length + invalid.length, minutes: totals(parsed).minutes });
      setDuplicates(dupes);
      setFlights(fresh);
      const allLocs = collectUniqueLocations(fresh);
      const { data: existing } = await supabase.from("locations").select("name").eq("user_id", user!.id);
      const existingNames = new Set((existing || []).map((l) => l.name.toLowerCase()));
      setNewLocations(allLocs.filter((l) => !existingNames.has(l.name.toLowerCase())));
      setState("preview");
    } catch { toast({ title: t("import.readError"), description: t("import.readErrorDesc"), variant: "destructive" }); }
  };

  const handleImport = async () => {
    if (!user) return; setState("importing"); setProgress(0);
    const total = newLocations.length + flights.length; let done = 0;
    try {
      const locationMap = new Map<string, string>();
      if (newLocations.length > 0) {
        const { data: inserted, error } = await supabase.from("locations").insert(newLocations.map((l) => ({ user_id: user.id, name: l.name, type: l.type, latitude: 0, longitude: 0, description: l.country || null }))).select("id, name");
        if (error) throw error;
        for (const loc of inserted || []) locationMap.set(loc.name.toLowerCase(), loc.id);
        done += newLocations.length; setProgress(Math.round((done / total) * 100));
      }
      const { data: allLocs } = await supabase.from("locations").select("id, name").eq("user_id", user.id);
      for (const loc of allLocs || []) locationMap.set(loc.name.toLowerCase(), loc.id);
      const batchSize = 50; let flightsInserted = 0;
      for (let i = 0; i < flights.length; i += batchSize) {
        const batch = flights.slice(i, i + batchSize).map((f) => ({ user_id: user.id, date: f.date, takeoff_location_id: f.takeoff ? locationMap.get(f.takeoff.toLowerCase()) || null : null, landing_location_id: f.landing ? locationMap.get(f.landing.toLowerCase()) || null : null, duration_minutes: f.durationMinutes, distance_km: f.distanceKm, glider: f.glider || null, comments: f.comments || null, source: "flightbook", source_ref: f.sourceRef }));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- source/source_ref not in generated types.ts yet (migration 0073)
        const { error } = await supabase.from("flights").insert(batch as any); if (error) throw error;
        flightsInserted += batch.length; done += batch.length; setProgress(Math.round((done / total) * 100));
      }
      setResult({ flights: flightsInserted, locations: newLocations.length }); setState("done");
    } catch (err) { toast({ title: t("import.importFailed"), description: err.message, variant: "destructive" }); setState("preview"); }
  };

  return (
    <div className="px-5 pt-5 pb-4 max-w-lg mx-auto space-y-4">
      <header className="flex items-center gap-3">
        <Button variant="outline" size="icon" className="shrink-0" onClick={() => navigate("/profile")} aria-label={t("import.backToProfile")}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="min-w-0 truncate text-[22px] leading-7 font-extrabold tracking-tight">{t("import.importFlights")}</h1>
      </header>
      {state === "idle" && (<Card><CardContent className="pt-6 space-y-4 text-center"><FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground" /><p className="text-sm text-muted-foreground" dangerouslySetInnerHTML={{ __html: t("import.selectXlsx") }} /><input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden" /><Button onClick={() => fileRef.current?.click()} className="gap-2"><Upload className="h-4 w-4" /> {t("import.selectFile")}</Button></CardContent></Card>)}
      {state === "preview" && (<><Card><CardHeader className="pb-2"><CardTitle className="text-base">{t("import.preview")}</CardTitle></CardHeader><CardContent className="space-y-3"><div className="flex gap-4 text-sm"><span className="font-medium">{flights.length} {t("import.flights")}</span><span className="text-muted-foreground">{newLocations.length} {t("import.newLocations")}</span></div><div className="rounded-lg bg-muted/60 p-2.5 text-xs space-y-0.5"><p className="font-medium">{t("import.reconcileTitle")}</p><p>{t("import.reconcileFile", { flights: fileTotals.flights, time: hhmm(fileTotals.minutes) })}</p><p>{t("import.reconcileNew", { flights: flights.length, time: hhmm(totals(flights).minutes) })}</p>{duplicates.length > 0 && <p>{t("import.reconcileDuplicates", { count: duplicates.length })}</p>}{invalidRows.length > 0 && <p className="text-destructive">{t("import.reconcileInvalid", { count: invalidRows.length })}</p>}</div><div className="max-h-64 overflow-auto rounded border"><Table><TableHeader><TableRow><TableHead className="text-xs">{t("import.date")}</TableHead><TableHead className="text-xs">{t("import.takeoff")}</TableHead><TableHead className="text-xs">{t("import.landingCol")}</TableHead><TableHead className="text-xs">{t("import.durationCol")}</TableHead></TableRow></TableHeader><TableBody>{flights.slice(0, 20).map((f, i) => (<TableRow key={i}><TableCell className="text-xs py-1.5">{f.date}</TableCell><TableCell className="text-xs py-1.5">{f.takeoff}</TableCell><TableCell className="text-xs py-1.5">{f.landing}</TableCell><TableCell className="text-xs py-1.5">{f.durationMinutes ? `${f.durationMinutes} min` : "—"}</TableCell></TableRow>))}</TableBody></Table>{flights.length > 20 && <p className="text-xs text-muted-foreground text-center py-2">… {t("import.andMore", { count: flights.length - 20 })}</p>}</div>{newLocations.length > 0 && <p className="text-xs text-muted-foreground">{t("import.dummyCoordsNote")}</p>}{invalidRows.length > 0 && <p className="text-xs text-destructive">{t("import.invalidDateRows", { rows: invalidRows.join(", ") })}</p>}</CardContent></Card><div className="flex gap-2"><Button variant="outline" className="flex-1" onClick={() => { setState("idle"); setFlights([]); setDuplicates([]); }}>{t("common.cancel")}</Button><Button className="flex-1" onClick={handleImport} disabled={flights.length === 0}>{t("import.importFlightsAction")}</Button></div></>)}
      {state === "importing" && (<Card><CardContent className="pt-6 space-y-3 text-center"><p className="text-sm font-medium">{t("import.importing")}…</p><Progress value={progress} className="h-2" /><p className="text-xs text-muted-foreground">{progress}%</p></CardContent></Card>)}
      {state === "done" && (<Card><CardContent className="pt-6 space-y-4 text-center"><CheckCircle2 className="h-12 w-12 mx-auto text-success-soft-foreground" /><p className="text-sm font-medium">{result.flights} {t("import.flights")} & {result.locations} {t("import.newLocations")} {t("import.importDone")}</p><p className="text-xs text-muted-foreground">{t("import.reconcileFile", { flights: fileTotals.flights, time: hhmm(fileTotals.minutes) })}{duplicates.length > 0 ? ` · ${t("import.reconcileDuplicates", { count: duplicates.length })}` : ""}{invalidRows.length > 0 ? ` · ${t("import.reconcileInvalid", { count: invalidRows.length })}` : ""}</p><Button onClick={() => navigate("/flights")} className="w-full">{t("import.toLogbook")}</Button></CardContent></Card>)}
    </div>
  );
}
