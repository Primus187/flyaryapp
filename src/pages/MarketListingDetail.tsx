import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AlertTriangle, Flag, ImageOff, Info, MapPin, MessageCircle, Pencil, School, Share2, Truck } from "lucide-react";
import ReportListingDialog from "@/components/market/ReportListingDialog";
import FavoriteButton from "@/components/market/FavoriteButton";
import { fetchFavoriteIds } from "@/lib/marketplace-favorites";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import LoadingState from "@/components/layout/LoadingState";
import { listingPriceLabel } from "@/components/market/listing-labels";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import type { MarketplaceListing } from "@/lib/marketplace";
import { CATEGORY_SPECS, parseMonthDate, type AttributeField } from "@/lib/marketplace-categories";
import { effectiveStatus, marketErrorCode } from "@/lib/marketplace-listing";
import { openListingChat } from "@/lib/marketplace-chat";
import { listingPhotoUrls, sortPhotos, type ListingPhoto } from "@/lib/marketplace-photos";
import { safetyHints } from "@/lib/marketplace-safety";
import { ageLabel } from "@/lib/marketplace-search";
import { getSignedUrl } from "@/lib/signed-url-cache";
import { fetchShopProfile, type ShopProfile } from "@/lib/school-shop";
import { rememberedWeight, weightFit } from "@/lib/geo-ch";

interface SellerCard {
  seller_kind: "person" | "school";
  seller_id: string;
  name: string | null;
  avatar_url: string | null;
  member_since: string | null;
  flight_count: number | null;
}

