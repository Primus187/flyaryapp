/**
 * Marketplace (plan 7.1): turn a piece of school equipment into a used-item listing. The equipment types of
 * the inventory (SchoolEquipment) map onto the marketplace categories; the last check becomes the wing's
 * "letzte Nachprüfung", the purchase year the year of manufacture (a fair guess the seller can correct).
 */
import type { ListingCategory } from "./marketplace";

export interface EquipmentRow {
  id: string;
  group_id: string;
  name: string;
  equipment_type: string;
  size: string | null;
  purchase_date: string | null;
  last_check_date: string | null;
}

export interface EquipmentPrefill {
  category: ListingCategory;
  title: string;
  size: string;
  year: string;
  condition: "used";
  attributes: Record<string, unknown>;
}

const CATEGORY: Record<string, ListingCategory> = {
  glider: "glider", harness: "harness", reserve: "reserve", helmet: "helmet", radio: "instrument", vario: "instrument",
};

export function equipmentToListing(e: EquipmentRow): EquipmentPrefill {
  const category = CATEGORY[e.equipment_type] ?? "other";
  const attributes: Record<string, unknown> = {};
  if (category === "glider" && e.last_check_date) attributes.last_check = e.last_check_date.slice(0, 7);
  if (category === "instrument") attributes.instrument_type = e.equipment_type === "radio" ? "radio" : "vario";
  return {
    category, title: e.name.slice(0, 80), size: category === "glider" || category === "harness" || category === "helmet" ? e.size ?? "" : "",
    year: e.purchase_date ? e.purchase_date.slice(0, 4) : "", condition: "used", attributes,
  };
}
