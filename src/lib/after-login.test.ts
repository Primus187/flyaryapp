import { beforeEach, describe, expect, it } from "vitest";
import { isAppPath, pathToKeepThroughLogin, rememberAfterLogin, takeAfterLogin } from "./after-login";

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
  it("keeps shared tracks and invite links through the sign-in, nothing else", () => {
    expect(pathToKeepThroughLogin("/flights/new", "?shared=abc")).toBe("/flights/new?shared=abc");
    expect(pathToKeepThroughLogin("/groups", "?invite=0b1c2d3e-0000-4000-8000-000000000000")).toBe("/groups?invite=0b1c2d3e-0000-4000-8000-000000000000");
    expect(pathToKeepThroughLogin("/groups", "")).toBeNull();
    expect(pathToKeepThroughLogin("/groups", "?invite=")).toBeNull();
    expect(pathToKeepThroughLogin("/flights/new", "")).toBeNull();
    expect(pathToKeepThroughLogin("/settings", "?invite=x")).toBeNull();
    expect(pathToKeepThroughLogin("/welcome/" + "a".repeat(64), "")).toBe("/welcome/" + "a".repeat(64));
    expect(pathToKeepThroughLogin("/welcome/x", "")).toBeNull();
  });
});