/** Listing detail (plan 4.5): gallery, price, details, safety hints, seller. */
export default function MarketListingDetail() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [listing, setListing] = useState<MarketplaceListing | null>(null);
  const [photos, setPhotos] = useState<ListingPhoto[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [seller, setSeller] = useState<SellerCard | null>(null);
  const [avatar, setAvatar] = useState("");
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [contacting, setContacting] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [favorite, setFavorite] = useState(false);
  useEffect(() => { if (id) fetchFavoriteIds().then((ids) => setFavorite(ids.has(id))).catch(() => undefined); }, [id]);
  /** School listings: the shop's legal details (plan 4.7). */
  const [shopProfile, setShopProfile] = useState<ShopProfile | null>(null);

  useEffect(() => {
    if (!id || !user) return;
    (async () => {
      const [{ data: l }, { data: p }, { data: s }, { data: manage }] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not in generated types.ts yet
        supabase.from("marketplace_listings" as any).select("*").eq("id", id).maybeSingle(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not in generated types.ts yet
        supabase.from("marketplace_listing_photos" as any).select("id, listing_id, path, thumb_path, position").eq("listing_id", id),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- function not in generated types.ts yet
        supabase.rpc("marketplace_seller_cards" as any, { _listing_ids: [id] }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- function not in generated types.ts yet
        supabase.rpc("market_can_manage_listing" as any, { _uid: user.id, _listing: id }),
      ]);
      if (!l) { setLoading(false); return; }
      const sorted = sortPhotos((p ?? []) as unknown as ListingPhoto[]);
      setListing(l as unknown as MarketplaceListing);
      setPhotos(sorted);
      setCanManage(manage === true);
      const card = ((s ?? []) as unknown as SellerCard[])[0] ?? null;
      setSeller(card);
      setLoading(false);
      const listingRow = l as unknown as MarketplaceListing;
      if (listingRow.seller_group_id) setShopProfile(await fetchShopProfile(listingRow.seller_group_id));
      setUrls(await listingPhotoUrls(sorted, "full"));
      if (card?.avatar_url) setAvatar(await getSignedUrl("flight-photos", card.avatar_url));
    })();
  }, [id, user]);

  if (loading) return <LoadingState />;
  if (!listing) {
    return (
      <PageContainer>
        <PageHeader title={t("market.title")} back="/market" />
        <p className="text-sm text-muted-foreground">{t("market.errors.not_found")}</p>
      </PageContainer>
    );
  }

  const status = effectiveStatus(listing);
  const spec = CATEGORY_SPECS[listing.category];
  const hints = safetyHints(listing);
  // plan 6.4: compare with the take-off weight last used in the filter (this browser only)
  const myWeight = rememberedWeight();
  const fit = listing.category === "glider" || listing.category === "tandem" ? weightFit(listing.attributes, myWeight) : null;
  const monthFormat = new Intl.DateTimeFormat(i18n.language, { month: "long", year: "numeric" });

  const attributeText = (field: AttributeField, value: unknown): string | null => {
    if (value === undefined || value === null || value === "") return null;
    switch (field.kind) {
      case "select": return t(`market.options.${field.key}.${value}`);
      case "boolean": return value ? t("common.yes") : t("common.no");
      case "month": { const d = parseMonthDate(value); return d ? monthFormat.format(d) : String(value); }
      case "number": {
        const text = field.unit ? `${value} ${field.unit}` : String(value);
        return field.key === "flight_hours" && listing.attributes.hours_from_logbook === true ? `${text} (${t("market.detail.fromLogbook")})` : text;
      }
      default: return String(value);
    }
  };
  const details: [string, string][] = [
    [t("market.form.category"), t(`market.categories.${listing.category}`)],
    ...(listing.condition ? [[t("market.form.condition"), t(`market.conditions.${listing.condition}`)] as [string, string]] : []),
    ...(spec.usesModel ? ([
      [t("market.fields.manufacturer"), listing.manufacturer], [t("market.fields.model"), listing.model],
      [t("market.fields.year"), listing.year ? String(listing.year) : null],
    ] as [string, string | null][]) : []).filter((d): d is [string, string] => !!d[1]),
    ...(listing.size ? [[t("market.fields.size"), listing.size] as [string, string]] : []),
    ...spec.attributes
      .filter((f) => !(f.kind === "boolean" && f.hidden))
      .map((f) => [t(`market.attributes.${f.key}`), attributeText(f, listing.attributes[f.key])] as [string, string | null])
      .filter((d): d is [string, string] => !!d[1]),
  ];

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: listing.title, url });
      else { await navigator.clipboard.writeText(url); toast.success(t("market.detail.linkCopied")); }
    } catch { /* share sheet closed */ }
  };

  const contact = async () => {
    setContacting(true);
    try {
      navigate(await openListingChat(listing.id, t("market.chat.firstQuestion", { title: listing.title })));
    } catch (e) {
      toast.error(t(`market.errors.${marketErrorCode(e)}`));
      setContacting(false);
    }
  };

  const place = [listing.postal_code, listing.locality].filter(Boolean).join(" ") + (listing.canton && listing.canton !== "other" ? ` (${listing.canton})` : "");

  return (
    <PageContainer>
      <PageHeader title={t("market.title")} back
        action={<>
          {!canManage && user && (
            <FavoriteButton userId={user.id} listingId={listing.id} active={favorite} onChange={setFavorite} className="bg-transparent shadow-none" />
          )}
          {!canManage && (
            <Button size="icon" variant="ghost" aria-label={t("market.report.title")} onClick={() => setReportOpen(true)}><Flag className="h-4 w-4" /></Button>
          )}
          <Button size="icon" variant="ghost" aria-label={t("market.detail.share")} onClick={() => void share()}><Share2 className="h-4 w-4" /></Button>
        </>} />
      {!canManage && <ReportListingDialog listingId={listing.id} open={reportOpen} onOpenChange={setReportOpen} />}
      {listing.status === "removed" && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {t("market.moderation.hiddenNotice")}{listing.removed_reason ? `: ${listing.removed_reason}` : ""}
        </p>
      )}

      {photos.length > 0 ? (
        <Carousel className="-mx-4">
          <CarouselContent>
            {photos.map((p) => (
              <CarouselItem key={p.id}>
                <div className="aspect-[4/3] bg-muted">
                  {urls[p.id] && <img src={urls[p.id]} alt="" className="h-full w-full object-contain" />}
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          {photos.length > 1 && <><CarouselPrevious className="left-2" /><CarouselNext className="right-2" /></>}
        </Carousel>
      ) : (
        <div className="-mx-4 flex aspect-[4/3] items-center justify-center bg-muted"><ImageOff className="h-8 w-8 text-muted-foreground" /></div>
      )}

      <div className="space-y-1.5">
        <div className="flex flex-wrap gap-1.5">
          {listing.listing_type === "wanted" && <Badge>{t("market.browse.wantedBadge")}</Badge>}
          {status !== "active" && <Badge variant="secondary">{t(`market.status.${status}`)}</Badge>}
          {listing.seller_group_id && <Badge variant="outline">{t("market.browse.school")}</Badge>}
        </div>
        <h1 className="text-xl font-bold leading-tight">{listing.title}</h1>
        <p className="text-2xl font-semibold">
          {listingPriceLabel(listing, t)}
          {shopProfile?.vat_registered && listing.price_cents ? <span className="ml-1.5 text-xs font-normal text-muted-foreground">{t("market.shop.inclVat")}</span> : null}
        </p>
        {listing.seller_group_id && listing.quantity > 1 && (
          <p className="text-xs text-muted-foreground">{t("market.detail.quantity", { count: listing.quantity })}</p>
        )}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {place.trim() && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{place}</span>}
          <span className="flex items-center gap-1"><Truck className="h-3.5 w-3.5" />{t(`market.delivery.${listing.delivery}`)}</span>
          {listing.bumped_at && <span>{ageLabel(listing.bumped_at, i18n.language)}</span>}
        </div>
      </div>

      {canManage ? (
        <Button variant="outline" className="w-full gap-2" onClick={() => navigate(`/market/${listing.id}/edit`)}>
          <Pencil className="h-4 w-4" /> {t("market.mine.edit")}
        </Button>
      ) : (status === "active" || status === "reserved") && (
        <Button className="w-full gap-2" disabled={contacting} onClick={() => void contact()}>
          <MessageCircle className="h-4 w-4" /> {t("market.chat.contact")}
        </Button>
      )}

      {fit && (
        <p className={fit === "fits" ? "rounded-md bg-green-500/10 px-3 py-2 text-xs text-green-700 dark:text-green-300"
          : "rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300"}>
          {t(fit === "fits" ? "market.radius.weightFits" : "market.radius.weightOutside", { kg: myWeight })}
        </p>
      )}
      {hints.length > 0 && (
        <Card><CardContent className="space-y-1.5 p-3">
          {hints.map((h) => (
            <p key={h.code} className="flex items-start gap-2 text-xs">
              {h.severity === "warning"
                ? <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                : <Info className="h-4 w-4 shrink-0 text-muted-foreground" />}
              {t(`market.safety.${h.code}`, { months: h.months })}
            </p>
          ))}
        </CardContent></Card>
      )}

      <Card><CardContent className="p-3">
        <p className="mb-2 text-sm font-medium">{t("market.detail.details")}</p>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
          {details.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt><dd className="text-right">{value}</dd>
            </div>
          ))}
        </dl>
      </CardContent></Card>

      {listing.description.trim() && (
        <Card><CardContent className="p-3">
          <p className="mb-1.5 text-sm font-medium">{t("market.form.description")}</p>
          <p className="whitespace-pre-wrap text-sm">{listing.description}</p>
        </CardContent></Card>
      )}

      {seller && (
        <Card><CardContent className="flex items-center gap-3 p-3">
          <Avatar className="h-11 w-11">
            {avatar && <AvatarImage src={avatar} />}
            <AvatarFallback>{seller.seller_kind === "school" ? <School className="h-5 w-5" /> : (seller.name ?? "?").slice(0, 1)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">{t("market.detail.seller")}</p>
            <button type="button" className="block truncate text-sm font-medium text-left"
              onClick={() => seller.seller_kind === "person" && navigate(`/pilot/${seller.seller_id}`)}>
              {seller.name ?? "–"}
            </button>
            <p className="truncate text-[11px] text-muted-foreground">
              {[
                seller.seller_kind === "school" ? t("market.browse.school") : null,
                seller.member_since ? t("market.detail.memberSince", { date: monthFormat.format(new Date(seller.member_since)) }) : null,
                seller.flight_count !== null ? t("market.detail.flights", { count: seller.flight_count }) : null,
              ].filter(Boolean).join(" · ")}
            </p>
          </div>
        </CardContent></Card>
      )}

      {shopProfile && (
        <Card><CardContent className="space-y-1 p-3 text-xs">
          <p className="mb-1 text-sm font-medium">{t("market.shop.sellerDetails")}</p>
          <p>{shopProfile.legal_name}</p>
          <p>{shopProfile.street}, {shopProfile.postal_code} {shopProfile.locality}</p>
          {shopProfile.uid_number && <p>{t("market.shop.fields.uid_number")}: {shopProfile.uid_number}{shopProfile.vat_registered ? " MWST" : ""}</p>}
          <p><a className="underline" href={`mailto:${shopProfile.email}`}>{shopProfile.email}</a>{shopProfile.phone ? ` · ${shopProfile.phone}` : ""}</p>
          <p className="pt-1 whitespace-pre-wrap text-muted-foreground">{shopProfile.warranty_text}</p>
        </CardContent></Card>
      )}
    </PageContainer>
  );
}
