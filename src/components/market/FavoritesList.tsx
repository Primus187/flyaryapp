import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Heart, ImageOff } from "lucide-react";
import EmptyState from "@/components/layout/EmptyState";
import FavoriteButton from "@/components/market/FavoriteButton";
import { listingPriceLabel } from "@/components/market/listing-labels";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchMyFavorites, type FavoriteItem } from "@/lib/marketplace-favorites";
import { MARKET_PHOTO_BUCKET } from "@/lib/marketplace-photos";
import { getSignedUrls } from "@/lib/signed-url-cache";

/** "Gemerkt" (plan 6.1): kept listings, including those that are gone, with the reason. */
export default function FavoritesList({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [items, setItems] = useState<FavoriteItem[] | null>(null);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchMyFavorites().then(async (list) => {
      setItems(list);
      const paths = list.map((i) => i.thumb_path).filter((p): p is string => !!p);
      const urls = await getSignedUrls(MARKET_PHOTO_BUCKET, paths);
      setThumbs(Object.fromEntries(list.map((i) => [i.id, i.thumb_path ? urls[i.thumb_path] ?? "" : ""])));
    }).catch(() => setItems([]));
  }, []);

  if (items === null) return <Skeleton className="h-40 w-full rounded-xl" />;
  if (items.length === 0) {
    return <EmptyState icon={Heart} title={t("market.favorites.empty")} description={t("market.favorites.emptyHint")}
      actionLabel={t("market.title")} onAction={() => navigate("/market")} />;
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <Card key={item.id} className={item.available ? undefined : "opacity-70"}>
          <CardContent className="flex items-center gap-3 p-3">
            <button type="button" disabled={!item.available} onClick={() => navigate(`/market/${item.id}`)}
              className="flex min-w-0 flex-1 items-center gap-3 text-left">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                {thumbs[item.id] ? <img src={thumbs[item.id]} alt="" className="h-full w-full object-cover" /> : <ImageOff className="m-4 h-6 w-6 text-muted-foreground" />}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{item.title}</p>
                <p className="truncate text-xs text-muted-foreground">{[listingPriceLabel(item, t), item.locality].filter(Boolean).join(" · ")}</p>
                {!item.available
                  ? <Badge variant="secondary" className="mt-1 text-[10px]">{item.status === "sold" ? t("market.status.sold") : t("market.favorites.unavailable")}</Badge>
                  : item.status === "reserved" && <Badge variant="secondary" className="mt-1 text-[10px]">{t("market.status.reserved")}</Badge>}
              </div>
            </button>
            <FavoriteButton userId={userId} listingId={item.id} active
              onChange={(on) => { if (!on) setItems((prev) => (prev ?? []).filter((i) => i.id !== item.id)); }} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
