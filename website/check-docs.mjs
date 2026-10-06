import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

export async function checkDocumentation(browser, base, here) {
  const root = join(here, 'dist');
  const context = await browser.newContext();
  const errors = [];
  await context.route('**/*', (route) => {
    if (new URL(route.request().url()).origin === base) return route.continue();
    errors.push(`Unexpected external documentation request: ${route.request().url()}`);
    return route.abort();
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    const htmlFiles = [];
    async function collect(dir) {
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) await collect(path);
        else if (entry.name === 'index.html') htmlFiles.push(path);
      }
    }
    for (const lang of ['de', 'fr', 'en']) await collect(join(root, lang, 'docs'));
    const documents = await Promise.all(htmlFiles.map(async (path) => ({
      url: '/' + relative(root, path).split(sep).join('/').replace(/index\.html$/, ''),
      html: await readFile(path, 'utf8'),
    })));
    const parsed = await page.evaluate((documents) => documents.map(({ url, html }) => {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      return { url, ids: [...doc.querySelectorAll('[id]')].map((el) => el.id),
        links: [...doc.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')),
        images: [...doc.images].map((im) => im.getAttribute('src')), h1: doc.querySelectorAll('h1').length,
        rawDirectives: /^:::/m.test(doc.body.textContent),
      };
    }), documents);
    const byUrl = new Map(parsed.map((doc) => [doc.url, doc]));
    const checked = new Set();
    for (const doc of parsed) {
      assert.equal(doc.h1, 1, `${doc.url}: exactly one title`);
      assert.equal(new Set(doc.ids).size, doc.ids.length, `${doc.url}: unique heading IDs`);
      assert(!doc.rawDirectives, `${doc.url}: unrendered print directives`);
      for (const href of [...doc.links, ...doc.images]) {
        const target = new URL(href, base + doc.url);
        if (target.origin !== base) continue;
        const pathname = decodeURIComponent(target.pathname);
        if (!checked.has(pathname)) {
          const file = join(root, pathname, pathname.endsWith('/') ? 'index.html' : '');
          assert((await stat(file)).isFile(), `${doc.url}: missing target ${href}`);
          checked.add(pathname);
        }
        if (target.hash) {
          const dest = byUrl.get(pathname);
          assert(dest?.ids.includes(decodeURIComponent(target.hash.slice(1))), `${doc.url}: missing anchor ${href}`);
        }
      }
    }
    for (const lang of ['de', 'fr', 'en']) {
      for (const width of [1440, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`${base}/${lang}/docs/`);
        await page.locator('#docs-query').fill('IGC');
        await page.waitForFunction(() => document.querySelectorAll('#search-results li').length > 0);
        assert((await page.locator('#search-results').innerText()).includes('Pilot'));
        await page.locator('#docs-query').fill('xyznonexistentsearch987');
        await page.waitForFunction(() => document.querySelectorAll('#search-results li').length === 0);
        await page.locator('#docs-query').fill('');
        await page.waitForTimeout(150);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${lang}/${width}: docs hub overflow`);
        if (lang === 'de' && width !== 320) await page.screenshot({ path: join(here, '.preview', `docs-hub-${width}.png`), fullPage: true });
      }
      for (const download of await page.locator('.doc-download').evaluateAll((links) => links.map((a) => a.getAttribute('href')))) {
        const response = await fetch(base + download);
        assert(response.ok);
        assert(response.headers.get('content-type').includes('wordprocessingml'));
        assert.equal(Buffer.from(await response.arrayBuffer()).subarray(0, 2).toString(), 'PK');
      }
    }
    const readers = ['/de/docs/pilots/', '/de/docs/schools/'];
    for (const route of readers) {
      for (const width of [1440, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(base + route);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${route}/${width}: reader overflow`);
        assert(await page.locator('.doc-print').isVisible());
        if (route.endsWith('/pilots/') && width !== 320) await page.screenshot({ path: join(here, '.preview', `docs-reader-${width}.png`), fullPage: false });
      }
    }
    await page.goto(base + '/de/docs/schools/');
    await page.locator('.chapter-index a').first().click();
    const first = page.url();
    assert(await page.locator('.doc-figure img').count() > 0);
    await page.locator('.doc-figure img').first().scrollIntoViewIfNeeded();
    await page.locator('.doc-figure img').first().evaluate((im) => im.decode());
    await page.locator('.doc-pagination a').last().click();
    assert.notEqual(page.url(), first);
    await page.locator('.doc-pagination a').first().click();
    assert.equal(page.url(), first);
    assert.deepEqual(errors, []);
    const nojs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
    try {
      const plain = await nojs.newPage();
      await plain.goto(base + '/de/docs/');
      assert(!(await plain.locator('.docs-search').isVisible()));
      await plain.locator('.docs-categories .text-link').first().click();
      await plain.locator('.chapter-index a').first().click();
      assert(await plain.locator('.doc-article').isVisible());
      assert(await plain.locator('.docs-sidebar details').getAttribute('open') !== null);
    } finally { await nojs.close(); }
    console.log(`PASS documentation: ${parsed.length} pages, all local links/anchors/images, search in 3 languages, responsive readers, chapter navigation and no-JavaScript access.`);
  } finally { await context.close(); }
}
