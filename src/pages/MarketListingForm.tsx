import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AlertTriangle, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import LoadingState from "@/components/layout/LoadingState";
import ListingPhotoPicker from "@/components/market/ListingPhotoPicker";
import ListingAttributeFields from "@/components/market/ListingAttributeFields";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  DELIVERY_OPTIONS, LISTING_CATEGORIES, LISTING_CONDITIONS, LISTING_TYPES, LISTING_VISIBILITIES, PRICE_TYPES,
  type DeliveryOption, type ListingCategory, type ListingCondition, type ListingType, type ListingVisibility, type MarketplaceListing, type PriceType,
} from "@/lib/marketplace";
import { CATEGORY_SPECS, validateAttributes, type AttributeError } from "@/lib/marketplace-categories";
import {
  CANTONS, parsePriceInput, priceInputValue, publishProblems, runListingAction, type MarketErrorCode,
} from "@/lib/marketplace-listing";
import { firstFreePosition, uploadListingPhoto, ListingPhotoError, type ListingPhoto } from "@/lib/marketplace-photos";
import { safetyHints } from "@/lib/marketplace-safety";
import { fetchMyShops, type MyShop } from "@/lib/school-shop";
import { hasAcceptedTerms, withPrivateSaleClause } from "@/lib/marketplace-terms";
import { fetchOwnGear, gliderLabel, prefillFromGlider, type FlightGliderRow, type OwnGlider } from "@/lib/marketplace-prefill";
import { geocodeSwissPostalCode } from "@/lib/geo-ch";
import MarketTermsDialog from "@/components/market/MarketTermsDialog";

interface FormState {
  listing_type: ListingType;
  category: ListingCategory;
  title: string;
  description: string;
  condition: ListingCondition | "";
  manufacturer: string;
  model: string;
  size: string;
  year: string;
  attributes: Record<string, unknown>;
  price_type: PriceType;
  price: string;
  postal_code: string;
  locality: string;
  canton: string;
  delivery: DeliveryOption;
  /** School listings only (plan 4.7). */
  visibility: ListingVisibility;
  quantity: string;
}

const EMPTY: FormState = {
  listing_type: "offer", category: "glider", title: "", description: "", condition: "", manufacturer: "", model: "",
  size: "", year: "", attributes: {}, price_type: "fixed", price: "", postal_code: "", locality: "", canton: "", delivery: "pickup",
  visibility: "all", quantity: "1",
};

const fromListing = (l: MarketplaceListing): FormState => ({
  listing_type: l.listing_type, category: l.category, title: l.title, description: l.description, condition: l.condition ?? "",
  manufacturer: l.manufacturer ?? "", model: l.model ?? "", size: l.size ?? "", year: l.year ? String(l.year) : "",
  attributes: l.attributes ?? {}, price_type: l.price_type, price: priceInputValue(l.price_cents),
  postal_code: l.postal_code ?? "", locality: l.locality ?? "", canton: l.canton ?? "", delivery: l.delivery,
  visibility: l.visibility, quantity: String(l.quantity),
});

const LISTING_COLUMNS = "id, seller_user_id, seller_group_id, created_by, listing_type, category, title, description, price_cents, price_type, condition, manufacturer, model, size, year, attributes, quantity, postal_code, locality, canton, delivery, visibility, status, removed_reason, published_at, expires_at, bumped_at, featured_until, created_at, updated_at";

