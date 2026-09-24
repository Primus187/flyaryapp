import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ListingCategory, ListingType } from "@/lib/marketplace";
import { CATEGORY_SPECS, type AttributeError } from "@/lib/marketplace-categories";

interface Props {
  category: ListingCategory;
  listingType: ListingType;
  values: Record<string, unknown>;
  errors: AttributeError[];
  onChange: (values: Record<string, unknown>) => void;
}

/** Category-specific inputs (plan 4.2), rendered from CATEGORY_SPECS. */
export default function ListingAttributeFields({ category, listingType, values, errors, onChange }: Props) {
  const { t } = useTranslation();
  const fields = CATEGORY_SPECS[category].attributes.filter((f) => !(f.kind === "boolean" && f.hidden));
  if (fields.length === 0) return null;

  const set = (key: string, value: unknown) => {
    const next = { ...values, [key]: value };
    // hours typed by hand are no longer the logbook's (plan 6.3)
    if (key === "flight_hours") delete next.hours_from_logbook;
    onChange(next);
  };
  const text = (v: unknown) => (v === undefined || v === null ? "" : String(v));

  return (
    <div className="grid grid-cols-2 gap-3">
      {fields.map((field) => {
        const error = errors.find((e) => e.key === field.key);
        const label = (
          <Label className="text-xs">
            {t(`market.attributes.${field.key}`)}
            {"unit" in field && field.unit ? ` (${field.unit})` : ""}
            {field.required && listingType === "offer" ? " *" : ""}
          </Label>
        );
        const wide = field.kind === "text" || field.kind === "select";
        return (
          <div key={field.key} className={wide ? "col-span-2 space-y-1.5" : "space-y-1.5"}>
            {field.kind === "boolean" ? (
              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                {label}
                <Switch checked={values[field.key] === true} onCheckedChange={(v) => set(field.key, v)} />
              </div>
            ) : (
              <>
                {label}
                {field.kind === "select" ? (
                  <Select value={text(values[field.key])} onValueChange={(v) => set(field.key, v)}>
                    <SelectTrigger><SelectValue placeholder={t("market.form.choose")} /></SelectTrigger>
                    <SelectContent>
                      {field.options.map((o) => (
                        <SelectItem key={o} value={o}>{t(`market.options.${field.key}.${o}`)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    type={field.kind === "month" ? "month" : "text"}
                    inputMode={field.kind === "number" ? "numeric" : undefined}
                    maxLength={field.kind === "text" ? field.maxLength : undefined}
                    value={text(values[field.key])}
                    onChange={(e) => set(field.key, e.target.value)}
                  />
                )}
              </>
            )}
            {error && <p className="text-[11px] text-destructive">{t(`market.errors.${error.code}`)}</p>}
          </div>
        );
      })}
    </div>
  );
}
