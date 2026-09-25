import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { marketErrorCode, runListingAction } from "@/lib/marketplace-listing";
import { fetchChatBuyers, markSoldTo, type ChatBuyer } from "@/lib/marketplace-reviews";

interface Props {
  listing: { id: string; title: string };
  onClose: () => void;
  onDone: () => void;
}

/** "Mark as sold" (plan 8.1): who bought it? Buyers from the listing chats can then review each other. */
export default function MarkSoldDialog({ listing, onClose, onDone }: Props) {
  const { t } = useTranslation();
  const [buyers, setBuyers] = useState<ChatBuyer[] | null>(null);
  /** A buyer's id, or "" for someone else (no review). */
  const [buyer, setBuyer] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchChatBuyers(listing.id).then(setBuyers).catch(() => setBuyers([])); }, [listing.id]);

  const confirm = async () => {
    setSaving(true);
    try {
      if (buyer) await markSoldTo(listing.id, buyer);
      else await runListingAction("sold", listing.id);
      toast.success(t(buyer ? "market.reviews.soldTo" : "market.mine.actionDone"));
      onDone();
    } catch (e) {
      toast.error(t(`market.errors.${marketErrorCode(e)}`));
      setSaving(false);
    }
  };

  const option = (id: string, label: string) => (
    <button key={id || "other"} type="button" onClick={() => setBuyer(id)}
      className={cn("w-full rounded-md border px-3 py-1.5 text-left text-sm", buyer === id ? "border-primary bg-primary/10" : "border-border")}>
      {label}
    </button>
  );

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("market.reviews.soldTitle")}</DialogTitle>
          <DialogDescription>{t(buyers?.length ? "market.reviews.soldHint" : "market.reviews.soldNoChats", { title: listing.title })}</DialogDescription>
        </DialogHeader>
        {buyers && buyers.length > 0 && (
          <div className="max-h-56 space-y-1 overflow-y-auto">
            {buyers.map((b) => option(b.user_id, b.pilot_name))}
            {option("", t("market.reviews.someoneElse"))}
          </div>
        )}
        <DialogFooter>
          <Button disabled={buyers === null || saving} onClick={() => void confirm()}>{t("market.mine.sold")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
