import { describe, expect, it } from "vitest";
import { forgetPushEnabled, getRememberedPushEndpoint, rememberPushEnabled, shouldRestorePush } from "./push-restore";

const memoryStore = () => {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => { data.set(k, v); },
    removeItem: (k: string) => { data.delete(k); },
  };
};

describe("push restore marker", () => {
  it("remembers the endpoint per user and forgets it again", () => {
    const store = memoryStore();
    rememberPushEnabled("u1", "https://push/1", store);
    expect(getRememberedPushEndpoint("u1", store)).toBe("https://push/1");
    expect(getRememberedPushEndpoint("u2", store)).toBeNull();
    forgetPushEnabled("u1", store);
    expect(getRememberedPushEndpoint("u1", store)).toBeNull();
  });

  it("survives a storage that throws", () => {
    const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); }, removeItem: () => { throw new Error("blocked"); } };
    expect(() => rememberPushEnabled("u1", "e", broken)).not.toThrow();
    expect(getRememberedPushEndpoint("u1", broken)).toBeNull();
  });
});

describe("shouldRestorePush", () => {
  it("restores when push was on, the permission holds and the subscription is gone", () => {
    expect(shouldRestorePush("granted", "https://push/1", false)).toBe(true);
  });

  it("does nothing when a subscription exists, push was never on here or the permission is not granted", () => {
    expect(shouldRestorePush("granted", "https://push/1", true)).toBe(false);
    expect(shouldRestorePush("granted", null, false)).toBe(false);
    expect(shouldRestorePush("default", "https://push/1", false)).toBe(false);
    expect(shouldRestorePush("denied", "https://push/1", false)).toBe(false);
  });
});
