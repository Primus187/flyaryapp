import { beforeEach, describe, expect, it } from "vitest";
import { isAppPath, rememberAfterLogin, takeAfterLogin } from "./after-login";

describe("after login", () => {
  beforeEach(() => sessionStorage.clear());
  it("accepts only in-app paths", () => {
    expect(isAppPath("/market/0b1c")).toBe(true);
    expect(isAppPath("/market?saved=1")).toBe(true);
    expect(isAppPath("//evil.example")).toBe(false);
    expect(isAppPath("https://evil.example")).toBe(false);
    expect(isAppPath("javascript:alert(1)")).toBe(false);
  });
  it("hands the path out once", () => {
    rememberAfterLogin("/market/abc");
    expect(takeAfterLogin()).toBe("/market/abc");
    expect(takeAfterLogin()).toBeNull();
    rememberAfterLogin("//evil.example");
    expect(takeAfterLogin()).toBeNull();
  });
});
