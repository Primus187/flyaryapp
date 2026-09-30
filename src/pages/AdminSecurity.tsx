import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Smartphone, Trash2 } from "lucide-react";
import { toast } from "sonner";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import LoadingState from "@/components/layout/LoadingState";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EnrollTotp } from "@/components/admin/AdminMfaGate";
import { loadMfa, removeFactor, type TotpFactor } from "@/lib/admin-mfa";

/** Betriebsbereich "Zwei-Faktor" (migration 0088): devices with the authenticator app, add or remove one. */
export default function AdminSecurity() {
  const { t, i18n } = useTranslation();
  const [factors, setFactors] = useState<TotpFactor[] | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try { setFactors((await loadMfa()).factors); } catch { toast.error(t("common.error")); setFactors([]); }
  }, [t]);
  useEffect(() => { void load(); }, [load]);

  const remove = async (factor: TotpFactor) => {
    if (factors && factors.length <= 1) { toast.error(t("adminMfa.lastFactor")); return; }
    if (!confirm(t("adminMfa.removeConfirm", { name: factor.name }))) return;
    try { await removeFactor(factor.id); toast.success(t("adminMfa.removed")); await load(); } catch { toast.error(t("common.error")); }
  };

  return (
    <PageContainer className="space-y-4">
      <PageHeader title={t("ops.nav.security")} subtitle={t("adminMfa.securitySubtitle")} back="/admin" />
      {factors === null ? <LoadingState header={false} /> : (
        <Card className="border-0 shadow-sm">
          <CardContent className="divide-y p-0">
            {factors.map((f) => (
              <div key={f.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <Smartphone className="h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{f.name}</p>
                  <p className="text-xs text-muted-foreground">{t("adminMfa.since", { date: new Date(f.createdAt).toLocaleDateString(i18n.language) })}</p>
                </div>
                <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={t("common.delete")} disabled={factors.length <= 1} onClick={() => void remove(f)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      <p className="text-xs text-muted-foreground">{t("adminMfa.backupHint")}</p>
      {adding ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="space-y-3 p-4">
            <p className="text-sm font-semibold">{t("adminMfa.addTitle")}</p>
            <EnrollTotp onDone={() => { setAdding(false); void load(); }} />
          </CardContent>
        </Card>
      ) : (
        <Button variant="outline" className="gap-2" onClick={() => setAdding(true)}><Smartphone className="h-4 w-4" />{t("adminMfa.add")}</Button>
      )}
    </PageContainer>
  );
}
