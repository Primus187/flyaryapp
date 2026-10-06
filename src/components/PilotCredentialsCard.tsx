import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Award, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { usePilotStatus } from "@/hooks/use-pilot-status";
import { DISCIPLINES } from "@/lib/flight-proof";
import { STUDENT_PHASES, availableGoals, statusLabelKeys, type TrainingLevel } from "@/lib/pilot-status";

const LEVELS = ["pilot", "biplace_1", "biplace_2", "biplace_3"] as const;
const EVIDENCE = ["safety_training", "passenger_care_course", "passenger_care_checkflight", "theory_exam"] as const;
const selectClass = "h-12 w-full rounded-lg border border-input bg-card px-3 text-sm font-medium";
const EMPTY_LICENCE = { discipline: "paraglider", level: "pilot", issued_at: "", licence_number: "" };

interface Licence { id: string; discipline: string; level: string; issued_at: string; licence_number: string | null }
interface Evidence { id: string; kind: string; completed_at: string; note: string | null }

/**
 * Ausbildung und Brevets (migration 0089): student or pilot, the stage of a student, the licences
 * of a pilot with the one worked towards, and dated courses (migration 0075). The training status
 * counts "since the licence" and checks e.g. that the safety training is at most three years old.
 * `children` are further fields of the profile form shown in the same card.
 */
