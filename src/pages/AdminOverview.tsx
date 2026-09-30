import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BadgeCheck, Bug, Database, HardDrive, Store, UserPlus, type LucideIcon } from "lucide-react";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import SectionHeading from "@/components/layout/SectionHeading";
import ListRow from "@/components/layout/ListRow";
import LoadingState from "@/components/layout/LoadingState";
import { backupStatus, fetchOpsOverview, type OpsOverview } from "@/lib/ops-overview";
import { formatBytes, usageLevel } from "@/lib/storage-usage";
import { cn } from "@/lib/utils";

type Tone = "calm" | "open" | "alert";

function Tile({ icon: Icon, label, value, hint, tone, onClick }: {
  icon: LucideIcon; label: string; value: string; hint?: string; tone: Tone; onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick}
      className={cn("flex flex-col gap-1 rounded-xl border p-4 text-left shadow-sm transition-all hover:bg-muted/50 active:scale-[0.98]",
        tone === "alert" ? "border-destructive/40 bg-destructive/5" : tone === "open" ? "border-primary/40 bg-card" : "border-border/50 bg-card")}>
      <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon className={cn("h-4 w-4", tone === "alert" ? "text-destructive" : "text-primary")} />{label}
      </span>
      <span className={cn("text-2xl font-bold tracking-tight", tone === "alert" && "text-destructive")}>{value}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </button>
  );
}

/** Betriebsbereich start page: what is waiting for the Flyary admin (ops_overview, migration 0083). */
export default function AdminOverview() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [data, setData] = useState<OpsOverview | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetchOpsOverview().then(setData).catch(() => setFailed(true));
  }, []);

  const when = (iso: string | null) => iso ? new Date(iso).toLocaleString(i18n.language, { dateStyle: "short", timeStyle: "short" }) : "–";
  const count = (n: number): Tone => (n > 0 ? "open" : "calm");

  return (
    <PageContainer className="space-y-5">
      <PageHeader title={t("ops.title")} subtitle={t("ops.subtitle")} back="/more" />
      {failed ? <p className="text-sm text-destructive">{t("ops.loadFailed")}</p> : !data ? <LoadingState header={false} /> : (() => {
        const backup = backupStatus(data);
        const storage = usageLevel(data.storage_bytes);
        return (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Tile icon={UserPlus} label={t("ops.nav.waitlist")} value={String(data.waitlist_open)} hint={t("ops.tiles.waitlist")}
              tone={count(data.waitlist_open)} onClick={() => navigate("/admin/access")} />
            <Tile icon={Bug} label={t("ops.nav.errors")} value={String(data.errors_open)}
              hint={t("ops.tiles.errors", { new: data.errors_new_24h })}
              tone={data.errors_new_24h > 0 ? "alert" : count(data.errors_open)} onClick={() => navigate("/admin/errors")} />
            <Tile icon={Store} label={t("ops.nav.market")} value={String(data.market_reports_open)} hint={t("ops.tiles.market")}
              tone={count(data.market_reports_open)} onClick={() => navigate("/market/moderation")} />
            <Tile icon={HardDrive} label={t("ops.nav.backups")} value={t(`ops.backup.${backup}`)}
              hint={t("ops.tiles.backupLast", { when: when(data.backup_last_success_at) })}
              tone={backup === "ok" ? "calm" : "alert"} onClick={() => navigate("/admin/backups")} />
            <Tile icon={Database} label={t("ops.tiles.storage")} value={formatBytes(data.storage_bytes, i18n.language)}
              hint={t("ops.tiles.storageHint", { percent: storage.percent })}
              tone={storage.warn ? "alert" : "calm"} onClick={() => navigate("/market/moderation")} />
          </div>
        );
      })()}
      <section className="lg:hidden">
        <SectionHeading title={t("ops.more")} />
        <ListRow icon={BadgeCheck} label={t("ops.nav.sites")} description={t("adminSites.subtitle")} onClick={() => navigate("/admin/sites")} />
      </section>
    </PageContainer>
  );
}
