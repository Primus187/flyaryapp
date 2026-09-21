export interface ReceiptSummary {
  confirmedCount: number;
  totalCount: number;
  pendingUserIds: string[];
}

/** Splits the audience of a confirmation-required announcement into confirmed vs. pending. */
export function summarizeReceipts(audienceUserIds: string[], confirmedUserIds: Iterable<string>): ReceiptSummary {
  const confirmedSet = new Set(confirmedUserIds);
  const uniqueAudience = [...new Set(audienceUserIds)];
  const pendingUserIds = uniqueAudience.filter((id) => !confirmedSet.has(id));
  return {
    confirmedCount: uniqueAudience.length - pendingUserIds.length,
    totalCount: uniqueAudience.length,
    pendingUserIds,
  };
}

export function hasConfirmed(confirmedUserIds: Iterable<string>, userId: string): boolean {
  for (const id of confirmedUserIds) {
    if (id === userId) return true;
  }
  return false;
}
