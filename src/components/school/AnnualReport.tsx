import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Printer, Download, Check, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { levelCountsAtYearEnd, licensedCompletionsInYear } from "@/lib/annual-report";

interface Props {
  groupId: string;
}

interface Submission {
  id: string;
  year: number;
  submitted_at: string | null;
}

export default function AnnualReport({ groupId }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(currentYear - 1));
  const [levelCounts, setLevelCounts] = useState<Record<string, number>>({});
  const [unresolvedLevels, setUnresolvedLevels] = useState(0);
  const [licensedInYear, setLicensedInYear] = useState(0);
  const [monthDays, setMonthDays] = useState<number[]>(Array(12).fill(0));
  const [team, setTeam] = useState<{ name: string; functions: string[]; validUntil: string | null }[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);

  useEffect(() => {
    if (!groupId) return;
    let cancelled = false;
    const load = async () => {
      const [membersRes, eventsRes, funcRes, certRes, subsRes, historyRes] = await Promise.all([
        supabase.from("group_members").select("user_id, role").eq("group_id", groupId),
        supabase
          .from("flight_events")
          .select("event_date, status")
          .eq("group_id", groupId)
          .gte("event_date", `${year}-01-01`)
          .lt("event_date", `${Number(year) + 1}-01-01`)
          .neq("status", "cancelled"),
        supabase.from("group_member_functions").select("user_id, function").eq("group_id", groupId),
        supabase.from("instructor_certifications").select("user_id, cert_type, valid_until").eq("group_id", groupId),
        supabase.from("annual_report_submissions").select("id, year, submitted_at").eq("group_id", groupId),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not in generated types.ts yet
        supabase.from("training_level_history" as any).select("user_id, training_level, changed_at").eq("group_id", groupId),
      ]);

      const studentIds = (membersRes.data || []).filter((m) => m.role === "member").map((m) => m.user_id);
      const funcs = (funcRes.data || []).filter((f) => ["school_lead", "instructor", "launch_helper"].includes(f.function));
      const teamIds = Array.from(new Set(funcs.map((f) => f.user_id)));

      const nameMap: Record<string, string> = {};
      const currentLevels: { user_id: string; training_level: string | null }[] = [];
      const allIds = Array.from(new Set([...studentIds, ...teamIds]));
      if (allIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, pilot_name, training_level")
          .in("user_id", allIds);
        (profs || []).forEach((p) => {
          nameMap[p.user_id] = p.pilot_name || "—";
          if (studentIds.includes(p.user_id)) currentLevels.push({ user_id: p.user_id, training_level: p.training_level });
        });
      }

      const history = (historyRes.data || []) as unknown as { user_id: string; training_level: string; changed_at: string }[];
      const { counts, unresolved } = levelCountsAtYearEnd(studentIds, history, currentLevels, Number(year), currentYear);

      const months = Array(12).fill(0);
      (eventsRes.data || []).forEach((e) => {
        months[new Date(e.event_date).getMonth()] += 1;
      });

      if (cancelled) return;
      setLevelCounts(counts);
      setUnresolvedLevels(unresolved);
      setLicensedInYear(licensedCompletionsInYear(history, Number(year)));
      setMonthDays(months);
      setTeam(
        teamIds
          .map((id) => ({
            name: nameMap[id] || "—",
            functions: funcs.filter((f) => f.user_id === id).map((f) => f.function),
            validUntil: (certRes.data || []).find((c) => c.user_id === id && c.cert_type === "instructor")?.valid_until ?? null,
          }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
      setSubmissions((subsRes.data || []) as Submission[]);
    };
    load();
    return () => { cancelled = true; };
  }, [groupId, year, currentYear]);

  const years = useMemo(
    () => [currentYear, currentYear - 1, currentYear - 2, currentYear - 3].map(String),
    [currentYear],
  );

  const submission = submissions.find((s) => s.year === Number(year));
  const previousOpen = !submissions.find((s) => s.year === currentYear - 1)?.submitted_at;
  const totalDays = monthDays.reduce((a, b) => a + b, 0);

  const toggleSubmitted = async () => {
    const submitted = !submission?.submitted_at;
    const { data } = await supabase
      .from("annual_report_submissions")
      .upsert(
        {
          group_id: groupId,
          year: Number(year),
          submitted_at: submitted ? new Date().toISOString() : null,
          submitted_by: submitted ? user?.id ?? null : null,
        },
        { onConflict: "group_id,year" },
      )
      .select("id, year, submitted_at")
      .single();
    if (data) {
      setSubmissions((prev) => [...prev.filter((s) => s.year !== Number(year)), data as Submission]);
    }
    toast({ title: submitted ? t("school.annual.markedSubmitted") : t("school.annual.markedOpen") });
  };

  const rowsForExport = () => {
    const rows: [string, string][] = [
      [t("school.annual.operatingDays"), String(totalDays)],
      [t("school.annual.licensedInYear", { year }), String(licensedInYear)],
      ...Object.entries(levelCounts).map(([l, count]) => [t(`school.levels.${l}`, { defaultValue: l }), String(count)] as [string, string]),
      [t("school.annual.unknownLevel"), String(unresolvedLevels)],
      ...monthDays.map((d, i) => [`${t("school.annual.month")} ${i + 1}`, String(d)] as [string, string]),
      ...team.map((m) => [
        m.name,
        `${m.functions.map((f) => t(`school.functions.${f}`, { defaultValue: f })).join(" / ")}${m.validUntil ? ` · ${m.validUntil}` : ""}`,
      ] as [string, string]),
    ];
    return rows;
  };

  const downloadCsv = () => {
    const esc = (s: string) => (/[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
    const csv = [`${t("school.annual.key")},${t("school.annual.value")}`, ...rowsForExport().map(([k, v]) => `${esc(k)},${esc(v)}`)].join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `shv-jahresbericht-${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printReport = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${t("school.annual.title")} ${year}</title>
      <style>body{font-family:Helvetica,Arial,sans-serif;margin:32px;color:#111}
      h1{font-size:18px;margin:0 0 16px}table{width:100%;border-collapse:collapse}
      th{text-align:left;width:50%;padding:6px 8px 6px 0;font-size:12px;color:#555}
      td{padding:6px 0;font-size:13px;border-bottom:1px solid #eee}</style></head><body>
      <h1>${t("school.annual.title")} ${year}</h1>
      <table>${rowsForExport().map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join("")}</table>
      </body></html>`);
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <Card className="border-border/60 bg-card/80">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold flex-1">{t("school.annual.title")}</h3>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="h-8 w-24 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {previousOpen && new Date().getMonth() === 0 && (
          <p className="text-xs text-amber-500 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" />
            {t("school.annual.reminder", { year: currentYear - 1 })}
          </p>
        )}

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-xl bg-muted/40 p-2">
            <p className="text-muted-foreground">{t("school.annual.operatingDays")}</p>
            <p className="text-lg font-bold tabular-nums">{totalDays}</p>
          </div>
          <div className="rounded-xl bg-muted/40 p-2">
            <p className="text-muted-foreground">{t("school.annual.licensedInYear", { year })}</p>
            <p className="text-lg font-bold tabular-nums">{licensedInYear}</p>
          </div>
        </div>

        <div className="space-y-1">
          {Object.entries(levelCounts).map(([l, count]) => (
            <div key={l} className="flex justify-between text-xs">
              <span className="text-muted-foreground">{t(`school.levels.${l}`, { defaultValue: l })}</span>
              <span className="tabular-nums">{count}</span>
            </div>
          ))}
          {unresolvedLevels > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">{t("school.annual.unknownLevel")}</span>
              <span className="tabular-nums">{unresolvedLevels}</span>
            </div>
          )}
          {year !== String(currentYear) && (
            <p className="text-[11px] text-muted-foreground pt-1">{t("school.annual.historyHint")}</p>
          )}
        </div>

        <div className="space-y-1">
          {team.map((m) => (
            <div key={m.name} className="flex items-center justify-between text-xs gap-2">
              <span className="truncate">{m.name}</span>
              <Badge variant={m.validUntil ? "outline" : "secondary"} className="text-[10px] shrink-0">
                {m.validUntil ? m.validUntil : t("school.certs.none")}
              </Badge>
            </div>
          ))}
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="secondary" onClick={printReport}>
            <Printer className="h-3.5 w-3.5 mr-1" />
            {t("school.annual.print")}
          </Button>
          <Button size="sm" variant="secondary" onClick={downloadCsv}>
            <Download className="h-3.5 w-3.5 mr-1" />
            {t("school.annual.csv")}
          </Button>
          <Button size="sm" variant="ghost" onClick={toggleSubmitted}>
            <Check className="h-3.5 w-3.5 mr-1" />
            {submission?.submitted_at ? t("school.annual.markOpen") : t("school.annual.markSubmitted")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
