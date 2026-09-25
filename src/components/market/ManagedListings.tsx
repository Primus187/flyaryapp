import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ImageOff, MoreVertical, Store } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import EmptyState from "@/components/layout/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { listingPriceLabel } from "@/components/market/listing-labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { MarketplaceListing } from "@/lib/marketplace";
import {
  EXPIRY_WARNING_DAYS, availableActions, daysLeft, effectiveStatus, marketErrorCode, mineTab, nextBumpAt, runListingAction,
  type ListingAction, type MarketErrorCode, type MineTab,
} from "@/lib/marketplace-listing";
import { coverThumbnails, deleteListing } from "@/lib/marketplace-photos";
import MarkSoldDialog from "@/components/market/MarkSoldDialog";
import SellToMemberDialog from "@/components/market/SellToMemberDialog";

type Row = Pick<MarketplaceListing, "id" | "title" | "status" | "listing_type" | "category" | "price_type" | "price_cents"
  | "expires_at" | "bumped_at" | "updated_at" | "removed_reason">;
const TABS: MineTab[] = ["live", "drafts", "ended"];

interface Props {
  /** Whose listings: a person's private ones or a school's (plan 4.7). */
  seller: { userId: string } | { groupId: string };
  /** Where "Inserieren" leads. */
  newPath: string;
}

