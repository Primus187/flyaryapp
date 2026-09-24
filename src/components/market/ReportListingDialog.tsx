import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { marketErrorCode } from "@/lib/marketplace-listing";
import { REPORT_REASONS, reportListing, type ReportReason } from "@/lib/marketplace-moderation";

/** "Anzeige melden" (plan 4.8): reason and an optional note; one report per person and listing. */
export default function ReportListingDialog({ listingId, open, onOpenChange }: { listingId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!reason) return;
    setSending(true);
    try {
      await reportListing(listingId, reason, note);
      toast.success(t("market.report.thanks"));
      onOpenChange(false);
      setReason(null);
      setNote("");
    } catch (e) {
      toast.error(t(`market.errors.${marketErrorCode(e)}`));
    }
    setSending(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("market.report.title")}</DialogTitle>
          <DialogDescription>{t("market.report.hint")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          {REPORT_REASONS.map((r) => (
            <button key={r} type="button" onClick={() => setReason(r)}
              className={cn("w-full rounded-md border px-3 py-2 text-left text-sm transition-colors",
                reason === r ? "border-primary bg-primary/10" : "border-border")}>
              {t(`market.report.reasons.${r}`)}
            </button>
          ))}
        </div>
        <Textarea rows={3} maxLength={500} value={note} placeholder={t("market.report.notePlaceholder")} onChange={(e) => setNote(e.target.value)} />
        <DialogFooter>
          <Button disabled={!reason || sending} onClick={() => void send()}>{t("market.report.send")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
