// Link preview pictures (1200 x 630, one per language): the hero of the built start page without its header, the name
// raised a little so that it stays fully readable at thumbnail size.
// Run from the website folder after a build: node landscape-work/og-image.mjs
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';

const base = 'http://127.0.0.1:4189';
const server = spawn(process.execPath, ['preview.mjs'], { env: { ...process.env, PORT: '4189' }, stdio: ['ignore', 'pipe', 'pipe'] });
await new Promise((resolve) => server.stdout.once('data', resolve));
const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
try {
  for (const lang of ['de', 'fr', 'en']) {
    const page = await (await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })).newPage();
    await page.goto(`${base}/${lang}/`, { waitUntil: 'networkidle' });
    await page.addStyleTag({ content: '.header { display: none !important; } .stage-title { top: -44px; }' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(800);
    await page.screenshot({ path: `assets/og-${lang}.jpg`, type: 'jpeg', quality: 86 });
    console.log(`assets/og-${lang}.jpg`);
  }
} finally {
  await browser.close();
  server.kill();
}
