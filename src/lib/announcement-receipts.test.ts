import { describe, expect, it } from "vitest";
import { hasConfirmed, summarizeReceipts } from "./announcement-receipts";

describe("summarizeReceipts", () => {
  it("splits audience into confirmed and pending", () => {
    const summary = summarizeReceipts(["a", "b", "c"], ["b"]);
    expect(summary).toEqual({ confirmedCount: 1, totalCount: 3, pendingUserIds: ["a", "c"] });
  });

  it("treats everyone as pending when nobody has confirmed", () => {
    const summary = summarizeReceipts(["a", "b"], []);
    expect(summary.confirmedCount).toBe(0);
    expect(summary.pendingUserIds).toEqual(["a", "b"]);
  });

  it("treats everyone as confirmed when all have confirmed", () => {
    const summary = summarizeReceipts(["a", "b"], ["a", "b"]);
    expect(summary.confirmedCount).toBe(2);
    expect(summary.pendingUserIds).toEqual([]);
  });

  it("de-duplicates the audience before counting", () => {
    const summary = summarizeReceipts(["a", "a", "b"], []);
    expect(summary.totalCount).toBe(2);
  });
});

describe("hasConfirmed", () => {
  it("finds the user id among confirmed ids", () => {
    expect(hasConfirmed(["a", "b"], "b")).toBe(true);
    expect(hasConfirmed(["a", "b"], "c")).toBe(false);
    expect(hasConfirmed([], "a")).toBe(false);
  });
});
