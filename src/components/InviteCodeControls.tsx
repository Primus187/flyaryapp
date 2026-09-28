import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Copy, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { loadInviteCode, renewInviteCode } from "@/lib/invite-code";

/** Invite code of a group for its admins: show, copy, renew. */
export default function InviteCodeControls({ groupId, compact = false }: { groupId: string; compact?: boolean }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { void loadInviteCode(groupId).then(setCode); }, [groupId]);

  const copy = useCallback(() => {
    if (!code) return;
    void navigator.clipboard.writeText(code);
    toast({ title: t("groups.codeCopied") });
  }, [code, t, toast]);

  const renew = async () => {
    if (!confirm(t("groups.renewConfirm"))) return;
    setBusy(true);
    try {
      setCode(await renewInviteCode(groupId));
      toast({ title: t("groups.renewed") });
    } catch (err: unknown) {
      toast({ title: t("common.error"), description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally { setBusy(false); }
  };

  if (!code) return null;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <code className={`flex-1 ${compact ? "text-[11px]" : "text-xs"} bg-muted rounded-md px-3 py-2 truncate`}>{code}</code>
        <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={copy}><Copy className="h-3.5 w-3.5" /> {t("groups.copy")}</Button>
        <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => { void renew(); }} disabled={busy} aria-label={t("groups.renew")} title={t("groups.renew")}>
          <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">{t("groups.renewHint")}</p>
    </div>
  );
}
