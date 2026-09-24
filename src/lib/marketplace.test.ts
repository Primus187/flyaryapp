// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DELIVERY_OPTIONS, EDITABLE_LISTING_COLUMNS, LISTING_CATEGORIES, LISTING_CONDITIONS, LISTING_STATUSES,
  LISTING_TYPES, LISTING_VISIBILITIES, PRICE_TYPES, isListedNow, isSchoolListing,
} from "./marketplace";

const sql = readFileSync(new URL("../../drizzle/migrations/0032_marketplace_listings.sql", import.meta.url), "utf8");

/** Values of the `<column> … CHECK (<column> IN (…))` constraint in the migration. */
function checkValues(column: string): string[] {
  const match = sql.match(new RegExp(`CHECK \\(${column} IN\\s*\\(([^)]*)\\)`));
  if (!match) throw new Error(`no CHECK for ${column}`);
  return [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

describe("marketplace value sets match the migration", () => {
  it.each([
    ["listing_type", LISTING_TYPES],
    ["category", LISTING_CATEGORIES],
    ["price_type", PRICE_TYPES],
    ["condition", LISTING_CONDITIONS],
    ["delivery", DELIVERY_OPTIONS],
    ["visibility", LISTING_VISIBILITIES],
    ["status", LISTING_STATUSES],
  ])("%s", (column, values) => {
    expect(checkValues(column)).toEqual([...values]);
  });

  it("editable columns are exactly the granted UPDATE columns", () => {
    const grant = sql.match(/GRANT UPDATE \(([^)]*)\)/);
    expect(grant?.[1].split(",").map((c) => c.trim())).toEqual([...EDITABLE_LISTING_COLUMNS]);
  });
});

describe("isListedNow", () => {
  const now = new Date("2026-10-01T12:00:00Z");
  it("lists active and reserved listings until they expire", () => {
    expect(isListedNow({ status: "active", expires_at: null }, now)).toBe(true);
    expect(isListedNow({ status: "reserved", expires_at: "2026-10-02T00:00:00Z" }, now)).toBe(true);
    expect(isListedNow({ status: "active", expires_at: "2026-10-01T11:59:59Z" }, now)).toBe(false);
  });
  it("never lists drafts, sold, expired or removed listings", () => {
    for (const status of ["draft", "sold", "expired", "removed"] as const) {
      expect(isListedNow({ status, expires_at: null }, now)).toBe(false);
    }
  });
});

it("isSchoolListing", () => {
  expect(isSchoolListing({ seller_group_id: "g" })).toBe(true);
  expect(isSchoolListing({ seller_group_id: null })).toBe(false);
});
