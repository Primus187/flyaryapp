import { describe, expect, it } from "vitest";
import { isCategoryLocked, prerequisiteName } from "./training-categories";

describe("isCategoryLocked", () => {
  it("is never locked without a prerequisite", () => {
    expect(isCategoryLocked({ id: "c1", unlocks_after_category_id: null }, {})).toBe(false);
  });

  it("is locked when the prerequisite is below 100%", () => {
    const category = { id: "c2", unlocks_after_category_id: "c1" };
    expect(isCategoryLocked(category, { c1: 80 })).toBe(true);
  });

  it("is unlocked once the prerequisite reaches 100%", () => {
    const category = { id: "c2", unlocks_after_category_id: "c1" };
    expect(isCategoryLocked(category, { c1: 100 })).toBe(false);
  });

  it("treats a missing progress entry as 0% (locked)", () => {
    const category = { id: "c2", unlocks_after_category_id: "c1" };
    expect(isCategoryLocked(category, {})).toBe(true);
  });
});

describe("prerequisiteName", () => {
  it("returns null without a prerequisite", () => {
    expect(prerequisiteName({ id: "c1", unlocks_after_category_id: null }, [])).toBe(null);
  });

  it("looks up the prerequisite's name", () => {
    const category = { id: "c2", unlocks_after_category_id: "c1" };
    const all = [{ id: "c1", name: "Übungshang" }, { id: "c2", name: "Höhenflüge" }];
    expect(prerequisiteName(category, all)).toBe("Übungshang");
  });

  it("returns null when the prerequisite id is unresolved", () => {
    const category = { id: "c2", unlocks_after_category_id: "missing" };
    expect(prerequisiteName(category, [{ id: "c1", name: "Übungshang" }])).toBe(null);
  });
});