export default function PilotCredentialsCard({ locale, children }: { locale: string; children?: ReactNode }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const { status, schoolStudent, refetch } = usePilotStatus();
  const [licences, setLicences] = useState<Licence[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [newLicence, setNewLicence] = useState(EMPTY_LICENCE);
  const [newEvidence, setNewEvidence] = useState({ kind: "safety_training", completed_at: "", note: "" });
  // declare: a student states the pilot licence; date and number are optional there.
  const [adding, setAdding] = useState<"declare" | "licence" | "evidence" | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const [l, e] = await Promise.all([
      supabase.from("pilot_licences").select("id, discipline, level, issued_at, licence_number").eq("user_id", user.id).order("issued_at"),
      supabase.from("pilot_evidence").select("id, kind, completed_at, note").eq("user_id", user.id).order("completed_at", { ascending: false }),
    ]);
    setLicences((l.data ?? []) as Licence[]);
    setEvidence((e.data ?? []) as Evidence[]);
  }, [user]);
  useEffect(() => { void load(); }, [load]);

  const fail = (message: string) => toast({ title: t("common.error"), description: message, variant: "destructive" });
  const reload = async () => { await Promise.all([load(), refetch()]); };

  const setLevel = async (level: TrainingLevel | null) => {
    if (!user) return;
    const { error } = await supabase.from("profiles").update({ training_level: level }).eq("user_id", user.id);
    if (error) return fail(schoolStudent ? t("settings.trainingLevelBySchool") : error.message);
    await refetch();
  };
  const setGoal = async (goal: string) => {
    if (!user) return;
    const { error } = await supabase.from("profiles").update({ licence_goal: goal || null }).eq("user_id", user.id);
    if (error) return fail(error.message);
    await refetch();
  };
  const saveLicence = async () => {
    if (!user) return;
    const level = adding === "declare" ? "pilot" : newLicence.level;
    if (newLicence.issued_at) {
      // The database makes the holder of a licence a pilot.
      const { error } = await supabase.from("pilot_licences").upsert({
        user_id: user.id, discipline: newLicence.discipline, level, issued_at: newLicence.issued_at,
        licence_number: newLicence.licence_number.trim() || null,
      }, { onConflict: "user_id,discipline,level" });
      if (error) return fail(error.message);
    } else if (adding === "declare") {
      const { error } = await supabase.from("profiles").update({ training_level: "licensed" }).eq("user_id", user.id);
      if (error) return fail(error.message);
    } else return;
    setAdding(null); setNewLicence(EMPTY_LICENCE);
    await reload();
  };
  const saveEvidence = async () => {
    if (!user || !newEvidence.completed_at) return;
    const { error } = await supabase.from("pilot_evidence").insert({
      user_id: user.id, kind: newEvidence.kind, completed_at: newEvidence.completed_at, note: newEvidence.note.trim() || null,
    });
    if (error) return fail(error.message);
    setAdding(null); setNewEvidence({ kind: "safety_training", completed_at: "", note: "" });
    await load();
  };
  const remove = async (table: "pilot_licences" | "pilot_evidence", id: string) => {
    if (!confirm(t("credentials.deleteConfirm"))) return;
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) return fail(error.message);
    await reload();
  };
  const date = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(locale);
  const goals = availableGoals(licences);

  const licenceForm = (
    <div className="grid grid-cols-2 gap-2 rounded-lg border p-3">
      <select className={adding === "declare" ? `${selectClass} col-span-2` : selectClass} value={newLicence.discipline} onChange={(e) => setNewLicence({ ...newLicence, discipline: e.target.value })}>
        {DISCIPLINES.map((d) => <option key={d} value={d}>{t(`flightProof.discipline.${d}`)}</option>)}</select>
      {adding !== "declare" && (
        <select className={selectClass} value={newLicence.level} onChange={(e) => setNewLicence({ ...newLicence, level: e.target.value })}>
          {LEVELS.map((l) => <option key={l} value={l}>{t(`trainingStatus.licence.${l}`)}</option>)}</select>
      )}
      <div className="space-y-1"><Label className="text-xs">{t("credentials.issuedAt")}</Label><Input type="date" value={newLicence.issued_at} onChange={(e) => setNewLicence({ ...newLicence, issued_at: e.target.value })} /></div>
      <div className="space-y-1"><Label className="text-xs">{t("credentials.number")}</Label><Input value={newLicence.licence_number} onChange={(e) => setNewLicence({ ...newLicence, licence_number: e.target.value })} /></div>
      <Button className="col-span-2" disabled={adding !== "declare" && !newLicence.issued_at} onClick={() => void saveLicence()}>
        {adding === "declare" ? t("pilotStatus.confirmPilot") : t("common.save")}</Button>
      <Button variant="ghost" className="col-span-2" onClick={() => setAdding(null)}>{t("common.cancel")}</Button>
    </div>
  );

  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Award className="h-4 w-4 text-primary" />{t("pilotStatus.title")}</CardTitle></CardHeader>
      <CardContent className="space-y-5">
        {status?.kind === "unknown" && (
          <div className="space-y-2">
            <p className="text-sm font-bold">{t("pilotStatus.question")}</p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => void setLevel("ground")}>{t("pilotStatus.student")}</Button>
              <Button variant="outline" onClick={() => void setLevel("licensed")}>{t("pilotStatus.pilot")}</Button>
            </div>
          </div>
        )}

        {status?.kind === "student" && (
          <div className="space-y-3">
            <div className="space-y-1">
              <p className="eyebrow">{t("settings.trainingLevel")}</p>
              <p className="text-lg leading-6 font-extrabold tracking-tight">{schoolStudent ? statusLabelKeys(status).map((key) => t(key)).join(" · ") : t("pilotStatus.student")}</p>
            </div>
            {!schoolStudent && (
              <select aria-label={t("settings.trainingLevel")} className={selectClass} value={status.phase ?? ""} onChange={(e) => void setLevel(e.target.value as TrainingLevel)}>
                {STUDENT_PHASES.map((phase) => <option key={phase} value={phase}>{t(`pilotStatus.level.${phase}`)}</option>)}</select>
            )}
            {adding === "declare" ? licenceForm
              : <Button variant="outline" className="w-full" onClick={() => { setNewLicence(EMPTY_LICENCE); setAdding("declare"); }}>{t("pilotStatus.declarePilot")}</Button>}
          </div>
        )}

        {status?.kind === "pilot" && (
          <>
            <div className="flex items-end justify-between gap-3">
              <div className="space-y-1">
                <p className="eyebrow">{t("settings.trainingLevel")}</p>
                <p className="text-lg leading-6 font-extrabold tracking-tight">{t("pilotStatus.pilot")}</p>
              </div>
              {!schoolStudent && licences.length === 0 && (
                <Button variant="ghost" size="sm" onClick={() => void setLevel(null)}>{t("pilotStatus.reset")}</Button>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between"><p className="eyebrow">{t("pilotStatus.licences")}</p>
                <Button variant="ghost" size="sm" onClick={() => { setNewLicence(EMPTY_LICENCE); setAdding(adding === "licence" ? null : "licence"); }} aria-label={t("pilotStatus.addLicence")}><Plus className="h-4 w-4" /></Button></div>
              {licences.length === 0 && adding !== "licence" && <p className="text-sm text-muted-foreground">{t("pilotStatus.noLicences")}</p>}
              {licences.map((l) => (
                <div key={l.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0"><span className="font-bold">{t(`trainingStatus.licence.${l.level}`)}</span> · {t(`flightProof.discipline.${l.discipline}`)} · {date(l.issued_at)}{l.licence_number ? ` · ${l.licence_number}` : ""}</span>
                  <Button variant="ghost" size="sm" className="shrink-0" onClick={() => void remove("pilot_licences", l.id)} aria-label={t("common.delete")}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              ))}
              {adding === "licence" && licenceForm}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs" htmlFor="licence-goal">{t("pilotStatus.goal")}</Label>
              <select id="licence-goal" className={selectClass} value={status.goal ?? ""} onChange={(e) => void setGoal(e.target.value)}>
                <option value="">{t("pilotStatus.noGoal")}</option>
                {goals.map((goal) => <option key={goal} value={goal}>{t(`trainingStatus.licence.${goal}`)}</option>)}</select>
            </div>
          </>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between"><p className="eyebrow">{t("credentials.evidence")}</p>
            <Button variant="ghost" size="sm" onClick={() => setAdding(adding === "evidence" ? null : "evidence")} aria-label={t("common.add")}><Plus className="h-4 w-4" /></Button></div>
          {evidence.length === 0 && adding !== "evidence" && <p className="text-sm text-muted-foreground">{t("credentials.noEvidence")}</p>}
          {evidence.map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0"><span className="font-bold">{t(`trainingStatus.evidence.${e.kind}`)}</span> · {date(e.completed_at)}{e.note ? ` · ${e.note}` : ""}</span>
              <Button variant="ghost" size="sm" className="shrink-0" onClick={() => void remove("pilot_evidence", e.id)} aria-label={t("common.delete")}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          ))}
          {adding === "evidence" && (
            <div className="grid grid-cols-2 gap-2 rounded-lg border p-3">
              <select className={`${selectClass} col-span-2`} value={newEvidence.kind} onChange={(e) => setNewEvidence({ ...newEvidence, kind: e.target.value })}>
                {EVIDENCE.map((k) => <option key={k} value={k}>{t(`trainingStatus.evidence.${k}`)}</option>)}</select>
              <div className="space-y-1"><Label className="text-xs">{t("credentials.completedAt")}</Label><Input type="date" value={newEvidence.completed_at} onChange={(e) => setNewEvidence({ ...newEvidence, completed_at: e.target.value })} /></div>
              <div className="space-y-1"><Label className="text-xs">{t("credentials.note")}</Label><Input value={newEvidence.note} onChange={(e) => setNewEvidence({ ...newEvidence, note: e.target.value })} /></div>
              <Button className="col-span-2" disabled={!newEvidence.completed_at} onClick={() => void saveEvidence()}>{t("common.save")}</Button>
            </div>
          )}
        </div>

        {children}
      </CardContent>
    </Card>
  );
}
