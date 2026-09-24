import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { CheckCircle2, Plus, Store } from "lucide-react";
import ManagedListings from "@/components/market/ManagedListings";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  emptyShopProfile, fetchMyShops, fetchShopProfile, normalizeUid, saveShopProfile, shopProblems, type MyShop, type ShopProfile,
} from "@/lib/school-shop";

/** School shop (plan 4.7): the school's listings and the legal details every school listing shows. */
export default function SchoolShop({ groupId }: { groupId: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [shop, setShop] = useState<MyShop | null>(null);
  const [profile, setProfile] = useState<ShopProfile>(emptyShopProfile(groupId));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("listings");

  const load = useCallback(async () => {
    const [shops, existing] = await Promise.all([fetchMyShops(), fetchShopProfile(groupId)]);
    setShop(shops.find((s) => s.group_id === groupId) ?? null);
    setProfile(existing ?? emptyShopProfile(groupId));
    setLoading(false);
  }, [groupId]);
  useEffect(() => { void load(); }, [load]);

  if (loading) return <Skeleton className="h-64 w-full rounded-xl" />;
  if (!shop) return <p role="alert" className="text-sm text-muted-foreground">{t("market.shop.noAccess")}</p>;

  const canEdit = shop.can_admin;
  const problems = shopProblems(profile);
  const set = <K extends keyof ShopProfile>(key: K, value: ShopProfile[K]) => setProfile((p) => ({ ...p, [key]: value }));

  const save = async () => {
    if (profile.active && problems.length) { toast.error(t("market.shop.incomplete")); return; }
    setSaving(true);
    try {
      await saveShopProfile(profile);
      toast.success(t("market.shop.saved"));
      await load();
    } catch {
      toast.error(t("market.shop.saveFailed"));
    }
    setSaving(false);
  };

  const field = (key: "legal_name" | "street" | "postal_code" | "locality" | "email" | "phone" | "uid_number", options: { wide?: boolean; inputMode?: "numeric" | "email" | "tel"; max?: number } = {}) => (
    <div className={options.wide ? "col-span-2 space-y-1.5" : "space-y-1.5"}>
      <Label className="text-xs">{t(`market.shop.fields.${key}`)}</Label>
      <Input value={profile[key] ?? ""} disabled={!canEdit} inputMode={options.inputMode} maxLength={options.max ?? 120}
        onChange={(e) => set(key, e.target.value)}
        onBlur={key === "uid_number" ? (e) => set("uid_number", e.target.value.trim() ? normalizeUid(e.target.value) : null) : undefined} />
      {problems.includes(key as never) && profile[key] && <p className="text-[11px] text-destructive">{t("market.errors.invalid")}</p>}
    </div>
  );

  return (
    <div className="space-y-4">
      <Card className={shop.ready ? "border-green-500/40" : "border-amber-500/40"}>
        <CardContent className="flex items-start gap-3 p-3">
          {shop.ready ? <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" /> : <Store className="h-5 w-5 shrink-0 text-amber-600" />}
          <p className="text-sm">{shop.ready ? t("market.shop.ready") : t("market.shop.notReady")}</p>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="listings">{t("market.shop.tabs.listings")}</TabsTrigger>
          <TabsTrigger value="profile">{t("market.shop.tabs.profile")}</TabsTrigger>
        </TabsList>

        <TabsContent value="listings" className="space-y-3">
          <Button className="w-full gap-2" onClick={() => navigate(`/market/new?school=${groupId}`)}>
            <Plus className="h-4 w-4" /> {t("market.shop.newListing")}
          </Button>
          <ManagedListings seller={{ groupId }} newPath={`/market/new?school=${groupId}`} />
        </TabsContent>

        <TabsContent value="profile">
          <Card><CardContent className="space-y-3 p-4">
            {!canEdit && <p className="text-xs text-muted-foreground">{t("market.shop.readOnly")}</p>}
            <div className="grid grid-cols-2 gap-3">
              {field("legal_name", { wide: true })}
              {field("street", { wide: true })}
              {field("postal_code", { inputMode: "numeric", max: 5 })}
              {field("locality", { max: 80 })}
              {field("email", { wide: true, inputMode: "email" })}
              {field("phone", { wide: true, inputMode: "tel", max: 40 })}
            </div>
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <Label className="text-sm">{t("market.shop.fields.vat_registered")}</Label>
              <Switch checked={profile.vat_registered} disabled={!canEdit} onCheckedChange={(v) => set("vat_registered", v)} />
            </div>
            <div className="grid grid-cols-2 gap-3">{field("uid_number", { wide: true, max: 20 })}</div>
            <p className="-mt-2 text-[11px] text-muted-foreground">{t("market.shop.uidHint")}</p>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("market.shop.fields.warranty_text")}</Label>
              <Textarea rows={4} maxLength={2000} disabled={!canEdit} value={profile.warranty_text}
                placeholder={t("market.shop.warrantyPlaceholder")} onChange={(e) => set("warranty_text", e.target.value)} />
            </div>
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <div>
                <Label className="text-sm">{t("market.shop.fields.active")}</Label>
                <p className="text-[11px] text-muted-foreground">{t("market.shop.activeHint")}</p>
              </div>
              <Switch checked={profile.active} disabled={!canEdit} onCheckedChange={(v) => set("active", v)} />
            </div>
            {problems.length > 0 && (
              <div className="rounded-md border border-dashed p-3 text-xs">
                <p className="font-medium">{t("market.shop.stillMissing")}</p>
                <p className="text-muted-foreground">{problems.map((p) => t(`market.shop.fields.${p}`)).join(", ")}</p>
              </div>
            )}
            {canEdit && <Button className="w-full" disabled={saving} onClick={() => void save()}>{t("common.save")}</Button>}
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
