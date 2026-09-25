import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { CheckCircle2, Pencil, Receipt, RotateCcw, Trash2 } from "lucide-react";
import SellToMemberDialog from "@/components/market/SellToMemberDialog";
import { Button } from "@/components/ui/button";
import type { MarketplaceListing } from "@/lib/marketplace";
import { availableActions, marketErrorCode, runListingAction, type ListingAction } from "@/lib/marketplace-listing";
import { deleteListing } from "@/lib/marketplace-photos";

interface Props {
  listing: Pick<MarketplaceListing, "id" | "title" | "status" | "expires_at" | "price_cents" | "seller_group_id">;
  /** Reload the page data after a status change. */
  onChanged: () => void;
}

/**
 * The seller's actions right on their listing: edit, reserve, mark as sold, withdraw (delete) – the same as in the
 * ⋮ menu of "Meine Anzeigen", where they were easy to miss (feedback after the test with Vertical).
 */
export default function OwnerListingActions({ listing, onChanged }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [selling, setSelling] = useState(false);
  const actions = availableActions(listing);
  const can = (a: ListingAction) => actions.includes(a);

  const run = async (action: ListingAction) => {
    if (action === "delete" && !window.confirm(`${t("market.mine.deleteConfirmTitle")}\n${t("market.mine.deleteConfirmText")}`)) return;
    setBusy(true);
    try {
      if (action === "delete") {
        await deleteListing(listing.id);
        toast.success(t("market.mine.deleted"));
        navigate(listing.seller_group_id ? "/school/shop" : "/market/mine", { replace: true });
        return;
      }
      await runListingAction(action as Exclude<ListingAction, "edit" | "delete">, listing.id);
      toast.success(t(action === "publish" ? "market.form.published" : "market.mine.actionDone"));
      onChanged();
    } catch (e) {
      toast.error(t(`market.errors.${marketErrorCode(e)}`));
    }
    setBusy(false);
  };

  const live = listing.status === "active" || listing.status === "reserved";
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" className="gap-1.5" disabled={busy} onClick={() => navigate(`/market/${listing.id}/edit`)}>
          <Pencil className="h-4 w-4" /> {t("market.mine.edit")}
        </Button>
        {can("publish") && <Button className="gap-1.5" disabled={busy} onClick={() => void run("publish")}>{t("market.mine.publish")}</Button>}
        {can("reserve") && <Button variant="outline" disabled={busy} onClick={() => void run("reserve")}>{t("market.mine.reserve")}</Button>}
        {can("unreserve") && <Button variant="outline" disabled={busy} onClick={() => void run("unreserve")}>{t("market.mine.unreserve")}</Button>}
        {can("renew") && !live && (
          <Button variant="outline" className="gap-1.5" disabled={busy} onClick={() => void run("renew")}><RotateCcw className="h-4 w-4" /> {t("market.mine.renew")}</Button>
        )}
      </div>
      {can("sold") && (
        <Button className="w-full gap-1.5" disabled={busy} onClick={() => void run("sold")}>
          <CheckCircle2 className="h-4 w-4" /> {t("market.mine.sold")}
        </Button>
      )}
      {listing.seller_group_id && live && (
        <Button variant="outline" className="w-full gap-1.5" disabled={busy} onClick={() => setSelling(true)}>
          <Receipt className="h-4 w-4" /> {t("market.billing.action")}
        </Button>
      )}
      {can("delete") && (
        <Button variant="ghost" className="w-full gap-1.5 text-destructive" disabled={busy} onClick={() => void run("delete")}>
          <Trash2 className="h-4 w-4" /> {t("market.mine.withdraw")}
        </Button>
      )}
      {selling && (
        <SellToMemberDialog listing={listing} onClose={() => setSelling(false)} onDone={() => { setSelling(false); onChanged(); }} />
      )}
    </div>
  );
}
