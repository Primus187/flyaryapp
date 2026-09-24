import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ImageOff, List, Plus, Search, ShieldAlert, SlidersHorizontal, Store } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchModerationQueue, isMarketModerator } from "@/lib/marketplace-moderation";
import { fetchFavoriteIds, toggledSet } from "@/lib/marketplace-favorites";
import FavoriteButton from "@/components/market/FavoriteButton";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import EmptyState from "@/components/layout/EmptyState";
import { listingPriceLabel } from "@/components/market/listing-labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { LISTING_CATEGORIES, LISTING_CONDITIONS, LISTING_TYPES } from "@/lib/marketplace";
import { CERTIFICATION_CLASSES } from "@/lib/marketplace-categories";
import { CANTONS } from "@/lib/marketplace-listing";
import {
  EMPTY_FILTERS, SORT_ORDERS, activeFilterCount, ageLabel, filtersFromParams, filtersToParams, searchListings,
  showsCertificationFilter, toggle, type SearchFilters, type SearchItem, type SearchPage,
} from "@/lib/marketplace-search";
import { MARKET_PHOTO_BUCKET } from "@/lib/marketplace-photos";
import { getSignedUrls } from "@/lib/signed-url-cache";

const Chip = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button type="button" onClick={onClick}
    className={cn("shrink-0 rounded-full border px-3 py-1 text-xs transition-colors",
      active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground")}>
    {children}
  </button>
);

/** Marketplace overview (plan 4.5): search, category chips, filter sheet, listing grid. */
export default function Market() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => filtersFromParams(params), [params]);
  const [query, setQuery] = useState(filters.q);
  const [items, setItems] = useState<SearchItem[]>([]);
  const [cursor, setCursor] = useState<SearchPage["next_cursor"]>(null);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draft, setDraft] = useState<SearchFilters>(filters);
  const request = useRef(0);
  const { user } = useAuth();
  /** Open moderation cases; null = not a moderator (plan 4.8). */
  const [cases, setCases] = useState<number | null>(null);
  /** Kept listings (plan 6.1). */
  const [favIds, setFavIds] = useState<Set<string>>(new Set());
  useEffect(() => { if (user) fetchFavoriteIds().then(setFavIds).catch(() => undefined); }, [user]);

  useEffect(() => {
    if (!user) return;
    isMarketModerator(user.id)
      .then(async (yes) => setCases(yes ? (await fetchModerationQueue()).length : null))
      .catch(() => setCases(null));
  }, [user]);

  const setFilters = useCallback((next: SearchFilters) => setParams(filtersToParams(next), { replace: true }), [setParams]);

  // search text → URL, debounced
  useEffect(() => {
    if (query === filters.q) return;
    const timer = setTimeout(() => setFilters({ ...filters, q: query }), 350);
    return () => clearTimeout(timer);
  }, [query, filters, setFilters]);

  const addThumbs = async (list: SearchItem[]) => {
    const paths = list.map((i) => i.thumb_path).filter((p): p is string => !!p);
    const urls = await getSignedUrls(MARKET_PHOTO_BUCKET, paths);
    setThumbs((prev) => ({ ...prev, ...Object.fromEntries(list.map((i) => [i.id, i.thumb_path ? urls[i.thumb_path] ?? "" : ""])) }));
  };

  useEffect(() => {
    const current = ++request.current;
    setLoading(true);
    searchListings(filters)
      .then(async (page) => {
        if (current !== request.current) return;
        setItems(page.items);
        setCursor(page.next_cursor);
        setLoading(false);
        await addThumbs(page.items);
      })
      .catch(() => {
        if (current !== request.current) return;
        setLoading(false);
        toast.error(t("market.errors.unknown"));
      });
  }, [filters, t]);

  const loadMore = async () => {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const page = await searchListings(filters, cursor);
      setItems((prev) => [...prev, ...page.items]);
      setCursor(page.next_cursor);
      await addThumbs(page.items);
    } catch {
      toast.error(t("market.errors.unknown"));
    }
    setLoadingMore(false);
  };

  const openSheet = () => { setDraft(filters); setSheetOpen(true); };
  const filterCount = activeFilterCount(filters);

  const card = (item: SearchItem) => (
    <div key={item.id} className="relative">
    <button type="button" onClick={() => navigate(`/market/${item.id}`)}
      className="w-full overflow-hidden rounded-xl border border-border/50 bg-card text-left shadow-sm active:scale-[0.99]">
      <div className="relative aspect-square bg-muted">
        {thumbs[item.id]
          ? <img src={thumbs[item.id]} alt="" loading="lazy" className="h-full w-full object-cover" />
          : <ImageOff className="absolute inset-0 m-auto h-6 w-6 text-muted-foreground" />}
        <div className="absolute left-1.5 top-1.5 flex flex-wrap gap-1">
          {item.listing_type === "wanted" && <Badge className="text-[10px]">{t("market.browse.wantedBadge")}</Badge>}
          {item.status === "reserved" && <Badge variant="secondary" className="text-[10px]">{t("market.status.reserved")}</Badge>}
          {item.is_school && <Badge variant="outline" className="bg-background/80 text-[10px]">{t("market.browse.school")}</Badge>}
        </div>
      </div>
      <div className="space-y-0.5 p-2">
        <p className="truncate text-sm font-semibold">{listingPriceLabel(item, t) || t("market.listingTypes.wanted")}</p>
        <p className="truncate text-xs">{item.title}</p>
        <p className="truncate text-[11px] text-muted-foreground">
          {[item.locality, ageLabel(item.bumped_at, i18n.language)].filter(Boolean).join(" · ")}
        </p>
      </div>
    </button>
    {user && (
      <FavoriteButton userId={user.id} listingId={item.id} active={favIds.has(item.id)} className="absolute right-1.5 top-1.5"
        onChange={(on) => setFavIds((prev) => toggledSet(prev, item.id, on))} />
    )}
    </div>
  );

  const chipGroup = <V extends string>(label: string, values: readonly V[], selected: V[], text: (v: V) => string, set: (v: V[]) => void) => (
    <div className="space-y-2">
      <Label className="text-xs">{label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {values.map((v) => <Chip key={v} active={selected.includes(v)} onClick={() => set(toggle(selected, v))}>{text(v)}</Chip>)}
      </div>
    </div>
  );

  return (
    <PageContainer>
      <PageHeader
        title={t("market.title")}
        action={<>
          {cases !== null && (
            <Button size="icon" variant="outline" className="relative" aria-label={t("market.moderation.title")} onClick={() => navigate("/market/moderation")}>
              <ShieldAlert className="h-4 w-4" />
              {cases > 0 && <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">{cases}</span>}
            </Button>
          )}
          <Button size="icon" variant="outline" aria-label={t("market.mine.title")} onClick={() => navigate("/market/mine")}><List className="h-4 w-4" /></Button>
          <Button size="sm" className="gap-1" onClick={() => navigate("/market/new")}><Plus className="h-4 w-4" />{t("market.mine.new")}</Button>
        </>}
      />

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-8" value={query} placeholder={t("market.browse.searchPlaceholder")} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Button variant="outline" className="gap-1.5" onClick={openSheet}>
          <SlidersHorizontal className="h-4 w-4" />
          {filterCount > 0 ? filterCount : <span className="sr-only">{t("market.browse.filters")}</span>}
        </Button>
      </div>

      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
        <Chip active={filters.categories.length === 0} onClick={() => setFilters({ ...filters, categories: [] })}>{t("market.browse.all")}</Chip>
        {LISTING_CATEGORIES.map((c) => (
          <Chip key={c} active={filters.categories.includes(c)} onClick={() => setFilters({ ...filters, categories: toggle(filters.categories, c) })}>
            {t(`market.categories.${c}`)}
          </Chip>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="aspect-[3/4] rounded-xl" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState icon={Store} title={t("market.browse.empty")} description={t("market.browse.emptyHint")}
          actionLabel={t("market.mine.new")} onAction={() => navigate("/market/new")} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">{items.map(card)}</div>
          {cursor && (
            <Button variant="outline" className="w-full" disabled={loadingMore} onClick={() => void loadMore()}>
              {t("market.browse.loadMore")}
            </Button>
          )}
        </>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
          <SheetHeader><SheetTitle>{t("market.browse.filterTitle")}</SheetTitle></SheetHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-xs">{t("market.browse.sort")}</Label>
              <Select value={draft.sort} onValueChange={(v) => setDraft({ ...draft, sort: v as SearchFilters["sort"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SORT_ORDERS.map((s) => <SelectItem key={s} value={s}>{t(`market.browse.sorts.${s}`)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">{t("market.browse.type")}</Label>
              <div className="flex flex-wrap gap-1.5">
                <Chip active={draft.type === ""} onClick={() => setDraft({ ...draft, type: "" })}>{t("market.browse.all")}</Chip>
                {LISTING_TYPES.map((type) => (
                  <Chip key={type} active={draft.type === type} onClick={() => setDraft({ ...draft, type })}>{t(`market.browse.types.${type}`)}</Chip>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs">{t("market.browse.priceFrom")}</Label>
                <Input inputMode="decimal" value={draft.priceMin} onChange={(e) => setDraft({ ...draft, priceMin: e.target.value })} /></div>
              <div className="space-y-1.5"><Label className="text-xs">{t("market.browse.priceTo")}</Label>
                <Input inputMode="decimal" value={draft.priceMax} onChange={(e) => setDraft({ ...draft, priceMax: e.target.value })} /></div>
            </div>
            {chipGroup(t("market.form.condition"), LISTING_CONDITIONS, draft.conditions, (c) => t(`market.conditions.${c}`), (v) => setDraft({ ...draft, conditions: v }))}
            {showsCertificationFilter(draft.categories) && chipGroup(t("market.attributes.certification"), CERTIFICATION_CLASSES, draft.certifications,
              (c) => t(`market.options.certification.${c}`), (v) => setDraft({ ...draft, certifications: v }))}
            <div className="space-y-1.5"><Label className="text-xs">{t("market.fields.size")}</Label>
              <Input value={draft.size} maxLength={20} onChange={(e) => setDraft({ ...draft, size: e.target.value })} /></div>
            {chipGroup(t("market.form.canton"), CANTONS, draft.cantons, (c) => (c === "other" ? t("market.form.cantonOther") : c), (v) => setDraft({ ...draft, cantons: v }))}
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <Label className="text-sm">{t("market.browse.schoolsOnly")}</Label>
              <Switch checked={draft.schoolsOnly} onCheckedChange={(v) => setDraft({ ...draft, schoolsOnly: v })} />
            </div>
          </div>
          <SheetFooter className="flex-row gap-2">
            <Button variant="outline" className="flex-1" onClick={() => { setQuery(""); setFilters(EMPTY_FILTERS); setSheetOpen(false); }}>
              {t("market.browse.reset")}
            </Button>
            <Button className="flex-1" onClick={() => { setFilters({ ...draft, q: query }); setSheetOpen(false); }}>{t("market.browse.apply")}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </PageContainer>
  );
}
