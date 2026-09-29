// Local, isolated browser checks of the static marketing site. Never signs into the app.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { content } from './content.mjs';
import { checkDocumentation } from './check-docs.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const base = 'http://127.0.0.1:4186';
const server = spawn(process.execPath, [join(here, 'preview.mjs')], { env: { ...process.env, PORT: '4186' }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
let browser;
try {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Preview startup timed out')), 15000);
    server.once('error', (e) => { clearTimeout(timeout); reject(e); });
    server.once('exit', (code) => { clearTimeout(timeout); reject(new Error(`Preview exited: ${code}`)); });
    server.stdout.once('data', () => { clearTimeout(timeout); resolve(); });
  });
  browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  await mkdir(join(here, '.preview'), { recursive: true });
  let checked = 0;
  for (const lang of ['de', 'fr', 'en']) {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const errors = [];
    await context.route('**/*', (route) => {
      if (new URL(route.request().url()).origin === base) return route.continue();
      errors.push(`Unexpected external request: ${route.request().url()}`);
      return route.abort();
    });
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    for (const width of [1440, 900, 390, 320]) {
      await page.setViewportSize({ width, height: width < 700 ? 844 : 1000 });
      await page.goto(`${base}/${lang}/`, { waitUntil: 'networkidle' });
      assert.equal(await page.locator('html').getAttribute('lang'), lang);
      assert.equal(await page.title(), content[lang].title);
      assert.equal(await page.locator('h1').count(), 1);
      assert(await page.locator('main').innerText());
      const dimensions = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
      if (dimensions.scroll > dimensions.width) {
        await page.screenshot({ path: join(here, '.preview', `overflow-${lang}-${width}.png`), fullPage: true });
        console.log(await page.locator('body *').evaluateAll((els) => els.filter((el) => el.getBoundingClientRect().right > innerWidth + 1 && !el.closest('.product-stage, .school-visual, .final-cta')).map((el) => [el.tagName, el.className, Math.round(el.getBoundingClientRect().right)]).slice(0, 20)));
      }
      assert(dimensions.scroll <= dimensions.width, `${lang}/${width}: horizontal overflow ${dimensions.scroll}`);
      const images = await page.locator('img').evaluateAll((els) => els.filter((im) => im.loading !== 'lazy').every((im) => im.complete && im.naturalWidth > 0));
      assert(images, `${lang}/${width}: missing eager image`);
      const distorted = await page.locator('img:not([loading="lazy"])').evaluateAll((els) => els.filter((img) => {
        const box = img.getBoundingClientRect();
        return box.width > 0 && Math.abs(box.width / box.height - img.naturalWidth / img.naturalHeight) > 0.01;
      }).map((img) => img.src));
      assert.deepEqual(distorted, [], `${lang}/${width}: distorted product image`);
      for (let i = 0; i < 4; i++) {
        await page.locator(`#tab-${i}`).click();
        assert.equal(await page.locator(`#tab-${i}`).getAttribute('aria-selected'), 'true');
        assert(await page.locator(`#preview-${i}`).isVisible());
        await page.locator('#preview-image').evaluate((img) => img.decode());
      }
      await page.locator('#tab-3').focus();
      await page.keyboard.press('ArrowRight');
      assert.equal(await page.locator('#tab-0').getAttribute('aria-selected'), 'true');
      await page.locator('#tab-0').focus();
      await page.keyboard.press('End');
      assert.equal(await page.locator('#tab-3').getAttribute('aria-selected'), 'true');
      await page.locator('#tab-0').click();
      await page.locator('.faq-list summary').first().click();
      assert(await page.locator('.faq-list details').first().getAttribute('open') !== null);
      await page.locator('.faq-list summary').first().click();
      if (width <= 1000) {
        await page.locator('.menu-toggle').click();
        assert(await page.locator('#mobile-nav').isVisible());
        await page.keyboard.press('Escape');
        assert(!(await page.locator('#mobile-nav').isVisible()));
        await page.locator('.menu-toggle').click();
        await page.locator('#mobile-nav a[href="#schools"]').click();
        assert(!(await page.locator('#mobile-nav').isVisible()));
        assert.equal(new URL(page.url()).hash, '#schools');
      }
      const brokenAnchors = await page.locator('a[href^="#"]').evaluateAll((els) => els.map((a) => a.getAttribute('href')).filter((href) => !document.getElementById(href.slice(1))));
      assert.deepEqual(brokenAnchors, []);
      const appLinks = await page.locator('a[href="https://app.flyary.ch"]').count();
      assert.equal(appLinks, 2);
      const schoolLink = await page.locator('.school-copy a.button').getAttribute('href');
      assert(schoolLink.startsWith('mailto:tobias.a.bolliger@gmail.com?subject='));
      await page.goto(`${base}/${lang}/`, { waitUntil: 'networkidle' });
      if (width === 1440 || width === 390) {
        await page.locator('img').evaluateAll(async (els) => {
          for (const image of els) image.loading = 'eager';
          await Promise.all(els.map((image) => image.decode()));
        });
        await page.screenshot({ path: join(here, '.preview', `${lang}-${width}.png`), fullPage: true });
        if (lang === 'de') await page.screenshot({ path: join(here, '.preview', 'hero-' + width + '.png') });
      }
      checked++;
      console.log(`PASS ${lang} / ${width}px: layout, tabs, keyboard, FAQ, links, menu`);
    }
    await page.goto(`${base}/${lang}/#app`);
    const next = lang === 'de' ? 'fr' : 'de';
    await page.locator(`.header .languages a[lang="${next}"]`).click();
    assert.equal(new URL(page.url()).pathname, `/${next}/`);
    assert.equal(new URL(page.url()).hash, '#app');
    assert.deepEqual(errors, []);
    await context.close();
  }
  const nojs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await nojs.newPage();
  await page.goto(base + '/de/');
  assert.equal(await page.locator('.preview-panel:visible').count(), 4);
  assert(await page.locator('.no-script-nav').isVisible());
  await page.locator('.faq-list summary').first().click();
  assert(await page.locator('.faq-list details').first().getAttribute('open') !== null);
  await nojs.close();
  assert.equal((await fetch(base + '/unknown')).status, 404);
  await checkDocumentation(browser, base, here);
  console.log(`${checked} responsive language checks passed; language switching and no-JavaScript fallback passed.`);
} finally {
  await browser?.close();
  server.kill();
}
