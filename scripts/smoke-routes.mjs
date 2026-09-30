// Walk through the main pages of the production build before a push:   npm run smoke
// Builds are served locally (vite preview); a fake session is signed in and every Supabase request is
// answered locally with empty data – no request reaches the real project. A page fails when it throws,
// shows the error boundary ("Diese Seite konnte nicht geladen werden"), stays empty or loses the bottom nav.
// Catches crashes and white screens in code; it does not test real data (use the error log for that).
// Browser: BROWSER_CHANNEL (default msedge on Windows, bundled Chromium elsewhere).
import { chromium } from "@playwright/test";
import { loadEnv, preview } from "vite";

const routes = [
  "/", "/feed", "/flights", "/flights/new", "/locations", "/events", "/events/new", "/groups", "/training",
  "/profile", "/more", "/settings", "/stats", "/search", "/legal", "/leaderboard", "/weather", "/notifications",
  "/messages", "/market", "/market/mine", "/market/new", "/admin", "/admin/errors", "/admin/access", "/admin/access?tab=accounts", "/admin/access?tab=log",
  "/admin/schools", "/admin/feedback", "/admin/backups", "/admin/sites",
  // a school flying day of today: opens on the flying day tab (check-in, coaching sheet, day booking)
  "/events/22222222-2222-4222-8222-222222222222",
];
// the tandem passenger page opens without an account (migration 0076); the mock token is simply unknown
const publicRoutes = ["/legal", "/legal/terms", "/legal/licenses", "/passenger/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"];
const uid = "11111111-1111-4111-8111-111111111111";
const user = { id: uid, aud: "authenticated", role: "authenticated", email: "smoke@example.invalid", app_metadata: { provider: "email" }, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };
const profile = { id: uid, user_id: uid, pilot_name: "Smoke Test", training_level: "pilot" };
// RPCs that always return an object in the database get an empty one of the right shape
const rpcResults = {
  feed_page: { items: [], nextCursor: null, groupIds: [] },
  list_flights_page: { rows: [], total: 0 },
  // pilot phase gate (migration 0079): the smoke user has access
  my_access: { has_access: true, waitlisted: false, invited: false },
  my_onboarding: { show: false, kind: "pilot", school: null },
  // training status on /training (migration 0075)
  training_status: { discipline: "paraglider", licence: "pilot", requirements: [{ rule: "confirmed_altitude_flights", threshold: 50, value: 12, met: false, source: "SHV", params: {} }], confirmedWithoutKind: 0, confirmedPractice: 0, licenceIssuedAt: null },
  // today's school flying day for /events/2222…, seen by an instructor
  event_detail_data: {
    event: {
      id: "22222222-2222-4222-8222-222222222222", title: "Smoke Flugtag", event_date: new Date().toISOString(), status: "confirmed",
      event_category: "height_flight", group_id: "33333333-3333-4333-8333-333333333333", created_by: uid,
      groups: { name: "Smoke Schule", group_type: "school" },
    },
    signups: [{ id: "s1", event_id: "22222222-2222-4222-8222-222222222222", user_id: "44444444-4444-4444-8444-444444444444", signed_up: true, status: "confirmed", presence: "expected", attended: false }],
    members: [{ user_id: uid, role: "admin" }], myFunctions: ["instructor"],
    profiles: { "44444444-4444-4444-8444-444444444444": "Anna" },
    briefingTasks: [], maneuverNames: [], photos: [], me: { pilot_name: "Smoke Test" },
  },
  flight_day_role: "instructor",
  // Betriebsbereich (migration 0083): the smoke user is a Flyary admin, so /admin and its pages render
  is_ops_admin: true,
  // Zugänge (migration 0084): one account each for the accounts tab, the log starts empty
  ops_access_list: [{ user_id: uid, name: "Smoke Test", email: "smoke@example.invalid", created_at: "2026-09-01T00:00:00Z", last_sign_in_at: null, granted_via: "group", granted_at: "2026-09-01T00:00:00Z", revoked_at: null, revoke_reason: null, is_admin: false, schools: ["Smoke Schule"] }],
  ops_log_entries: [],
  // Feedback (migration 0086): one problem report without screenshots
  ops_feedback_list: [{ id: "55555555-5555-4555-8555-555555555555", kind: "problem", message: "Karte lädt nicht", path: "/map", app_version: "smoke", user_agent: "Smoke", screenshot_paths: [], created_at: "2026-09-30T08:00:00Z", status: "new", admin_note: null, handled_at: null, user_id: uid, name: "Smoke Test", email: "smoke@example.invalid" }],
  // Schulen (migration 0085): a school still waiting for its lead
  ops_school_list: [{ id: "33333333-3333-4333-8333-333333333333", name: "Smoke Schule", description: null, created_at: "2026-09-01T00:00:00Z", members: 3, team: 1, admins: ["Smoke Test"], i_am_member: true, other_admins: 0, open_invite: { email: "lead@example.invalid", language: "de", created_at: "2026-09-30T00:00:00Z", expires_at: "2026-10-14T00:00:00Z" }, last_flight_at: null }],
  ops_overview: { waitlist_open: 1, errors_open: 2, errors_new_24h: 1, market_reports_open: 0, backup_last_at: null, backup_last_ok: null, backup_last_success_at: null, storage_bytes: 0 },
};
const authKey = "sb-" + new URL(loadEnv("production", process.cwd(), "VITE_").VITE_SUPABASE_URL).hostname.split(".")[0] + "-auth-token";
const token = `${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString("base64url")}.${Buffer.from(JSON.stringify({ sub: uid, exp: 4102444800, role: "authenticated" })).toString("base64url")}.smoke`;

