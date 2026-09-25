import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { StarInput } from "@/components/market/Stars";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { marketErrorCode } from "@/lib/marketplace-listing";
import { MAX_REVIEW_COMMENT, submitReview, type ReviewDirection } from "@/lib/marketplace-reviews";

interface Props {
  listing: { id: string; title: string };
  direction: ReviewDirection;
  onClose: () => void;
  onDone: () => void;
}

/** Plan 8.1: 1–5 stars and an optional short comment, once per sale and side. */
export default function ReviewDialog({ listing, direction, onClose, onDone }: Props) {
  const { t } = useTranslation();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await submitReview(listing.id, rating, comment);
      toast.success(t("market.reviews.thanks"));
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
          <DialogTitle>{t(`market.reviews.title_${direction}`)}</DialogTitle>
          <DialogDescription>{t("market.reviews.hint", { title: listing.title })}</DialogDescription>
        </DialogHeader>
        <StarInput value={rating} onChange={setRating} label={(n) => t("market.reviews.stars", { count: n })} />
        <Textarea value={comment} maxLength={MAX_REVIEW_COMMENT} rows={3} placeholder={t("market.reviews.commentPlaceholder")}
          onChange={(e) => setComment(e.target.value)} />
        <DialogFooter>
          <Button disabled={rating === 0 || saving} onClick={() => void save()}>{t("market.reviews.submit")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
