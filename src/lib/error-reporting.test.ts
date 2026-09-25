import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn(() => Promise.resolve({ error: null })) } }));

import { supabase } from "@/integrations/supabase/client";
import { createReportLimiter, isNoise, normalizeError, reportError } from "./error-reporting";

describe("normalizeError", () => {
  it("reads errors, strings and other values", () => {
    const e = new TypeError("x is undefined");
    expect(normalizeError(e)).toEqual({ message: "TypeError: x is undefined", stack: e.stack });
    expect(normalizeError("plain")).toEqual({ message: "plain", stack: null });
    expect(normalizeError({ code: 42 })).toEqual({ message: '{"code":42}', stack: null });
    expect(normalizeError(undefined).message).toBe("undefined");
  });
});

describe("isNoise", () => {
  it("drops extension errors, ResizeObserver and cross-origin script errors", () => {
    expect(isNoise("boom", "at chrome-extension://abc/content.js:1", true)).toBe(true);
    expect(isNoise("ResizeObserver loop completed with undelivered notifications.", null, true)).toBe(true);
    expect(isNoise("Script error.", null, true)).toBe(true);
  });

  it("drops network failures only while offline", () => {
    expect(isNoise("TypeError: Failed to fetch", null, false)).toBe(true);
    expect(isNoise("TypeError: Failed to fetch", null, true)).toBe(false);
    expect(isNoise("TypeError: x is undefined", null, true)).toBe(false);
  });
});

describe("createReportLimiter", () => {
  it("lets each error through once and stops at the maximum", () => {
    const allow = createReportLimiter(2);
    expect(allow("a")).toBe(true);
    expect(allow("a")).toBe(false);
    expect(allow("b")).toBe(true);
    expect(allow("c")).toBe(false);
  });
});

describe("reportError", () => {
  it("sends one report per distinct error with path and version", () => {
    reportError("render", new Error("Page broke"), "in More");
    reportError("render", new Error("Page broke"));
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(supabase.rpc).toHaveBeenCalledWith("report_client_error", expect.objectContaining({
      _kind: "render", _message: "Error: Page broke", _path: window.location.pathname,
    }));
    const args = vi.mocked(supabase.rpc).mock.calls[0][1] as { _stack: string };
    expect(args._stack).toContain("in More");
  });
});