/** Create or edit a listing (plan 4.4): Fotos → Details → Preis und Ort. */
export default function MarketListingForm() {
  const { id } = useParams();
  const isEdit = !!id;
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [listingId, setListingId] = useState<string | null>(id ?? null);
  const [status, setStatus] = useState<MarketplaceListing["status"]>("draft");
  const [form, setForm] = useState<FormState>(EMPTY);
  const [photos, setPhotos] = useState<ListingPhoto[]>([]);
  const [pending, setPending] = useState<File[]>([]);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [attributeErrors, setAttributeErrors] = useState<AttributeError[]>([]);
  const [titleError, setTitleError] = useState(false);
  /** Schools the person sells for; "" = privately (plan 4.7). */
  const [shops, setShops] = useState<MyShop[]>([]);
  const [sellerGroup, setSellerGroup] = useState<string>(searchParams.get("school") ?? "");

  useEffect(() => { fetchMyShops().then(setShops).catch(() => setShops([])); }, []);

  /** Own wings and logbook for "Aus meinem Material" (plan 6.3), only when creating. */
  const [gear, setGear] = useState<{ gliders: OwnGlider[]; flights: FlightGliderRow[] }>({ gliders: [], flights: [] });
  useEffect(() => {
    if (!isEdit && user) fetchOwnGear(user.id).then(setGear).catch(() => undefined);
  }, [isEdit, user]);
  const prefill = (gliderId: string) => {
    const g = gear.gliders.find((x) => x.id === gliderId);
    if (!g) return;
    const p = prefillFromGlider(g, gear.flights);
    setForm((f) => ({ ...f, listing_type: "offer", category: p.category, title: f.title.trim() ? f.title : p.title,
      manufacturer: p.manufacturer, model: p.model, size: p.size, attributes: { ...f.attributes, ...p.attributes } }));
    setAttributeErrors([]);
    toast.success(t("market.prefill.done", { hours: p.attributes.flight_hours ?? 0 }));
  };

  /** Marketplace rules confirmed (plan 4.10)? null = still checking. Only asked when creating. */
  const [termsOk, setTermsOk] = useState<boolean | null>(isEdit ? true : null);
  useEffect(() => {
    if (!isEdit && user) hasAcceptedTerms(user.id).then(setTermsOk).catch(() => setTermsOk(false));
  }, [isEdit, user]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const [{ data: listing }, { data: photoRows }] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not in generated types.ts yet
        supabase.from("marketplace_listings" as any).select(LISTING_COLUMNS).eq("id", id).maybeSingle(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not in generated types.ts yet
        supabase.from("marketplace_listing_photos" as any).select("id, listing_id, path, thumb_path, position").eq("listing_id", id),
      ]);
      if (!listing) {
        toast.error(t("market.errors.not_found"));
        navigate(-1);
        return;
      }
      const l = listing as unknown as MarketplaceListing;
      setForm(fromListing(l));
      setStatus(l.status);
      setSellerGroup(l.seller_group_id ?? "");
      setPhotos((photoRows ?? []) as unknown as ListingPhoto[]);
      setLoading(false);
    })();
  }, [id, navigate, t]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));
  const spec = CATEGORY_SPECS[form.category];
  const priceCents = parsePriceInput(form.price);
  const needsPrice = form.price_type === "fixed" || form.price_type === "negotiable";
  const cleanedAttributes = useMemo(
    () => validateAttributes(form.category, form.attributes, form.listing_type).cleaned,
    [form.category, form.attributes, form.listing_type],
  );
  const draftView = {
    title: form.title, listing_type: form.listing_type, category: form.category, price_type: form.price_type,
    price_cents: needsPrice ? priceCents : null, condition: form.condition || null,
    postal_code: form.postal_code.trim() || null, locality: form.locality.trim() || null, attributes: cleanedAttributes,
  };
  const problems = publishProblems(draftView, photos.length + pending.length);
  const hints = safetyHints({ ...draftView, condition: draftView.condition }, new Date());

  /** Saves the content as draft (or updates a published listing); returns the id. Null when invalid. */
  const save = async (): Promise<string | null> => {
    if (!user) return null;
    if (form.title.trim().length < 3) { setTitleError(true); setStep(isEdit ? step : 2); return null; }
    const validation = validateAttributes(form.category, form.attributes, form.listing_type);
    const blocking = validation.errors.filter((e) => e.code !== "required");
    setAttributeErrors(validation.errors);
    if (blocking.length) { setStep(isEdit ? step : 2); return null; }

    const year = Number(form.year);
    // position of the postal code for the radius search (plan 6.4); Swiss codes only, rounded to ~1 km
    const position = await geocodeSwissPostalCode(form.postal_code);
    const content = {
      listing_type: form.listing_type, category: form.category, title: form.title.trim(), description: form.description.trim(),
      condition: form.condition || null,
      manufacturer: spec.usesModel ? form.manufacturer.trim() || null : null,
      model: spec.usesModel ? form.model.trim() || null : null,
      size: spec.usesSize ? form.size.trim() || null : null,
      year: spec.usesModel && Number.isInteger(year) && year >= 1980 && year <= 2100 ? year : null,
      attributes: validation.cleaned, price_type: form.price_type, price_cents: needsPrice ? priceCents : null,
      postal_code: /^\d{4,5}$/.test(form.postal_code.trim()) ? form.postal_code.trim() : null,
      locality: form.locality.trim() || null, canton: form.canton || null, delivery: form.delivery,
      lat: position?.lat ?? null, lng: position?.lng ?? null,
      ...(sellerGroup ? { visibility: form.visibility, quantity: Math.max(1, Math.min(999, Number.parseInt(form.quantity, 10) || 1)) } : {}),
    };

    setSaving(true);
    try {
      let savedId = listingId;
      if (savedId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not in generated types.ts yet
        const { error } = await supabase.from("marketplace_listings" as any).update(content).eq("id", savedId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not in generated types.ts yet
          .from("marketplace_listings" as any)
          .insert({ ...content, seller_user_id: sellerGroup ? null : user.id, seller_group_id: sellerGroup || null, created_by: user.id, status: "draft" })
          .select("id").single();
        if (error || !data) throw error ?? new Error("insert failed");
        savedId = (data as unknown as { id: string }).id;
        setListingId(savedId);
      }
      if (pending.length) {
        let current = [...photos];
        for (const f of pending) {
          const position = firstFreePosition(current);
          if (position === null) break;
          try {
            current = [...current, await uploadListingPhoto(savedId, f, position)];
          } catch (e) {
            toast.error(t(`market.photos.errors.${e instanceof ListingPhotoError ? e.code : "upload_failed"}`));
          }
        }
        setPhotos(current);
        setPending([]);
      }
      return savedId;
    } catch {
      toast.error(t("market.form.saveFailed"));
      return null;
    } finally {
      setSaving(false);
    }
  };

  const next = async () => {
    if (step === 2 && !(await save())) return;
    setStep((s) => Math.min(3, s + 1));
  };

  /** Back to where the listing is managed: the school shop or "Meine Anzeigen". */
  const done = () => navigate(sellerGroup ? "/school/shop" : "/market/mine");

  const saveDraft = async () => {
    if (await save()) {
      toast.success(t("market.form.saved"));
      done();
    }
  };

  const publish = async () => {
    const savedId = await save();
    if (!savedId) return;
    if (status !== "draft") {
      toast.success(t("market.form.saved"));
      done();
      return;
    }
    setSaving(true);
    try {
      await runListingAction("publish", savedId);
      toast.success(t("market.form.published"));
      done();
    } catch (e) {
      const code = (e as { code?: MarketErrorCode }).code ?? "unknown";
      toast.error(t(`market.errors.${code}`));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState />;
  if (termsOk === false && user) {
    return <MarketTermsDialog userId={user.id} onAccepted={() => setTermsOk(true)} onCancel={() => navigate(-1)} />;
  }

  const showStep = (n: number) => isEdit || step === n;
  const field = (label: string, control: React.ReactNode, className?: string) => (
    <div className={cn("space-y-1.5", className)}><Label className="text-xs">{label}</Label>{control}</div>
  );
  const select = <V extends string>(value: V | "", options: readonly V[], labelKey: string, onChange: (v: V) => void) => (
    <Select value={value} onValueChange={(v) => onChange(v as V)}>
      <SelectTrigger><SelectValue placeholder={t("market.form.choose")} /></SelectTrigger>
      <SelectContent>{options.map((o) => <SelectItem key={o} value={o}>{t(`${labelKey}.${o}`)}</SelectItem>)}</SelectContent>
    </Select>
  );

  return (
    <PageContainer>
      <PageHeader title={isEdit ? t("market.form.editTitle") : t("market.form.newTitle")} back />
      {!isEdit && (
        <div className="flex items-center gap-2">
          {[1, 2, 3].map((n) => (
            <button key={n} type="button" className="flex-1 text-left" onClick={() => (n < step ? setStep(n) : undefined)}>
              <div className={cn("h-1.5 rounded-full transition-colors", n <= step ? "bg-primary" : "bg-muted")} />
              <span className={cn("text-[10px] mt-1 block", n === step ? "text-foreground font-medium" : "text-muted-foreground")}>
                {t(`market.form.step${n}`)}
              </span>
            </button>
          ))}
        </div>
      )}

      {showStep(1) && (
        <Card><CardContent className="p-4 space-y-3">
          <p className="text-sm font-medium">{t("market.form.step1")}</p>
          <ListingPhotoPicker listingId={listingId} photos={photos} pending={pending} onPhotosChange={setPhotos} onPendingChange={setPending} />
        </CardContent></Card>
      )}

      {showStep(2) && (
        <Card><CardContent className="p-4 space-y-3">
          <p className="text-sm font-medium">{t("market.form.step2")}</p>
          {!isEdit && shops.length > 0 && field(t("market.shop.sellAs"), (
            <Select value={sellerGroup || "me"} onValueChange={(v) => setSellerGroup(v === "me" ? "" : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="me">{t("market.shop.sellAsMe")}</SelectItem>
                {shops.map((s) => <SelectItem key={s.group_id} value={s.group_id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          ))}
          {!isEdit && !sellerGroup && gear.gliders.length > 0 && field(t("market.prefill.label"), (
            <Select value="" onValueChange={prefill}>
              <SelectTrigger><SelectValue placeholder={t("market.prefill.placeholder")} /></SelectTrigger>
              <SelectContent>{gear.gliders.map((g) => <SelectItem key={g.id} value={g.id}>{gliderLabel(g)}</SelectItem>)}</SelectContent>
            </Select>
          ))}
          {sellerGroup && shops.some((s) => s.group_id === sellerGroup && !s.ready) && (
            <p className="rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">{t("market.shop.notReadyForm")}</p>
          )}
          <div className="grid grid-cols-2 gap-2">
            {LISTING_TYPES.map((type) => (
              <Button key={type} type="button" variant={form.listing_type === type ? "default" : "outline"} size="sm"
                onClick={() => set("listing_type", type)}>
                {t(`market.listingTypes.${type}`)}
              </Button>
            ))}
          </div>
          {field(t("market.form.category"), select(form.category, LISTING_CATEGORIES, "market.categories", (v) => {
            setForm((f) => ({ ...f, category: v, attributes: {} }));
            setAttributeErrors([]);
          }))}
          {field(t("market.form.title"), (
            <>
              <Input value={form.title} maxLength={80} placeholder={t("market.form.titlePlaceholder")}
                onChange={(e) => { set("title", e.target.value); setTitleError(false); }} />
              {titleError && <p className="text-[11px] text-destructive">{t("market.form.titleTooShort")}</p>}
            </>
          ))}
          {spec.usesModel && (
            <div className="grid grid-cols-2 gap-3">
              {field(t("market.fields.manufacturer"), <Input value={form.manufacturer} maxLength={60} onChange={(e) => set("manufacturer", e.target.value)} />)}
              {field(t("market.fields.model"), <Input value={form.model} maxLength={60} onChange={(e) => set("model", e.target.value)} />)}
              {field(t("market.fields.year"), <Input value={form.year} inputMode="numeric" maxLength={4} onChange={(e) => set("year", e.target.value)} />)}
              {spec.usesSize && field(t("market.fields.size"), <Input value={form.size} maxLength={20} onChange={(e) => set("size", e.target.value)} />)}
            </div>
          )}
          {!spec.usesModel && spec.usesSize && field(t("market.fields.size"), <Input value={form.size} maxLength={20} onChange={(e) => set("size", e.target.value)} />)}
          {field(`${t("market.form.condition")}${form.listing_type === "offer" ? " *" : ""}`,
            select(form.condition, LISTING_CONDITIONS, "market.conditions", (v) => set("condition", v)))}
          <ListingAttributeFields category={form.category} listingType={form.listing_type} values={form.attributes}
            errors={attributeErrors} onChange={(v) => set("attributes", v)} />
          {field(t("market.form.description"), (
            <>
              <Textarea rows={5} maxLength={4000} value={form.description} placeholder={t("market.form.descriptionPlaceholder")}
                onChange={(e) => set("description", e.target.value)} />
              {!sellerGroup && form.listing_type === "offer" && !form.description.includes(t("market.terms.privateSaleClause")) && (
                <Button type="button" variant="ghost" size="sm" className="h-auto px-0 text-xs underline"
                  onClick={() => set("description", withPrivateSaleClause(form.description, t("market.terms.privateSaleClause")))}>
                  {t("market.terms.addPrivateSale")}
                </Button>
              )}
            </>
          ))}
        </CardContent></Card>
      )}

      {showStep(3) && (
        <Card><CardContent className="p-4 space-y-3">
          <p className="text-sm font-medium">{t("market.form.step3")}</p>
          <div className="grid grid-cols-2 gap-3">
            {field(t("market.form.priceType"), select(form.price_type, PRICE_TYPES, "market.priceTypes", (v) => set("price_type", v)))}
            {needsPrice && field(t("market.form.price"), (
              <>
                <Input value={form.price} inputMode="decimal" placeholder="1800" onChange={(e) => set("price", e.target.value)} />
                {form.price !== "" && priceCents === null && <p className="text-[11px] text-destructive">{t("market.errors.invalid")}</p>}
              </>
            ))}
            {field(t("market.form.postalCode"), <Input value={form.postal_code} inputMode="numeric" maxLength={5} onChange={(e) => set("postal_code", e.target.value)} />)}
            {field(t("market.form.locality"), <Input value={form.locality} maxLength={80} onChange={(e) => set("locality", e.target.value)} />)}
            {field(t("market.form.canton"), (
              <Select value={form.canton} onValueChange={(v) => set("canton", v)}>
                <SelectTrigger><SelectValue placeholder={t("market.form.choose")} /></SelectTrigger>
                <SelectContent>
                  {CANTONS.map((c) => <SelectItem key={c} value={c}>{c === "other" ? t("market.form.cantonOther") : c}</SelectItem>)}
                </SelectContent>
              </Select>
            ))}
            {field(t("market.form.delivery"), select(form.delivery, DELIVERY_OPTIONS, "market.delivery", (v) => set("delivery", v)))}
            {sellerGroup && field(t("market.shop.visibility"), select(form.visibility, LISTING_VISIBILITIES, "market.visibility", (v) => set("visibility", v)))}
            {sellerGroup && field(t("market.shop.quantity"), (
              <Input value={form.quantity} inputMode="numeric" maxLength={3} onChange={(e) => set("quantity", e.target.value.replace(/\D/g, ""))} />
            ))}
          </div>

          {hints.length > 0 && (
            <div className="space-y-1.5 rounded-md bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">{t("market.form.safetyPreview")}</p>
              {hints.map((h) => (
                <p key={h.code} className="flex items-start gap-1.5 text-xs">
                  {h.severity === "warning" ? <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" /> : <Info className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                  {t(`market.safety.${h.code}`, { months: h.months })}
                </p>
              ))}
            </div>
          )}
          {status === "draft" && problems.length > 0 && (
            <div className="space-y-1 rounded-md border border-dashed p-3">
              <p className="text-xs font-medium">{t("market.form.stillMissing")}</p>
              {problems.map((p) => <p key={p} className="text-xs text-muted-foreground">• {t(`market.errors.${p}`)}</p>)}
            </div>
          )}
        </CardContent></Card>
      )}

      <div className="sticky bottom-16 z-10 -mx-1 px-1 py-2 bg-background/85 backdrop-blur-sm space-y-2">
        <div className="flex gap-2">
          {!isEdit && step > 1 && (
            <Button type="button" variant="outline" className="flex-1" disabled={saving} onClick={() => setStep(step - 1)}>
              {t("common.back")}
            </Button>
          )}
          {!isEdit && step < 3 ? (
            <Button type="button" className="flex-1" disabled={saving} onClick={() => void next()}>
              {saving ? t("market.form.saving") : t("market.form.next")}
            </Button>
          ) : (
            <Button type="button" className="flex-1" disabled={saving} onClick={() => void publish()}>
              {saving ? t("market.form.saving") : status === "draft" ? t("market.form.publish") : t("common.save")}
            </Button>
          )}
        </div>
        {status === "draft" && (step > 1 || isEdit) && (
          <Button type="button" variant="ghost" className="w-full text-xs" disabled={saving} onClick={() => void saveDraft()}>
            {t("market.form.saveDraft")}
          </Button>
        )}
      </div>
    </PageContainer>
  );
}
