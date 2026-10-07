import { ensureCurrentScreenshots } from '../scripts/handbook-screenshots.mjs';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Marked } from 'marked';
import { content, languages } from './content.mjs';
import { docsLabels } from './docs-content.mjs';
import { publicDocuments, assertPublicText } from './publication.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const esc = (s) => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const plain = (s) => s.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*`#_]/g, '').trim();
const slug = (s) => plain(s).toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s/g, '-');

export async function buildDocs({ out, site }) {
  await ensureCurrentScreenshots();
  const sources = publicDocuments.map((source) => ({ ...source }));
  const pages = [], sourceMap = new Map(), images = new Map();
  const markdown = new Marked({ gfm: true });

  for (const source of sources) {
    source.path = resolve(root, source.file);
    source.raw = await readFile(source.path, 'utf8');
    assertPublicText(source.raw, source.file);
    // The school handbook uses print-layout directives around ordinary Markdown.
    const prepared = source.raw.replace(/^::: \S+ (.+)$/gm, '### $1').replace(/^:::\s*$/gm, '');
    const tokens = markdown.lexer(prepared);
    source.title ||= plain(tokens.find((t) => t.type === 'heading')?.text || source.route);
    source.url = `/de/docs/${source.route}/`;
    source.anchors = new Map();
    source.pages = [];
    const used = new Map();
    markdown.walkTokens(tokens, (t) => {
      if (t.type !== 'heading') return;
      const base = slug(t.text), count = used.get(base) || 0;
      used.set(base, count + 1);
      t.docId = base + (count ? `-${count}` : '');
    });
    let page;
    for (const token of tokens) {
      if (!page || (source.chapters && token.type === 'heading' && token.depth === 2)) {
        const chapter = Boolean(page);
        page = { source, title: chapter ? plain(token.text) : source.title, url: chapter ? `${source.url}${token.docId}/` : source.url, tokens: [], id: token.docId || 'document', chapter };
        pages.push(page); source.pages.push(page);
      }
      if (token.type === 'heading') source.anchors.set(token.docId, page.url);
      page.tokens.push(token);
    }
    sourceMap.set(source.path, source);
  }

  function linkTarget(href, source) {
    if (/^(https?:|mailto:)/i.test(href)) return href;
    if (/^[a-z][\w+.-]*:/i.test(href) || href.startsWith('//')) return null;
    const [file, fragment] = href.split('#');
    const target = sourceMap.get(file ? resolve(dirname(source.path), decodeURIComponent(file)) : source.path);
    if (!target) return null;
    const anchor = fragment ? decodeURIComponent(fragment) : '';
    if (anchor && !target.anchors.has(anchor)) throw new Error(`Unknown documentation anchor: ${source.file} -> ${href}`);
    return (target.anchors.get(anchor) || target.url) + (anchor ? `#${anchor}` : '');
  }

  function renderBody(page) {
    const headings = [];
    const renderer = {
      heading(token) {
        if (token.depth === 1 || (page.chapter && token === page.tokens[0])) return '';
        headings.push({ title: plain(token.text), id: token.docId });
        return `<h${token.depth} id="${esc(token.docId)}">${this.parser.parseInline(token.tokens)}</h${token.depth}>`;
      },
      link(token) {
        const label = this.parser.parseInline(token.tokens);
        const href = linkTarget(token.href, page.source);
        if (!href) throw new Error(`Unapproved document link in ${page.source.file}: ${token.href}`);
        return `<a href="${esc(href)}">${label}</a>`;
      },
      image(token) {
        const path = resolve(root, 'docs', token.href);
        const allowed = join(root, 'docs', 'handbook') + sep;
        if (!path.startsWith(allowed) || !path.endsWith('.png')) throw new Error(`Unexpected documentation image: ${token.href}`);
        if (!images.has(path)) {
          const bytes = readFileSync(path);
          images.set(path, { url: '/docs-assets/' + relative(join(root, 'docs/handbook'), path).split(sep).join('/'), width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) });
        }
        const im = images.get(path);
        return `<span class="doc-figure"><a href="${esc(im.url)}" aria-label="${esc(token.text)} — Bild vergrössern"><img src="${esc(im.url)}" alt="${esc(token.text)}" width="${im.width}" height="${im.height}" loading="lazy"></a><span>${esc(token.text)}</span></span>`;
      },
      html(token) { return esc(token.text); },
      table(token) {
        const row = (cells, tag) => `<tr>${cells.map((cell) => `<${tag}>${this.parser.parseInline(cell.tokens)}</${tag}>`).join('')}</tr>`;
        return `<div class="doc-table" role="region" aria-label="Tabelle: ${esc(plain(token.header.map((cell) => cell.text).join(', ')))}" tabindex="0"><table><thead>${row(token.header, 'th')}</thead><tbody>${token.rows.map((r) => row(r, 'td')).join('')}</tbody></table></div>`;
      },
    };
    const parser = new Marked({ gfm: true, renderer });
    const html = parser.parser(page.tokens, parser.defaults);
    return { html, headings };
  }

  function shell({ lang = 'de', title, description = `${title} — Flyary Handbücher und technische Dokumentation.`, url, body, search = false }) {
    const l = docsLabels[lang], c = content[lang];
    const brand = `<a class="brand" href="/${lang}/" aria-label="Flyary"><img src="/assets/flyary-192.png" width="38" height="38" alt=""><span translate="no">Flyary</span></a>`;
    return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)} | Flyary</title><meta name="description" content="${esc(description)}"><meta name="theme-color" content="#ffffff">${site ? `<link rel="canonical" href="${site}${esc(url)}">` : ''}<link rel="icon" href="/assets/flyary-192.png"><link rel="preload" href="/assets/plus-jakarta-sans-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin><link rel="stylesheet" href="/site.css"><link rel="stylesheet" href="/docs.css">${search ? '<script src="/docs-search-index.js" defer></script>' : ''}<script src="/docs.js" defer></script></head><body id="top" class="docs-page${search ? ' docs-hub-page' : ''}"><a class="skip-link" href="#main">${esc(c.skip)}</a><header class="header"><div class="header-inner wrap">${brand}<a class="docs-home" href="/${lang}/docs/">${esc(l.name)}</a><div class="header-actions">${search ? `<nav class="languages" aria-label="${esc(c.language)}">${Object.entries(languages).map(([code, label]) => `<a href="/${code}/docs/" lang="${code}" aria-label="${label}" ${code === lang ? 'aria-current="page"' : ''}>${code.toUpperCase()}</a>`).join('')}</nav>` : ''}<a class="button button-primary button-small header-cta" href="https://app.flyary.ch">${esc(c.open)}</a></div></div></header>${search ? '<div class="page-band page-band-hills" aria-hidden="true"></div>' : ''}${body}<footer class="footer docs-footer"><div class="wrap"><a href="/${lang}/">${esc(l.home)} ↗</a><a href="/${lang}/docs/">${esc(l.name)}</a><a href="mailto:info@flyary.ch">${esc(c.contact)}</a></div></footer></body></html>`;
  }

  const urls = [];
  async function emit(url, html) {
    const target = join(out, url, 'index.html');
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, html); urls.push(url);
  }
  // Full printable editions contain exactly the same approved content as the chapters.
  for (const source of sources.filter((s) => s.chapters)) source.printUrl = `${source.url}print/`;
  for (const lang of Object.keys(languages)) {
    const l = docsLabels[lang];
    const groupSources = [sources[0], sources[1]];
    const body = `<main id="main" class="wrap docs-hub"><div class="docs-intro"><h1>${esc(l.title)}</h1><p>${esc(l.intro)}</p></div><p class="docs-language-note">${esc(l.note)}</p><section class="docs-search" hidden data-empty="${esc(l.empty)}" data-hint="${esc(l.hint)}"><label for="docs-query">${esc(l.search)}</label><input id="docs-query" type="search" placeholder="${esc(l.placeholder)}" autocomplete="off" aria-controls="search-results"><p id="search-status" role="status">${esc(l.hint)}</p><ul id="search-results" aria-label="${esc(l.results)}"></ul></section><div class="docs-categories">${l.groups.map(([label, title, text], i) => `<section><p class="docs-label">${esc(label)} · ${esc(l.german)}</p><h2>${esc(title)}</h2><p>${esc(text)}</p><a class="text-link" href="${groupSources[i].url}">${esc(l.read)} →</a>${groupSources[i].downloadUrl ? `<a class="doc-download" href="${groupSources[i].downloadUrl}" download>${esc(l.download)} ↓</a>` : ''}</section>`).join('')}</div></main>`;
    await emit(`/${lang}/docs/`, shell({ lang, title: l.name, description: l.intro, url: `/${lang}/docs/`, body, search: true }));
  }

  const index = [];
  for (const page of pages) {
    const source = page.source;
    const { html, headings } = renderBody(page);
    const siblings = source.chapters ? source.pages : sources.filter((s) => s.group === 2).map((s) => s.pages[0]);
    const current = siblings.indexOf(page), prev = siblings[current - 1], next = siblings[current + 1];
    const list = (entries) => entries.map((p) => `<li><a href="${esc(p.url)}" ${p === page ? 'aria-current="page"' : ''}>${esc(p.title)}</a></li>`).join('');
    const contents = source.chapters && !page.chapter ? `<nav class="chapter-index" aria-label="Kapitel"><h2>Alle Kapitel</h2><ol>${list(source.pages.slice(1))}</ol></nav>` : '';
    const body = `<main id="main" class="wrap docs-layout"><aside class="docs-sidebar"><details open><summary>${source.chapters ? 'Kapitelübersicht' : 'Technische Dokumentation'}</summary><nav aria-label="Dokumentation"><ul>${list(siblings)}</ul></nav></details><a class="text-link" href="/de/docs/">← Alle Dokumente</a></aside><div class="doc-main"><nav class="breadcrumbs" aria-label="Brotkrümelnavigation"><a href="/de/docs/">Wissen & Hilfe</a><span>/</span><a href="${source.chapters ? source.url : '/de/docs/technical/'}">${source.group === 0 ? 'Piloten' : source.group === 1 ? 'Flugschulen' : 'Technik'}</a></nav><article class="doc-article" lang="de"><header class="doc-title"><p class="docs-label">${esc(docsLabels.de.groups[source.group][0])}</p><h1 id="${esc(page.id)}">${esc(page.title)}</h1><div class="doc-tools">${source.downloadUrl ? `<a href="${source.downloadUrl}" download>Handbuch als Word ↓</a>` : ''}<button type="button" class="doc-print" hidden>Drucken / PDF</button></div></header>${headings.length ? `<details class="on-this-page"><summary>Auf dieser Seite</summary><ul>${headings.map((h) => `<li><a href="#${esc(h.id)}">${esc(h.title)}</a></li>`).join('')}</ul></details>` : ''}${html}${contents}</article><nav class="doc-pagination" aria-label="Weitere Dokumente">${prev ? `<a href="${prev.url}"><span>← Zurück</span>${esc(prev.title)}</a>` : '<span></span>'}${next ? `<a href="${next.url}"><span>Weiter →</span>${esc(next.title)}</a>` : ''}</nav></div></main>`;
    await emit(page.url, shell({ title: page.title, url: page.url, body }));
    const text = plain(page.tokens.map((t) => t.raw).join('\n')).replace(/\s+/g, ' ');
    index.push({ title: page.title, group: docsLabels.de.groups[source.group][0], url: page.url, text });
  }
  for (const [path, asset] of images) {
    const target = join(out, asset.url);
    await mkdir(dirname(target), { recursive: true });
    await cp(path, target);
  }
  await writeFile(join(out, 'docs-search-index.js'), `window.flyaryDocs = ${JSON.stringify(index).replaceAll('<', '\\u003c')};`);
  for (const file of ['docs.css', 'docs.js']) await cp(join(here, file), join(out, file));
  console.log(`Documentation built: ${pages.length} pages, ${images.size} referenced images.`);
  return urls;
}
