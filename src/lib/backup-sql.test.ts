import { describe, expect, it } from "vitest";
import { dollarQuote, exportSql, insertSql, qualifiedIdent, restoreOrder, snapshotsToPrune } from "./backup-sql";

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
});
