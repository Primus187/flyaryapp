import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const base = 'http://127.0.0.1:4187';
const config = JSON.parse(await readFile(new URL('./vercel.json', import.meta.url), 'utf8'));
const csp = config.headers[0].headers.find((h) => h.key === 'Content-Security-Policy').value;
const server = spawn(process.execPath, ['website/preview.mjs'], { env: { ...process.env, PORT: '4187' }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
let browser;
try {
  await new Promise((resolve, reject) => { server.stdout.once('data', resolve); server.once('error', reject); });
  browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  for (const variant of [
    { lang: 'de', viewport: { width: 1440, height: 1000 } },
    { lang: 'fr', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    { lang: 'en', viewport: { width: 320, height: 844 }, reducedMotion: 'reduce' },
  ]) {
    const { lang, ...options } = variant;
    const context = await browser.newContext(options);
    const requests = [], errors = [];
    await context.route('**/*', async (route) => {
      const url = route.request().url();
      if (!url.startsWith(base)) { errors.push(`External request: ${url}`); return route.abort(); }
      if (url.endsWith('.mp3')) requests.push(url);
      const response = await route.fetch();
      await route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': csp } });
    });
    await context.addInitScript(() => {
      window.audioProbe = { contexts: [], sources: [], gains: [], decoded: [] };
      const Native = window.AudioContext;
      window.AudioContext = class extends Native {
        constructor(...args) { super(...args); window.audioProbe.contexts.push(this); }
        createBufferSource() { const source = super.createBufferSource(); window.audioProbe.sources.push(source); return source; }
        createGain() { const gain = super.createGain(); window.audioProbe.gains.push(gain); return gain; }
        async decodeAudioData(data) {
          const buffer = await super.decodeAudioData(data);
          let peak = 0, energy = 0;
          const samples = buffer.getChannelData(0);
          for (const sample of samples) { peak = Math.max(peak, Math.abs(sample)); energy += sample * sample; }
          window.audioProbe.decoded.push({ duration: buffer.duration, peak, rms: Math.sqrt(energy / samples.length) });
          return buffer;
        }
      };
    });
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(`${base}/${lang}/`, { waitUntil: 'networkidle' });
    const button = page.locator('.sound-toggle');
    assert.equal(await button.getAttribute('aria-pressed'), 'false');
    assert.equal(requests.length, 0, 'No audio downloads before opt-in');
    assert.equal(await page.evaluate(() => audioProbe.contexts.length), 0);
    await button.focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('.sound-toggle').getAttribute('aria-pressed') === 'true' && !document.querySelector('.sound-toggle').hasAttribute('aria-busy') && audioProbe.sources.length >= 3);
    assert.equal(requests.length, 4);
    assert.equal(await page.evaluate(() => audioProbe.sources.filter((s) => s.loop).length), 3);
    assert.equal(await page.evaluate(() => audioProbe.contexts[0].state), 'running');
    const decoded = await page.evaluate(() => audioProbe.decoded);
    assert(decoded.every((b) => b.duration > 0 && b.rms > 0), 'All four MP3s decode to audible samples');
    console.log(`${lang}: decoded audio ${JSON.stringify(decoded)}`);
    for (let y = 100; y <= 900; y += 100) { await page.evaluate((pos) => scrollTo(0, pos), y); await page.waitForTimeout(90); }
    const flying = await page.evaluate(() => audioProbe.gains[1].gain.value);
    await page.waitForTimeout(1600);
    const idle = await page.evaluate(() => audioProbe.gains[1].gain.value);
    assert(flying > idle, 'Wind settles after scrolling stops');
    const eagleCount = await page.evaluate(() => audioProbe.sources.filter((s) => !s.loop).length);
    assert(eagleCount <= 1);
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(1800);
    assert(await page.evaluate(() => audioProbe.gains[1].gain.value < .01), 'Flight wind fades at landing');
    const video = page.locator('video');
    await video.evaluate((el) => el.play());
    await page.waitForFunction(() => audioProbe.contexts[0].state === 'suspended');
    await video.evaluate((el) => el.pause());
    await page.waitForFunction(() => audioProbe.contexts[0].state === 'running');
    await button.click();
    await page.waitForFunction(() => audioProbe.contexts[0].state === 'suspended');
    assert.equal(await button.getAttribute('aria-pressed'), 'false');
    await button.click();
    await page.waitForFunction(() => audioProbe.contexts[0].state === 'running');
    assert.equal(requests.length, 4, 'Re-enabling uses loaded audio');
    assert.equal(await page.evaluate(() => audioProbe.sources.filter((s) => s.loop).length), 3, 'No duplicate loops');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.deepEqual(errors, []);
    await context.close();
    console.log(`PASS ${lang}: opt-in, CSP, real decoding, scroll wind, landing, video pause, mute and cached resume`);
  }
} finally { await browser?.close(); server.kill(); }
