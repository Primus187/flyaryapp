export const EQUIPMENT_CHECK_ITEMS = ["helmet", "shoes", "harness_protector", "reserve"] as const;

export function missingEquipmentItems(checks: { item: string; present: boolean }[]) {
  return EQUIPMENT_CHECK_ITEMS.filter((item) => !checks.some((check) => check.item === item && check.present));
}
