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
      const response = await route.fetch({ maxRetries: 2 });
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
    if (options.hasTouch) {
      await page.waitForFunction(() => audioProbe.contexts.length > 0 && !document.querySelector('.sound-toggle').hasAttribute('aria-busy'));
      if (await page.evaluate(() => audioProbe.contexts[0].state !== 'running')) {
        assert.equal(await button.getAttribute('aria-pressed'), 'false', 'Blocked playback is not shown as playing');
        await button.tap(); // One tap starts blocked audio; it must not switch the intent off.
      }
    } else await page.keyboard.press('a');
    await page.waitForFunction(() => document.querySelector('.sound-toggle').getAttribute('aria-pressed') === 'true' && !document.querySelector('.sound-toggle').hasAttribute('aria-busy') && audioProbe.sources.length >= 4 && audioProbe.contexts[0].state === 'running');
    assert.equal(requests.length, 5);
    assert.equal(await page.evaluate(() => audioProbe.sources.filter((s) => s.loop).length), 4);
    assert.equal(await page.evaluate(() => audioProbe.contexts[0].state), 'running');
    assert(await button.getAttribute('aria-label'), 'Compact control retains its accessible name');
    assert.equal(await button.locator('span').isVisible(), false, 'Enabled control shows only the speaker icon');
    await page.waitForTimeout(300);
    assert(await page.evaluate(() => audioProbe.gains[5].gain.value > 0), 'Music plays without scrolling');
    assert.equal(await page.evaluate(() => audioProbe.gains[1].gain.value), 0, 'Stationary wind is silent');
    const decoded = await page.evaluate(() => audioProbe.decoded);
    assert(decoded.every((b) => b.duration > 0 && b.rms > 0), 'All five MP3s decode to audible samples');
    console.log(`${lang}: decoded audio ${JSON.stringify(decoded)}`);
    for (let y = 100; y <= 900; y += 100) { await page.evaluate((pos) => scrollTo(0, pos), y); await page.waitForTimeout(90); }
    const flying = await page.evaluate(() => audioProbe.gains[1].gain.value);
    const mix = await page.evaluate(() => {
      const loops = audioProbe.sources.filter((s) => s.loop);
      const windGain = audioProbe.gains[1].gain.value, musicGain = audioProbe.gains[5].gain.value, master = audioProbe.gains[0].gain.value;
      const rms = (buffer) => { const data = buffer.getChannelData(0); let energy = 0; for (const sample of data) energy += sample * sample; return Math.sqrt(energy / data.length); };
      return { wind: rms(loops[0].buffer) * windGain,
        music: rms(loops[3].buffer) * musicGain, master };
    });
    assert(mix.music > 0 && mix.music < mix.wind * .85, `Music stays below the moving wind: ${JSON.stringify(mix)}`);
    assert(mix.music > .001, 'Music fades in at the quieter background level');
    assert(mix.master > 1, 'Scrolling reaches the increased overall level');
    await page.waitForTimeout(3200);
    const idle = await page.evaluate(() => audioProbe.gains[1].gain.value);
    assert(flying > idle, 'Wind settles after scrolling stops');
    assert(await page.evaluate(() => audioProbe.gains[1].gain.value < .002 && audioProbe.gains[5].gain.value > .01), 'Wind fades while music continues during reading');
    assert(await page.evaluate(() => audioProbe.gains[2].gain.value < .036), 'Summit wind stays behind flight wind');
    const eagleCount = await page.evaluate(() => audioProbe.sources.filter((s) => !s.loop && s.buffer.length > 1).length);
    assert(eagleCount <= 1);
    assert(await page.evaluate(() => audioProbe.sources.filter((s) => !s.loop).every((s) => s.buffer.duration > 0)), 'Bird accent source remains valid');
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
    assert.equal(await button.locator('span').isVisible(), false, 'Muted control stays icon-only');
    await page.keyboard.press('a');
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(() => audioProbe.contexts[0].state), 'suspended', 'A later gesture never reverses explicit mute');
    await button.click();
    await page.waitForFunction(() => audioProbe.contexts[0].state === 'running');
    assert.equal(requests.length, 5, 'Re-enabling uses loaded audio');
    assert.equal(await page.evaluate(() => audioProbe.sources.filter((s) => s.loop).length), 4, 'No duplicate loops');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.deepEqual(errors, []);
    await context.unrouteAll({ behavior: 'wait' });
    await context.close();
    console.log(`PASS ${lang}: autoplay unlock, single-tap start, CSP, decoding, scroll wind, continuous music, mute and resume`);
  }
} finally { await browser?.close(); server.kill(); }
