export interface CategoryLike {
  id: string;
  unlocks_after_category_id: string | null;
}

/**
 * A category is locked when it declares a prerequisite category that isn't 100% complete yet.
 * Per plan §5.3 this is informational only ("kein hartes Blockieren") - callers must not use
 * this to disable rating or navigation, only to show a visual indicator.
 */
export function isCategoryLocked(category: CategoryLike, progressPercentByCategoryId: Record<string, number>): boolean {
  if (!category.unlocks_after_category_id) return false;
  return (progressPercentByCategoryId[category.unlocks_after_category_id] ?? 0) < 100;
}

/** Name of the prerequisite category, if any, looked up from the full category list. */
export function prerequisiteName(category: CategoryLike, allCategories: { id: string; name: string }[]): string | null {
  if (!category.unlocks_after_category_id) return null;
  return allCategories.find((c) => c.id === category.unlocks_after_category_id)?.name ?? null;
}
