import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { acceptTerms } from "@/lib/marketplace-terms";

/** One-time marketplace rules before the first listing (plan 4.10). Closing without accepting leaves the form. */
export default function MarketTermsDialog({ userId, onAccepted, onCancel }: { userId: string; onAccepted: () => void; onCancel: () => void }) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);

  const accept = async () => {
    setSaving(true);
    try {
      await acceptTerms(userId);
      onAccepted();
    } catch {
      toast.error(t("market.errors.unknown"));
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("market.terms.title")}</DialogTitle>
          <DialogDescription>{t("market.terms.intro")}</DialogDescription>
        </DialogHeader>
        <ul className="list-disc space-y-1.5 pl-5 text-sm">
          {[1, 2, 3, 4].map((n) => <li key={n}>{t(`market.terms.rule${n}`)}</li>)}
        </ul>
        <Link to="/legal/terms" className="text-xs underline text-muted-foreground">{t("legal.termsTitle")}</Link>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel}>{t("market.terms.cancel")}</Button>
          <Button disabled={saving} onClick={() => void accept()}>{t("market.terms.accept")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
