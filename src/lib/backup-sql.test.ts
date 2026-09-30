import { describe, expect, it } from "vitest";
import { dollarQuote, exportSql, insertSql, qualifiedIdent, restoreOrder, snapshotsToPrune, mirrorAction, reportRunSql, compareRestore } from "./backup-sql";

describe("backup SQL", () => {
  it("quotes identifiers with schema", () => {
    expect(qualifiedIdent("auth.users")).toBe('"auth"."users"');
    expect(qualifiedIdent("flights")).toBe('"public"."flights"');
  });

  it("picks a dollar-quote tag that does not occur in the text", () => {
    expect(dollarQuote("abc")).toBe("$bk$abc$bk$");
    expect(dollarQuote("a $bk$ b")).toBe("$bk0$a $bk$ b$bk0$");
  });

  it("builds export and insert statements", () => {
    expect(exportSql("public.groups")).toBe(`select coalesce(json_agg(t), '[]'::json) as rows from "public"."groups" t`);
    expect(insertSql("public.groups", ["id", "name"], '[{"id":1}]')).toBe(
      `insert into "public"."groups" ("id", "name") select "id", "name" from json_populate_recordset(null::"public"."groups", $bk$[{"id":1}]$bk$)`,
    );
  });

  it("orders referenced tables first, ignoring self-references and keeping cycles", () => {
    const order = restoreOrder(
      ["public.group_members", "public.groups", "public.comments", "public.a", "public.b"],
      [
        { table: "public.group_members", references: "public.groups" },
        { table: "public.comments", references: "public.comments" },
        { table: "public.a", references: "public.b" },
        { table: "public.b", references: "public.a" },
      ],
    );
    expect(order.indexOf("public.groups")).toBeLessThan(order.indexOf("public.group_members"));
    expect(order).toContain("public.comments");
    expect(order.slice(-2)).toEqual(["public.a", "public.b"]);
  });

  it("keeps the newest snapshots", () => {
    expect(snapshotsToPrune(["2026-09-01_0300", "2026-09-15_0300", "2026-09-08_0300"], 2)).toEqual(["2026-09-01_0300"]);
    expect(snapshotsToPrune(["2026-09-01_0300"], 8)).toEqual([]);
  });

  it("re-downloads changed files even when the size stays the same, keeping the old version", () => {
    expect(mirrorAction({ exists: false, size: null, etag: null }, { size: 10, etag: "a" })).toBe("download");
    expect(mirrorAction({ exists: true, size: 10, etag: "a" }, { size: 10, etag: "a" })).toBe("skip");
    expect(mirrorAction({ exists: true, size: 10, etag: "a" }, { size: 10, etag: "b" })).toBe("replace");
    expect(mirrorAction({ exists: true, size: 10, etag: null }, { size: 10, etag: "b" })).toBe("skip");
    expect(mirrorAction({ exists: true, size: 9, etag: null }, { size: 10, etag: null })).toBe("replace");
  });

  it("reports a run with quoted values", () => {
    const sql = reportRunSql({ ok: false, snapshot: "2026-09-30_1230", host: "PC", gitCommit: null, tables: 180, rows: 5000, filesTotal: 40, downloaded: 3, failed: 2, message: "it's $bk$ broken" });
    expect(sql).toBe("select public.report_backup_run(false, $bk$2026-09-30_1230$bk$, $bk$PC$bk$, null, 180, 5000, 40, 3, 2, $bk0$it's $bk$ broken$bk0$)");
  });

  it("finds every difference between a backup and its restore", () => {
    const manifest = { row_counts: { "public.flights": 3, "auth.users": 2, "public.gone": 1 },
      files: [{ bucket: "igc-files", name: "u/1.igc", size: 10, etag: "a" }, { bucket: "igc-files", name: "u/2.igc", size: 10, etag: "b" },
        { bucket: "flight-photos", name: "u/p.jpg", size: 5, etag: null }, { bucket: "flight-photos", name: "u/q.jpg", size: 5 }] };
    const target = { rowCounts: { "public.flights": 3, "auth.users": 1 },
      files: [{ bucket: "igc-files", name: "u/1.igc", size: 10, etag: "a" }, { bucket: "igc-files", name: "u/2.igc", size: 10, etag: "x" },
        { bucket: "flight-photos", name: "u/p.jpg", size: 4, etag: "c" }] };
    expect(compareRestore(manifest, target)).toEqual([
      "auth.users: 1 rows instead of 2", "table missing: public.gone",
      "file content differs: igc-files/u/2.igc", "file size differs: flight-photos/u/p.jpg", "file missing: flight-photos/u/q.jpg",
    ]);
    expect(compareRestore({ row_counts: { "public.flights": 3 }, files: [] }, { rowCounts: { "public.flights": 3 }, files: [] })).toEqual([]);
  });
});
