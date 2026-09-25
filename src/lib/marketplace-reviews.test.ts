import { describe, expect, it } from "vitest";
import { marketErrorCode } from "./marketplace-listing";
import { ratingSummary, starFills } from "./marketplace-reviews";

describe("reviews (plan 8.1)", () => {
  it("summarises average and count, nothing without reviews", () => {
    expect(ratingSummary("4.5", 12, "de-CH")).toBe("4.5 (12)");
    expect(ratingSummary(5, 1, "de")).toBe("5,0 (1)");
    expect(ratingSummary(null, 0, "de")).toBeNull();
    expect(ratingSummary(4, 0, "de")).toBeNull();
  });
  it("fills stars in halves", () => {
    expect(starFills(5)).toEqual([1, 1, 1, 1, 1]);
    expect(starFills(3.5)).toEqual([1, 1, 1, 0.5, 0]);
    expect(starFills(4.2)).toEqual([1, 1, 1, 1, 0]);
    expect(starFills(4.3)).toEqual([1, 1, 1, 1, 0.5]);
    expect(starFills(0)).toEqual([0, 0, 0, 0, 0]);
  });
  it("knows the new error codes", () => {
    expect(marketErrorCode({ message: "marketplace:buyer_not_in_chat" })).toBe("buyer_not_in_chat");
    expect(marketErrorCode({ message: "marketplace:cannot_review" })).toBe("cannot_review");
    expect(marketErrorCode({ message: "marketplace:invalid_rating" })).toBe("invalid_rating");
  });
});
