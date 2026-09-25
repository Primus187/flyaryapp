import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileDown, FileSpreadsheet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { downloadBlob } from "@/lib/csv-export";
import {
  categoryLabel, proofCsv, proofFileName, swissDate, type SchoolProof,
} from "../../../supabase/functions/export-flightbook-pdf/school-proof";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration 0058 not in generated types.ts yet
const db = supabase as any;

interface Props { groupId: string; studentId: string }

/** Training proof for the SHV in the student dossier (Flugtag-Cockpit 6.2): the school's flights,
 *  the number of flying sites, PDF with a field for stamp and signature, CSV for the school's records. */
export default function SchoolProofPanel({ groupId, studentId }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);

  const query = useQuery({
    queryKey: ["school-proof", groupId, studentId, from, to],
    queryFn: async () => {
      const { data, error } = await db.rpc("school_student_proof", { _group_id: groupId, _student_id: studentId, _from: from || null, _to: to || null });
      if (error) throw error;
      return data as SchoolProof;
    },
  });
  const proof = query.data;

  // One line per flying day: date, event, number of flights, sites.
  const days = useMemo(() => {
    const map = new Map<string, { date: string; event: string; category: string | null; count: number; sites: Set<string> }>();
    for (const f of proof?.flights || []) {
      const key = `${f.date}|${f.event}`;
      const day = map.get(key) || { date: f.date, event: f.event || "", category: f.category, count: 0, sites: new Set<string>() };
      day.count += 1;
      if (f.takeoff) day.sites.add(f.takeoff);
      map.set(key, day);
    }
    return [...map.values()].reverse();
  }, [proof]);

  const downloadPdf = async () => {
    setPdfBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("no session");
      const params = new URLSearchParams({ mode: "school_proof", group_id: groupId, student_id: studentId });
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/export-flightbook-pdf?${params}`, {
        headers: { Authorization: `Bearer ${session.access_token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
      });
      if (!res.ok) throw new Error(String(res.status));
      downloadBlob(await res.blob(), proof ? proofFileName(proof, "pdf") : "ausbildungsnachweis.pdf");
    } catch {
      toast({ title: t("dossier.proof.pdfFailed"), variant: "destructive" });
    } finally {
      setPdfBusy(false);
    }
  };

  const downloadCsv = () => {
    if (!proof) return;
    downloadBlob(new Blob([proofCsv(proof)], { type: "text/csv;charset=utf-8" }), proofFileName(proof, "csv"));
  };

  return (
    <section className="rounded-2xl border bg-card p-4 space-y-4">
      <h2 className="font-semibold">{t("dossier.sections.proof")}</h2>
      <p className="text-xs text-muted-foreground">{t("dossier.proof.hint")}</p>
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1 text-xs text-muted-foreground">{t("dossier.proof.from")}
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">{t("dossier.proof.to")}
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>

      {query.isPending ? <p role="status">{t("common.loading")}</p> : query.isError || !proof ? (
        <div role="alert" className="space-y-2"><p>{t("dossier.loadFailed")}</p><Button variant="outline" onClick={() => void query.refetch()}>{t("performance.retry")}</Button></div>
      ) : <>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div><dt className="text-xs text-muted-foreground">{t("dossier.proof.total")}</dt><dd className="text-xl font-semibold">{proof.total}</dd></div>
          <div><dt className="text-xs text-muted-foreground">{t("dossier.proof.sites")}</dt><dd className="text-xl font-semibold">{proof.sites}</dd></div>
          <div><dt className="text-xs text-muted-foreground">{t("dossier.proof.practice")}</dt><dd>{proof.practice}</dd></div>
          <div><dt className="text-xs text-muted-foreground">{t("dossier.proof.altitude")}</dt><dd>{proof.altitude}</dd></div>
          <div><dt className="text-xs text-muted-foreground">{t("dossier.proof.days")}</dt><dd>{proof.days}</dd></div>
          <div><dt className="text-xs text-muted-foreground">{t("dossier.proof.selfLogged")}</dt><dd>{proof.selfLogged}</dd></div>
        </dl>

        <div className="flex gap-2">
          <Button className="flex-1 gap-1.5" onClick={downloadPdf} disabled={pdfBusy || proof.total === 0}><FileDown className="h-4 w-4" />{t("dossier.proof.pdf")}</Button>
          <Button variant="outline" className="gap-1.5" onClick={downloadCsv} disabled={proof.total === 0}><FileSpreadsheet className="h-4 w-4" />CSV</Button>
        </div>

        {days.length === 0 ? <p className="text-sm text-muted-foreground">{t("dossier.proof.empty")}</p> : (
          <ul className="divide-y text-sm">
            {days.map((d) => (
              <li key={`${d.date}|${d.event}`} className="py-2">
                <p className="flex justify-between gap-2"><span className="font-medium">{swissDate(d.date)} · {d.event}</span><span className="shrink-0">{t("dossier.proof.flights", { count: d.count })}</span></p>
                <p className="text-xs text-muted-foreground">{[categoryLabel(d.category), [...d.sites].join(", ")].filter(Boolean).join(" · ")}</p>
              </li>
            ))}
          </ul>
        )}
        <p className="text-[11px] text-muted-foreground">{t("dossier.proof.since")}</p>
      </>}
    </section>
  );
}
