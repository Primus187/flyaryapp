import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { filterCandidates, fetchSaleCandidates, sellToMember, type SaleCandidate } from "@/lib/marketplace-billing";
import { marketErrorCode, parsePriceInput, priceInputValue } from "@/lib/marketplace-listing";

interface Props {
  listing: { id: string; title: string; price_cents: number | null };
  onClose: () => void;
  onDone: () => void;
}

/** Plan 7.2: sell a school listing to a member of the school and put it on their bill. */
export default function SellToMemberDialog({ listing, onClose, onDone }: Props) {
  const { t } = useTranslation();
  const [members, setMembers] = useState<SaleCandidate[] | null>(null);
  const [query, setQuery] = useState("");
  const [buyer, setBuyer] = useState<string | null>(null);
  const [price, setPrice] = useState(priceInputValue(listing.price_cents));
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchSaleCandidates(listing.id).then(setMembers).catch(() => setMembers([])); }, [listing.id]);

  const cents = parsePriceInput(price);
  const confirm = async () => {
    if (!buyer || !cents) return;
    setSaving(true);
    try {
      await sellToMember(listing.id, buyer, cents);
      toast.success(t("market.billing.done"));
      onDone();
    } catch (e) {
      toast.error(t(`market.errors.${marketErrorCode(e)}`));
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("market.billing.title")}</DialogTitle>
          <DialogDescription>{t("market.billing.hint", { title: listing.title })}</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label className="text-xs">{t("market.billing.member")}</Label>
          <Input value={query} placeholder={t("market.billing.search")} onChange={(e) => setQuery(e.target.value)} />
          <div className="max-h-48 space-y-1 overflow-y-auto">
            {members !== null && members.length === 0 && <p className="text-xs text-muted-foreground">{t("market.billing.noMembers")}</p>}
            {filterCandidates(members ?? [], query).map((m) => (
              <button key={m.user_id} type="button" onClick={() => setBuyer(m.user_id)}
                className={cn("w-full rounded-md border px-3 py-1.5 text-left text-sm", buyer === m.user_id ? "border-primary bg-primary/10" : "border-border")}>
                {m.pilot_name}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t("market.billing.price")}</Label>
          <Input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
        <DialogFooter>
          <Button disabled={!buyer || !cents || saving} onClick={() => void confirm()}>{t("market.billing.confirm")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
