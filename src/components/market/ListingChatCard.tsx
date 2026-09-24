import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ImageOff, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { listingPriceLabel } from "@/components/market/listing-labels";
import type { ListingChatInfo } from "@/lib/chat";
import { MARKET_PHOTO_BUCKET } from "@/lib/marketplace-photos";
import { getSignedUrl } from "@/lib/signed-url-cache";

/** Head of a listing chat (plan 4.6): the listing as a small card, plus the fixed safety note. */
export default function ListingChatCard({ info }: { info: ListingChatInfo }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [thumb, setThumb] = useState("");

  useEffect(() => {
    if (info.thumb_path) void getSignedUrl(MARKET_PHOTO_BUCKET, info.thumb_path).then(setThumb);
  }, [info.thumb_path]);

  const available = info.status === "active" || info.status === "reserved";
  const price = info.price_type && info.listing_type
    ? listingPriceLabel({ price_type: info.price_type, price_cents: info.price_cents, listing_type: info.listing_type }, t)
    : "";

  return (
    <div className="space-y-2">
      <button type="button" disabled={!info.listing_id} onClick={() => info.listing_id && navigate(`/market/${info.listing_id}`)}
        className="flex w-full items-center gap-3 rounded-xl border border-border/50 bg-card p-2 text-left shadow-sm disabled:opacity-70">
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted">
          {thumb ? <img src={thumb} alt="" className="h-full w-full object-cover" /> : <ImageOff className="m-3 h-6 w-6 text-muted-foreground" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{info.title}</p>
          <p className="truncate text-xs text-muted-foreground">{info.listing_id ? price : t("market.chat.listingGone")}</p>
        </div>
        {info.listing_id && info.status !== "active" && (
          <Badge variant={available ? "secondary" : "outline"} className="shrink-0 text-[10px]">{t(`market.status.${info.status}`)}</Badge>
        )}
      </button>
      <p className="flex items-start gap-1.5 rounded-md bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-800 dark:text-amber-300">
        <ShieldAlert className="h-3.5 w-3.5 shrink-0 mt-px" /> {t("market.chat.safety")}
      </p>
    </div>
  );
}
