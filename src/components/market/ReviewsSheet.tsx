import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Flag } from "lucide-react";
import { Stars } from "@/components/market/Stars";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { marketErrorCode } from "@/lib/marketplace-listing";
import { fetchReviewsOf, reportReview, type Review } from "@/lib/marketplace-reviews";

interface Props {
  seller: { kind: "person" | "school"; id: string; name: string | null };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Plan 8.1: the reviews of a seller (as seller and as buyer), each can be reported. */
export default function ReviewsSheet({ seller, open, onOpenChange }: Props) {
  const { t, i18n } = useTranslation();
  const [reviews, setReviews] = useState<Review[] | null>(null);

  useEffect(() => {
    if (!open) return;
    fetchReviewsOf(seller.kind === "school" ? { groupId: seller.id } : { userId: seller.id }).then(setReviews).catch(() => setReviews([]));
  }, [open, seller.kind, seller.id]);

  const report = async (review: Review) => {
    if (!window.confirm(t("market.reviews.reportConfirm"))) return;
    try {
      await reportReview(review.id);
      toast.success(t("market.reviews.reported"));
      setReviews((list) => list?.map((r) => (r.id === review.id ? { ...r, reported: true } : r)) ?? null);
    } catch (e) {
      toast.error(t(`market.errors.${marketErrorCode(e)}`));
    }
  };

  const dateFormat = new Intl.DateTimeFormat(i18n.language, { month: "short", year: "numeric" });
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
        <SheetHeader><SheetTitle>{t("market.reviews.listTitle", { name: seller.name ?? "–" })}</SheetTitle></SheetHeader>
        <div className="mt-3 space-y-3">
          {reviews?.length === 0 && <p className="text-sm text-muted-foreground">{t("market.reviews.none")}</p>}
          {reviews?.map((r) => (
            <div key={r.id} className={r.hidden ? "space-y-1 border-b pb-2 opacity-50" : "space-y-1 border-b pb-2"}>
              <div className="flex items-center gap-2">
                <Stars value={r.rating} />
                <span className="text-xs text-muted-foreground">
                  {r.reviewer_name} · {t(`market.reviews.as_${r.direction}`)} · {dateFormat.format(new Date(r.created_at))}
                </span>
                {!r.reported && !r.hidden && (
                  <Button size="icon" variant="ghost" className="ml-auto h-7 w-7" aria-label={t("market.reviews.report")} onClick={() => void report(r)}>
                    <Flag className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              {r.comment && <p className="whitespace-pre-wrap text-sm">{r.comment}</p>}
              <p className="text-[11px] text-muted-foreground">{r.listing_title}</p>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
