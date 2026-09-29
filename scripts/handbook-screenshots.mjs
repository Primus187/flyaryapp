import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, existsSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const receipt = resolve(root, 'docs/handbook/current-screenshots.json');
const books = ['Benutzerhandbuch-Piloten', 'Betriebshandbuch-Flugschulen'];
const documents = [...books.map(b => `docs/${b}.md`), 'website/documents/pilots.md', 'website/documents/schools.md'];
const digest = (value) => createHash('sha256').update(value).digest('hex');
function inputDigest(path) {
  const content = readFileSync(path);
  return digest(/\.(?:[cm]?[jt]sx?|json|html|css|md|sql|svg|txt|ya?ml)$/.test(extname(path)) ? content.toString('utf8').replaceAll('\r\n', '\n') : content);
}
function files(path) {
  if (!existsSync(path)) return [];
  return readdirSync(path, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(resolve(path, e.name)) : [resolve(path, e.name)]);
}
function sourceHash() {
  const inputs = ['src', 'public', 'supabase/migrations'].flatMap(p => files(resolve(root, p)));
  for (const p of ['package.json', 'package-lock.json', 'index.html', 'vite.config.ts', 'tailwind.config.ts', 'postcss.config.js', 'scripts/capture-handbook.mjs', 'scripts/capture-school-handbook.mjs', 'scripts/handbook-market-fixtures.mjs', 'scripts/handbook-screenshots.mjs', ...documents]) {
    if (existsSync(resolve(root, p))) inputs.push(resolve(root, p));
  }
  return digest(inputs.map(p => `${relative(root, p).replaceAll('\\', '/')}\0${inputDigest(p)}`).sort().join('\n'));
}
function imageHashes() {
  const result = {};
  // Include every captured view, also those used only on the landing page.
  for (const folder of ['mobile', 'school-mobile']) {
    const manifest = JSON.parse(readFileSync(resolve(root, `docs/handbook/${folder}/manifest.json`), 'utf8'));
    for (const entry of manifest.screenshots) {
      const path = `handbook/${folder}/${entry.name}.png`;
      result[path] = digest(readFileSync(resolve(root, 'docs', path)));
    }
  }
  for (const document of documents) {
    const markdown = readFileSync(resolve(root, document), 'utf8');
    for (const match of markdown.matchAll(/!\[[^\]]*\]\((handbook\/[^)]+\.png)\)/g)) {
      result[match[1]] = digest(readFileSync(resolve(root, 'docs', match[1])));
    }
  }
  if (!Object.keys(result).length) throw new Error('No handbook screenshots found');
  return result;
}
export function assertCurrentScreenshots() {
  const saved = existsSync(receipt) ? JSON.parse(readFileSync(receipt, 'utf8')) : null;
  if (!saved || saved.sourceHash !== sourceHash() || JSON.stringify(saved.images) !== JSON.stringify(imageHashes())) {
    throw new Error('Handbook screenshots are stale. Run npm run handbook:screenshots.');
  }
}
function capture(script, base) {
  return new Promise((resolveDone, reject) => {
    const child = spawn(process.execPath, [script], { cwd: root, stdio: 'inherit', windowsHide: true, env: { ...process.env, HANDBOOK_BASE_URL: base } });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolveDone() : reject(new Error(`${script} failed (${code})`)));
  });
}
// CI/hosting builds (e.g. Vercel) see only the committed tree, not the full local app state, and
// cannot run the capture. There the committed images just have to match the committed receipt.
function assertCommittedImages() {
  const saved = existsSync(receipt) ? JSON.parse(readFileSync(receipt, 'utf8')) : null;
  if (!saved || JSON.stringify(saved.images) !== JSON.stringify(imageHashes())) {
    throw new Error('Committed handbook screenshots do not match current-screenshots.json. Run npm run handbook:screenshots locally and commit both.');
  }
}
export async function ensureCurrentScreenshots(force = false) {
  if (process.env.CI || process.env.VERCEL) { assertCommittedImages(); return; }
  if (!force) { try { assertCurrentScreenshots(); return; } catch { /* Refresh stale captures. */ } }
  rmSync(receipt, { force: true });
  const before = sourceHash();
  let createServer;
  try { ({ createServer } = await import('vite')); }
  catch { throw new Error('Screenshots are stale. Run npm ci and npm run handbook:screenshots in the repository root, then commit the images and current-screenshots.json.'); }
  const server = await createServer({ root, server: { host: '127.0.0.1', port: 0, open: false } });
  try {
    await server.listen();
    const base = `http://127.0.0.1:${server.httpServer.address().port}`;
    for (const [script, folder] of [['capture-handbook.mjs', 'mobile'], ['capture-school-handbook.mjs', 'school-mobile']]) {
      await capture(`scripts/${script}`, base);
      const manifest = JSON.parse(readFileSync(resolve(root, `docs/handbook/${folder}/manifest.json`), 'utf8'));
      if (manifest.errors.length) throw new Error(`${folder}: ${manifest.errors.join('; ')}`);
    }
    const images = imageHashes();
    for (const folder of ['mobile', 'school-mobile']) {
      const manifest = JSON.parse(readFileSync(resolve(root, `docs/handbook/${folder}/manifest.json`), 'utf8'));
      const names = new Set(manifest.screenshots.map(s => `${folder}/${s.name}.png`));
      for (const image of Object.keys(images).filter(p => p.startsWith(`handbook/${folder}/`))) {
        if (!names.has(image.slice('handbook/'.length))) throw new Error(`Screenshot not captured: ${image}`);
      }
    }
    if (sourceHash() !== before) throw new Error('App changed during capture; run again.');
    writeFileSync(receipt, JSON.stringify({ capturedAt: new Date().toISOString(), sourceHash: before, images }, null, 2) + '\n');
  } finally { await server.close(); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--check')) assertCurrentScreenshots();
  else await ensureCurrentScreenshots(process.argv.includes('--force'));
}
