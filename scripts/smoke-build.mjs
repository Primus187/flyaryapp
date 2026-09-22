import { chromium } from "@playwright/test";

const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
try {
  for (const language of ["de", "fr", "en"]) {
    const context = await browser.newContext({ serviceWorkers: "block" });
    await context.addInitScript((lang) => localStorage.setItem("flyary-language", lang), language);
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(new URL("/auth", process.env.SMOKE_BASE_URL || "http://127.0.0.1:4173").href);
    await page.locator('input[type="email"]').waitFor();
    await page.waitForFunction(() => sessionStorage.getItem("flyary-splash-seen") === "1");
    const scripts = await page.evaluate(() => performance.getEntriesByType("resource").map((entry) => entry.name).filter((name) => name.endsWith(".js")));
    if (errors.length) throw new Error(errors.join("\n"));
    if (scripts.some((name) => /leaflet|generateCategoricalChart|Flight3DMap/.test(name))) throw new Error("Map/chart code loaded on auth route");
    console.log(JSON.stringify({ language, rendered: true, runtimeErrors: errors, scripts: scripts.map((name) => new URL(name).pathname) }));
    await context.close();
  }
} finally {
  await browser.close();
}
