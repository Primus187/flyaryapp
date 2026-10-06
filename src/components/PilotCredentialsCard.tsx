import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Award, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { DISCIPLINES } from "@/lib/flight-proof";

const LEVELS = ["pilot", "biplace_1", "biplace_2", "biplace_3"] as const;
const EVIDENCE = ["safety_training", "passenger_care_course", "passenger_care_checkflight", "theory_exam"] as const;
const selectClass = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";

interface Licence { id: string; discipline: string; level: string; issued_at: string; licence_number: string | null }
interface Evidence { id: string; kind: string; completed_at: string; note: string | null }

/**
 * Pilot licences with issue date and dated courses (migration 0075). The training status counts
 * "since the licence" and checks e.g. that the safety training is at most three years old.
 */
export default function PilotCredentialsCard({ locale }: { locale: string }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [licences, setLicences] = useState<Licence[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [newLicence, setNewLicence] = useState({ discipline: "paraglider", level: "pilot", issued_at: "", licence_number: "" });
  const [newEvidence, setNewEvidence] = useState({ kind: "safety_training", completed_at: "", note: "" });
  const [adding, setAdding] = useState<"licence" | "evidence" | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const [l, e] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not in generated types.ts yet (migration 0075)
      supabase.from("pilot_licences" as any).select("id, discipline, level, issued_at, licence_number").eq("user_id", user.id).order("issued_at"),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not in generated types.ts yet (migration 0075)
      supabase.from("pilot_evidence" as any).select("id, kind, completed_at, note").eq("user_id", user.id).order("completed_at", { ascending: false }),
    ]);
    setLicences((l.data ?? []) as unknown as Licence[]);
    setEvidence((e.data ?? []) as unknown as Evidence[]);
  }, [user]);
  useEffect(() => { void load(); }, [load]);

  const fail = (message: string) => toast({ title: t("common.error"), description: message, variant: "destructive" });

  const saveLicence = async () => {
    if (!user || !newLicence.issued_at) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not in generated types.ts yet (migration 0075)
    const { error } = await supabase.from("pilot_licences" as any).upsert({
      user_id: user.id, discipline: newLicence.discipline, level: newLicence.level, issued_at: newLicence.issued_at,
      licence_number: newLicence.licence_number.trim() || null,
    }, { onConflict: "user_id,discipline,level" });
    if (error) return fail(error.message);
    setAdding(null); setNewLicence({ discipline: "paraglider", level: "pilot", issued_at: "", licence_number: "" });
    await load();
  };
  const saveEvidence = async () => {
    if (!user || !newEvidence.completed_at) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not in generated types.ts yet (migration 0075)
    const { error } = await supabase.from("pilot_evidence" as any).insert({
      user_id: user.id, kind: newEvidence.kind, completed_at: newEvidence.completed_at, note: newEvidence.note.trim() || null,
    });
    if (error) return fail(error.message);
    setAdding(null); setNewEvidence({ kind: "safety_training", completed_at: "", note: "" });
    await load();
  };
  const remove = async (table: "pilot_licences" | "pilot_evidence", id: string) => {
    if (!confirm(t("credentials.deleteConfirm"))) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not in generated types.ts yet (migration 0075)
    const { error } = await supabase.from(table as any).delete().eq("id", id);
    if (error) return fail(error.message);
    await load();
  };
  const date = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(locale);

  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Award className="h-4 w-4 text-primary" />{t("credentials.title")}</CardTitle>
        <p className="text-xs text-muted-foreground">{t("credentials.hint")}</p></CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("credentials.licences")}</p>
            <Button variant="ghost" size="sm" className="h-7" onClick={() => setAdding(adding === "licence" ? null : "licence")}><Plus className="h-3.5 w-3.5" /></Button></div>
          {licences.length === 0 && adding !== "licence" && <p className="text-xs text-muted-foreground">{t("credentials.noLicences")}</p>}
          {licences.map((l) => (
            <div key={l.id} className="flex items-center justify-between text-sm">
              <span>{t(`flightProof.discipline.${l.discipline}`)} · {t(`trainingStatus.licence.${l.level}`)} · {date(l.issued_at)}{l.licence_number ? ` · ${l.licence_number}` : ""}</span>
              <Button variant="ghost" size="sm" className="h-7" onClick={() => void remove("pilot_licences", l.id)} aria-label={t("common.delete")}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
            </div>
          ))}
          {adding === "licence" && (
            <div className="grid grid-cols-2 gap-2 p-2 border rounded-lg">
              <select className={selectClass} value={newLicence.discipline} onChange={(e) => setNewLicence({ ...newLicence, discipline: e.target.value })}>
                {DISCIPLINES.map((d) => <option key={d} value={d}>{t(`flightProof.discipline.${d}`)}</option>)}</select>
              <select className={selectClass} value={newLicence.level} onChange={(e) => setNewLicence({ ...newLicence, level: e.target.value })}>
                {LEVELS.map((l) => <option key={l} value={l}>{t(`trainingStatus.licence.${l}`)}</option>)}</select>
              <div className="space-y-1"><Label className="text-xs">{t("credentials.issuedAt")}</Label><Input type="date" value={newLicence.issued_at} onChange={(e) => setNewLicence({ ...newLicence, issued_at: e.target.value })} /></div>
              <div className="space-y-1"><Label className="text-xs">{t("credentials.number")}</Label><Input value={newLicence.licence_number} onChange={(e) => setNewLicence({ ...newLicence, licence_number: e.target.value })} /></div>
              <Button size="sm" className="col-span-2" disabled={!newLicence.issued_at} onClick={() => void saveLicence()}>{t("common.save")}</Button>
            </div>
          )}
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("credentials.evidence")}</p>
            <Button variant="ghost" size="sm" className="h-7" onClick={() => setAdding(adding === "evidence" ? null : "evidence")}><Plus className="h-3.5 w-3.5" /></Button></div>
          {evidence.length === 0 && adding !== "evidence" && <p className="text-xs text-muted-foreground">{t("credentials.noEvidence")}</p>}
          {evidence.map((e) => (
            <div key={e.id} className="flex items-center justify-between text-sm">
              <span>{t(`trainingStatus.evidence.${e.kind}`)} · {date(e.completed_at)}{e.note ? ` · ${e.note}` : ""}</span>
              <Button variant="ghost" size="sm" className="h-7" onClick={() => void remove("pilot_evidence", e.id)} aria-label={t("common.delete")}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
            </div>
          ))}
          {adding === "evidence" && (
            <div className="grid grid-cols-2 gap-2 p-2 border rounded-lg">
              <select className={`${selectClass} col-span-2`} value={newEvidence.kind} onChange={(e) => setNewEvidence({ ...newEvidence, kind: e.target.value })}>
                {EVIDENCE.map((k) => <option key={k} value={k}>{t(`trainingStatus.evidence.${k}`)}</option>)}</select>
              <div className="space-y-1"><Label className="text-xs">{t("credentials.completedAt")}</Label><Input type="date" value={newEvidence.completed_at} onChange={(e) => setNewEvidence({ ...newEvidence, completed_at: e.target.value })} /></div>
              <div className="space-y-1"><Label className="text-xs">{t("credentials.note")}</Label><Input value={newEvidence.note} onChange={(e) => setNewEvidence({ ...newEvidence, note: e.target.value })} /></div>
              <Button size="sm" className="col-span-2" disabled={!newEvidence.completed_at} onClick={() => void saveEvidence()}>{t("common.save")}</Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