const server = await preview({ preview: { port: 4179, strictPort: true, open: false }, logLevel: "error" });
const base = "http://localhost:4179";
const channel = process.env.BROWSER_CHANNEL ?? (process.platform === "win32" ? "msedge" : undefined);
const browser = await chromium.launch({ headless: true, ...(channel ? { channel } : {}) });
const failures = [];
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "de-CH", serviceWorkers: "block" });
  await context.addInitScript(({ user, token, authKey }) => {
    localStorage.setItem(authKey, JSON.stringify({ access_token: token, refresh_token: "smoke", token_type: "bearer", expires_in: 1e8, expires_at: 4102444800, user }));
    localStorage.setItem("flyary-language", "de");
    localStorage.setItem("flyary-onboarding-done", "1");
    sessionStorage.setItem("flyary-splash-seen", "1");
  }, { user, token, authKey });
  await context.routeWebSocket(/.*/, (ws) => ws.close());
  await context.route("**/*", (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === base) return route.continue();
    if (url.hostname.endsWith("supabase.co")) {
      if (url.pathname.startsWith("/auth/v1/")) return route.fulfill({ json: user });
      if (url.pathname.startsWith("/storage/v1/")) return route.fulfill({ json: [] });
      if (url.pathname.startsWith("/functions/v1/")) return route.fulfill({ json: {} });
      if (url.pathname.includes("/rpc/")) return route.fulfill({ json: rpcResults[url.pathname.split("/").pop()] ?? null });
      const single = (request.headers()["accept"] || "").includes("vnd.pgrst.object");
      if (single) return route.fulfill({ json: url.pathname.endsWith("/profiles") ? profile : null });
      return route.fulfill({ json: url.pathname.endsWith("/profiles") ? [profile] : [] });
    }
    // everything external (fonts, weather, maps, geo.admin.ch) is not needed for the check
    return route.fulfill({ status: 204, body: "" });
  });

  for (const path of routes) {
    // a fresh tab per page, so one page cannot disturb the next
    const page = await context.newPage();
    const errors = [];
    const onError = (e) => errors.push(e.message);
    const onConsole = (m) => { if (m.type() === "error" && m.text().startsWith("Page failed")) errors.push(m.text().slice(0, 300)); };
    page.on("console", onConsole);
    page.on("pageerror", onError);
    await page.goto(base + path, { waitUntil: "load" });
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(400);
    const text = (await page.locator("#root").innerText().catch(() => "")).trim();
    const boundary = await page.getByText("Diese Seite konnte nicht geladen werden").count();
    const nav = await page.locator("nav").count();
    await page.close();
    const problems = [
      ...errors.map((m) => `error: ${m}`),
      ...(boundary ? ["error boundary shown"] : []),
      ...(text.length < 10 ? ["page is empty"] : []),
      ...(nav === 0 ? ["no navigation"] : []),
    ];
    console.log(`${problems.length ? "FAIL" : "ok  "} ${path}${problems.length ? " – " + problems.join("; ") : ""}`);
    if (problems.length) failures.push(path);
  }

  // Legal pages are public: the sign-in page and Google's consent screen link to them.
  const guest = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "de-CH", serviceWorkers: "block" });
  await guest.addInitScript(() => { localStorage.setItem("flyary-language", "de"); sessionStorage.setItem("flyary-splash-seen", "1"); });
  await guest.route("**/*", (route) => new URL(route.request().url()).origin === base ? route.continue() : route.fulfill({ json: {} }));
  for (const path of publicRoutes) {
    const page = await guest.newPage();
    await page.goto(base + path, { waitUntil: "load" });
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(400);
    const stayed = new URL(page.url()).pathname === path;
    const heading = await page.locator("h1").count();
    await page.close();
    const problems = [...(stayed ? [] : ["redirected to " + page.url()]), ...(heading ? [] : ["no heading"])];
    console.log(`${problems.length ? "FAIL" : "ok  "} ${path} (signed out)${problems.length ? " – " + problems.join("; ") : ""}`);
    if (problems.length) failures.push(path + " (signed out)");
  }
  await guest.close();
} finally {
  await browser.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}
if (failures.length) {
  console.error(`\n${failures.length} of ${routes.length + publicRoutes.length} pages failed: ${failures.join(", ")}`);
  process.exit(1);
}
console.log(`\nAll ${routes.length + publicRoutes.length} pages render.`);
