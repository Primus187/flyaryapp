import { describe, expect, it } from "vitest";
import { extractAuthRedirectError } from "./auth-redirect-error";

describe("extractAuthRedirectError", () => {
  it("reads Supabase OAuth errors from the query string", () => {
    expect(extractAuthRedirectError("?error=server_error&error_code=unexpected_failure&error_description=Unable+to+exchange+external+code", ""))
      .toBe("Unable to exchange external code (unexpected_failure)");
  });

  it("reads errors from the hash (implicit flow)", () => {
    expect(extractAuthRedirectError("", "#error=access_denied&error_description=User+cancelled")).toBe("User cancelled (access_denied)");
  });

  it("ignores successful redirects", () => {
    expect(extractAuthRedirectError("?code=abc", "#access_token=x&refresh_token=y")).toBeNull();
  });
});
