/** Keep batched reads complete when PostgREST caps rows per response. */
export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown; count: number | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (;;) {
    const result = await fetchPage(rows.length, rows.length + 499);
    if (result.error) throw result.error;
    const page = result.data || [];
    rows.push(...page);
    if (!page.length || (result.count !== null ? rows.length >= result.count : page.length < 500)) return rows;
  }
}
