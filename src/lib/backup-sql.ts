// SQL helpers for scripts/db-backup.mjs and scripts/db-restore.mjs (plain TypeScript without imports,
// so Node can load it directly with its built-in type stripping).

/** "public.flights" → "public"."flights" */
export function qualifiedIdent(table: string): string {
  const [schema, name] = table.includes(".") ? table.split(".", 2) : ["public", table];
  return [schema, name].map((part) => `"${part.replace(/"/g, '""')}"`).join(".");
}

/** Dollar-quotes a text whose content never ends the quote (the tag is chosen to not occur in it). */
export function dollarQuote(text: string): string {
  let tag = "$bk$";
  for (let i = 0; text.includes(tag); i++) tag = `$bk${i}$`;
  return `${tag}${text}${tag}`;
}

/** Export query: all rows of a table as one JSON array. */
export function exportSql(table: string): string {
  return `select coalesce(json_agg(t), '[]'::json) as rows from ${qualifiedIdent(table)} t`;
}

/** Insert of exported rows. Only `columns` are written (generated columns must be left out). */
export function insertSql(table: string, columns: string[], rowsJson: string): string {
  const cols = columns.map((c) => `"${c.replace(/"/g, '""')}"`).join(", ");
  return `insert into ${qualifiedIdent(table)} (${cols}) select ${cols} from json_populate_recordset(null::${qualifiedIdent(table)}, ${dollarQuote(rowsJson)})`;
}

/**
 * Orders tables so that referenced tables come first (foreign keys). Self-references are ignored;
 * tables in a cycle keep their input order at the end.
 */
export function restoreOrder(tables: string[], foreignKeys: { table: string; references: string }[]): string[] {
  const pending = new Set(tables);
  const deps = new Map(tables.map((t) => [t, new Set<string>()]));
  for (const fk of foreignKeys) {
    if (fk.table !== fk.references && pending.has(fk.table) && pending.has(fk.references)) deps.get(fk.table)!.add(fk.references);
  }
  const order: string[] = [];
  let progress = true;
  while (pending.size && progress) {
    progress = false;
    for (const t of tables) {
      if (!pending.has(t) || [...deps.get(t)!].some((d) => pending.has(d))) continue;
      order.push(t); pending.delete(t); progress = true;
    }
  }
  return [...order, ...tables.filter((t) => pending.has(t))];
}

/** Snapshot folders (named by timestamp, sortable) to delete so that the newest `keep` remain. */
export function snapshotsToPrune(names: string[], keep: number): string[] {
  return [...names].sort().reverse().slice(Math.max(0, keep));
}