/** Listings someone manages, by state, with the status actions ("Meine Anzeigen", school shop). */
export default function ManagedListings({ seller, newPath }: Props) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  /** School listing being sold to a member's bill (plan 7.2). */
  const [selling, setSelling] = useState<Row | null>(null);
  /** Listing being marked as sold: asks who bought it (plan 8.1). */
  const [markingSold, setMarkingSold] = useState<Row | null>(null);
  const isSchool = "groupId" in seller;
  const [tab, setTab] = useState<MineTab>("live");

  const sellerColumn = "userId" in seller ? "seller_user_id" : "seller_group_id";
  const sellerId = "userId" in seller ? seller.userId : seller.groupId;
  const load = useCallback(async () => {
    const { data } = await supabase
      .from("marketplace_listings")
      .select("id, title, status, listing_type, category, price_type, price_cents, expires_at, bumped_at, updated_at, removed_reason")
      .eq(sellerColumn, sellerId)
      .order("updated_at", { ascending: false });
    const list = (data ?? []) as unknown as Row[];
    setRows(list);
    setLoading(false);
    setThumbs(await coverThumbnails(list.map((r) => r.id)));
  }, [sellerColumn, sellerId]);

  useEffect(() => { void load(); }, [load]);

  const byTab = useMemo(() => {
    const now = new Date();
    const groups: Record<MineTab, Row[]> = { live: [], drafts: [], ended: [] };
    rows.forEach((r) => groups[mineTab(r, now)].push(r));
    return groups;
  }, [rows]);

  const act = async (row: Row, action: ListingAction) => {
    if (action === "edit") { navigate(`/market/${row.id}/edit`); return; }
    if (action === "sold") { setMarkingSold(row); return; }
    if (action === "delete" && !window.confirm(`${t("market.mine.deleteConfirmTitle")}\n${t("market.mine.deleteConfirmText")}`)) return;
    setBusy(row.id);
    try {
      if (action === "delete") {
        await deleteListing(row.id);
        toast.success(t("market.mine.deleted"));
      } else {
        await runListingAction(action, row.id);
        toast.success(t(action === "publish" ? "market.form.published" : "market.mine.actionDone"));
      }
      await load();
    } catch (e) {
      const code: MarketErrorCode = (e as { code?: MarketErrorCode }).code ?? marketErrorCode(e);
      toast.error(t(`market.errors.${code}`));
    } finally {
      setBusy(null);
    }
  };

  /** Drafts open the form, everything else the listing as others see it. */
  const open = (row: Row) => navigate(row.status === "draft" ? `/market/${row.id}/edit` : `/market/${row.id}`);

  if (loading) return <Skeleton className="h-40 w-full rounded-xl" />;

  const dateFormat = new Intl.DateTimeFormat(i18n.language, { day: "numeric", month: "short" });
  const runtimeLabel = (row: Row) => {
    const status = effectiveStatus(row);
    if (status !== "active" && status !== "reserved") return null;
    const days = daysLeft(row.expires_at);
    if (days === null) return { text: t("market.mine.noExpiry"), warn: false };
    return { text: days === 0 ? t("market.mine.expiresToday") : t("market.mine.daysLeft", { count: days }), warn: days <= EXPIRY_WARNING_DAYS };
  };

  const card = (row: Row) => {
    const status = effectiveStatus(row);
    const runtime = runtimeLabel(row);
    const bumpAt = nextBumpAt(row.bumped_at);
    const actions = availableActions(row);
    return (
      <Card key={row.id} className={busy === row.id ? "opacity-60" : undefined}>
        <CardContent className="flex items-center gap-3 p-3">
          <button type="button" className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted" onClick={() => open(row)}>
            {thumbs[row.id]
              ? <img src={thumbs[row.id]} alt="" className="h-full w-full object-cover" />
              : <ImageOff className="m-auto h-5 w-5 text-muted-foreground" />}
          </button>
          <button type="button" className="min-w-0 flex-1 text-left" onClick={() => open(row)}>
            <p className="truncate text-sm font-medium">{row.title}</p>
            <p className="truncate text-xs text-muted-foreground">
              {[t(`market.categories.${row.category}`), listingPriceLabel(row, t)].filter(Boolean).join(" · ")}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <Badge variant={status === "active" ? "default" : "secondary"} className="text-[10px]">{t(`market.status.${status}`)}</Badge>
              {row.listing_type === "wanted" && <Badge variant="outline" className="text-[10px]">{t("market.listingTypes.wanted")}</Badge>}
              {runtime && <span className={runtime.warn ? "text-[11px] text-amber-600" : "text-[11px] text-muted-foreground"}>{runtime.text}</span>}
            </div>
            {status === "removed" && row.removed_reason && <p className="mt-1 text-[11px] text-destructive">{row.removed_reason}</p>}
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0" disabled={busy === row.id} aria-label={t("market.mine.actions")}>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {actions.map((action) => (
                <div key={action}>
                  {action === "delete" && <DropdownMenuSeparator />}
                  <DropdownMenuItem
                    disabled={action === "bump" && bumpAt !== null}
                    className={action === "delete" ? "text-destructive" : undefined}
                    onSelect={() => void act(row, action)}
                  >
                    {action === "bump" && bumpAt ? t("market.mine.bumpFrom", { date: dateFormat.format(bumpAt) }) : t(action === "delete" ? "market.mine.withdraw" : `market.mine.${action}`)}
                  </DropdownMenuItem>
                </div>
              ))}
              {isSchool && (status === "active" || status === "reserved") && (
                <DropdownMenuItem onSelect={() => setSelling(row)}>{t("market.billing.action")}</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </CardContent>
      </Card>
    );
  };

  return (
    <>
    {markingSold && (
      <MarkSoldDialog listing={markingSold} onClose={() => setMarkingSold(null)} onDone={() => { setMarkingSold(null); void load(); }} />
    )}
    {selling && (
      <SellToMemberDialog listing={selling} onClose={() => setSelling(null)} onDone={() => { setSelling(null); void load(); }} />
    )}
    <Tabs value={tab} onValueChange={(v) => setTab(v as MineTab)}>
        <TabsList className="grid w-full grid-cols-3">
          {TABS.map((key) => (
            <TabsTrigger key={key} value={key}>{t(`market.mine.tabs.${key}`)} {byTab[key].length > 0 ? `(${byTab[key].length})` : ""}</TabsTrigger>
          ))}
        </TabsList>
        {TABS.map((key) => (
          <TabsContent key={key} value={key} className="space-y-2">
            {byTab[key].length === 0 ? (
              <EmptyState icon={Store} title={t(`market.mine.empty.${key}`)} description={t("market.mine.emptyHint")}
                actionLabel={t("market.mine.new")} onAction={() => navigate(newPath)} />
            ) : byTab[key].map(card)}
          </TabsContent>
        ))}
    </Tabs>
    </>
  );
}
