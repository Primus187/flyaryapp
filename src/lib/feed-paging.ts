/** Paging state of one feed source; sources are paged independently and merged by date. */
export interface SourcePage { full: boolean; oldest: string | null }

export const newPage = (): SourcePage => ({ full: false, oldest: null });

/**
 * Where the merged page ends. Only items at or after the oldest item of every *full* source
 * page are complete: older items of another source may still be missing newer neighbours.
 * Returns null when every source is exhausted (no further page).
 */
export function feedPageCutoff(pages: SourcePage[]): string | null {
  const bounds = pages.filter(p => p.full && p.oldest).map(p => p.oldest!);
  if (bounds.length === 0) return null;
  return bounds.reduce((a, b) => (new Date(a).getTime() >= new Date(b).getTime() ? a : b));
}
