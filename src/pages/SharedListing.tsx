import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertTriangle, ImageOff, Info, MapPin, School, Truck, UserRound } from "lucide-react";
import { listingPriceLabel } from "@/components/market/listing-labels";
import { listingDetailRows } from "@/components/market/listing-details";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { rememberAfterLogin } from "@/lib/after-login";
import { fetchSharedListing, type SharedListing as Listing } from "@/lib/marketplace-share";
import { safetyHints } from "@/lib/marketplace-safety";

/** Public page of a shared listing (plan 8.4) – no login needed; contact and chat only inside Flyary. */
export default function SharedListing() {
  const { token } = useParams();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [listing, setListing] = useState<Listing | null | undefined>(undefined);

  useEffect(() => {
    if (!token) return;
    fetchSharedListing(token).then(setListing).catch(() => setListing(null));
  }, [token]);

  if (listing === undefined) {
    return <div className="mx-auto max-w-lg space-y-4 px-4 pt-8"><Skeleton className="aspect-[4/3] w-full rounded-xl" /><Skeleton className="h-24 w-full" /></div>;
  }
  if (listing === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="space-y-3 text-center">
          <p className="text-lg font-semibold text-muted-foreground">{t("market.shared.notAvailable")}</p>
          <Button variant="outline" onClick={() => navigate("/")}>{t("market.shared.discover")}</Button>
        </div>
      </div>
    );
  }

  const openInApp = () => {
    const path = `/market/${listing.id}`;
    if (user) { navigate(path); return; }
    rememberAfterLogin(path);
    navigate("/auth");
  };
  const hints = safetyHints(listing);
  const place = [listing.postal_code, listing.locality].filter(Boolean).join(" ") + (listing.canton && listing.canton !== "other" ? ` (${listing.canton})` : "");

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-lg space-y-4 px-4 pb-10 pt-4">
        <p className="text-sm font-semibold text-primary">{t("market.shared.title")}</p>
        {listing.photos.length > 0 ? (
          <Carousel className="-mx-4">
            <CarouselContent>
              {listing.photos.map((p, i) => (
                <CarouselItem key={i}><div className="aspect-[4/3] bg-muted">{p.url && <img src={p.url} alt="" className="h-full w-full object-contain" />}</div></CarouselItem>
              ))}
            </CarouselContent>
            {listing.photos.length > 1 && <><CarouselPrevious className="left-2" /><CarouselNext className="right-2" /></>}
          </Carousel>
        ) : (
          <div className="-mx-4 flex aspect-[4/3] items-center justify-center bg-muted"><ImageOff className="h-8 w-8 text-muted-foreground" /></div>
        )}

        <div className="space-y-1.5">
          <div className="flex flex-wrap gap-1.5">
            {listing.listing_type === "wanted" && <Badge>{t("market.browse.wantedBadge")}</Badge>}
            {listing.status === "reserved" && <Badge variant="secondary">{t("market.status.reserved")}</Badge>}
            {listing.is_school && <Badge variant="outline">{t("market.browse.school")}</Badge>}
          </div>
          <h1 className="text-xl font-bold leading-tight">{listing.title}</h1>
          <p className="text-2xl font-semibold">
            {listingPriceLabel(listing, t)}
            {listing.school?.vat_registered && listing.price_cents ? <span className="ml-1.5 text-xs font-normal text-muted-foreground">{t("market.shop.inclVat")}</span> : null}
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {place.trim() && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{place}</span>}
            <span className="flex items-center gap-1"><Truck className="h-3.5 w-3.5" />{t(`market.delivery.${listing.delivery}`)}</span>
          </div>
        </div>

        <Button className="w-full" onClick={openInApp}>{t("market.shared.openInApp")}</Button>

        {hints.length > 0 && (
          <Card><CardContent className="space-y-1.5 p-3">
            {hints.map((h) => (
              <p key={h.code} className="flex items-start gap-2 text-xs">
                {h.severity === "warning" ? <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" /> : <Info className="h-4 w-4 shrink-0 text-muted-foreground" />}
                {t(`market.safety.${h.code}`, { months: h.months })}
              </p>
            ))}
          </CardContent></Card>
        )}

        <Card><CardContent className="p-3">
          <p className="mb-2 text-sm font-medium">{t("market.detail.details")}</p>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
            {listingDetailRows(listing, t, i18n.language).map(([label, value]) => (
              <div key={label} className="contents"><dt className="text-muted-foreground">{label}</dt><dd className="text-right">{value}</dd></div>
            ))}
          </dl>
        </CardContent></Card>

        {listing.description.trim() && (
          <Card><CardContent className="p-3">
            <p className="mb-1.5 text-sm font-medium">{t("market.form.description")}</p>
            <p className="whitespace-pre-wrap text-sm">{listing.description}</p>
          </CardContent></Card>
        )}

        <Card><CardContent className="space-y-1 p-3 text-xs">
          <p className="mb-1 flex items-center gap-1.5 text-sm font-medium">
            {listing.school ? <School className="h-4 w-4" /> : <UserRound className="h-4 w-4" />}
            {listing.school ? listing.school.name : t("market.shared.privateSeller")}
          </p>
          {listing.school && (<>
            <p>{listing.school.legal_name}</p>
            <p>{listing.school.street}, {listing.school.postal_code} {listing.school.locality}</p>
            {listing.school.uid_number && <p>{t("market.shop.fields.uid_number")}: {listing.school.uid_number}{listing.school.vat_registered ? " MWST" : ""}</p>}
            <p><a className="underline" href={`mailto:${listing.school.email}`}>{listing.school.email}</a>{listing.school.phone ? ` · ${listing.school.phone}` : ""}</p>
            <p className="whitespace-pre-wrap pt-1 text-muted-foreground">{listing.school.warranty_text}</p>
          </>)}
        </CardContent></Card>

        <Button variant="ghost" className="w-full text-xs" onClick={() => navigate("/")}>{t("market.shared.discover")}</Button>
      </div>
    </div>
  );
}
