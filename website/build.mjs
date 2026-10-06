import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { content, languages } from './content.mjs';
import { docsLabels } from './docs-content.mjs';
import { buildDocs } from './build-docs.mjs';
import { ensureCurrentScreenshots } from '../scripts/handbook-screenshots.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, 'dist');
const app = 'https://app.flyary.ch';
const email = 'info@flyary.ch';
// The pilot sign-up form posts to this Edge Function (supabase/functions/website-waitlist); vercel.json allows it in form-action.
const waitlistEndpoint = 'https://pvhxrgvhzzqcyadyksvk.supabase.co/functions/v1/website-waitlist';
// Set the final marketing-site origin at build time; never guess a canonical domain.
const site = process.env.SITE_URL ? new URL(process.env.SITE_URL).origin : '';
if (site && !site.startsWith('https://')) throw new Error('SITE_URL must use HTTPS');
const esc = (s) => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const lines = (s) => esc(s).replaceAll('\n', '<br>');
const icons = {
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>', diagonal: '<path d="M6 18 18 6M6 6h12v12"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  play: '<path d="M8 5.5v13a1 1 0 0 0 1.5.9l10.4-6.5a1 1 0 0 0 0-1.8L9.5 4.6A1 1 0 0 0 8 5.5Z" fill="currentColor"/>',
};
const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
// App views shown on the start page: four in the explorer, the flight-day cockpit in the schools chapter.
const screenshots = ['memories.png', 'training.png', 'school-flight.png', 'feed.png'];
const ids = ['app', 'schools', 'faq'];
const phone = (inner, cls = '') => `<div class="phone ${cls}"><div class="phone-screen">${inner}</div></div>`;
const signupPath = (lang) => `/${lang}/testpilot/`;

// Start page: four painted scenes behind the content, each split into depth layers (landscape-work/layers; stage.js moves them).
// Listed from last to first, because the first scene lies on top. The number is how far a layer travels compared with the nearest one.
const landscape = join(here, 'landscape-work/layers/web');
const layerInfo = JSON.parse(await readFile(join(landscape, 'layers.json'), 'utf8'));
const scenes = [
  ['tal', [['himmel', .12], ['1-fern', .5], ['2-see', .62], ['3-tannen', .82], ['4-wiese', 1]]],
  ['huegel', [['himmel', .12], ['1-fern', .45], ['2-weide', .6], ['3-wald', .8], ['4-wiese', 1]]],
  ['wald', [['himmel', .12], ['1-fern', .4], ['2-mitte', .52], ['3-nah', .7], ['4-vorn', 1]]],
  ['gipfel', [['himmel', .12], ['1-fern', .36], ['2-grat', .44], ['3-wald', .6], ['4-nebel', 1]]],
];
// Visitors who ask for reduced motion get the page without the stage; for them its pictures resolve to a 1-pixel file.
const stagePicture = (img) => `<picture><source media="(prefers-reduced-motion: reduce)" srcset="/assets/landscape/blank.webp">${img}</picture>`;
function layer(name, f, eager) {
  const { crop, widths, ratio } = layerInfo[name];
  const srcset = widths.map((w) => `/assets/landscape/${name}-${w}.webp ${w}w`).join(', ');
  // Phones get the 1024 version even on dense screens: the paintings gain nothing from more.
  return stagePicture(`<img class="ly" data-crop="${crop}" data-f="${f}" src="/assets/landscape/${name}-1024.webp" srcset="${srcset}" sizes="(max-width: 700px) 60vw, 100vw" width="1024" height="${Math.round(1024 * ratio)}" alt=""${eager ? '' : ' loading="lazy"'}>`);
}
function stage(c) {
  const title = `<div class="stage-title"><div><small>${esc(c.claim)}</small><b translate="no">Flyary</b></div></div>`;
  const html = scenes.map(([scene, layers], i) => {
    const n = scenes.length - 1 - i;
    const parts = layers.map(([name, f]) => layer(`${scene}-${name}`, f, n === 0));
    if (n === 0) parts.splice(2, 0, title); // the name stands behind the snow ridge
    return `<div class="scene" data-scene="${n}"${n ? ' hidden' : ''}>${parts.join('')}${n < 3 ? '<div class="groundfill"></div>' : ''}</div>`;
  }).join('\n      ');
  return `<div class="stage" aria-hidden="true">
      ${html}
    </div>
    ${stagePicture('<img class="glider" src="/assets/landscape/schirm-320.webp" srcset="/assets/landscape/schirm-320.webp 320w, /assets/landscape/schirm.webp 640w" sizes="(max-width: 700px) 96px, 210px" width="640" height="636" alt="" aria-hidden="true">')}`;
}

/** Head, header and footer shared by the home page and the sign-up pages. `page` is '' (home), 'testpilot/' or 'danke/'. */
function shell(lang, { page, title, description, indexed = true, bodyClass, main, head = '' }) {
  const c = content[lang];
  const home = page === '';
  const anchor = (id) => (home ? `#${id}` : `/${lang}/#${id}`);
  const docsLink = `<a href="/${lang}/docs/">${esc(docsLabels[lang].name)}</a>`;
  const nav = c.nav.map((label, i) => `<a href="${anchor(ids[i])}">${esc(label)}</a>`).join('') + docsLink;
  const langs = Object.entries(languages).map(([code, label]) => `<a href="/${code}/${page}" lang="${code}" hreflang="${code}" aria-label="${label}" ${code === lang ? 'aria-current="page"' : ''}>${code.toUpperCase()}</a>`).join('');
  const logo = `<a class="brand" href="${home ? '#top' : `/${lang}/`}" aria-label="Flyary"><img src="/assets/flyary-192.png" width="38" height="38" alt=""><span>Flyary</span></a>`;
  const arrow = icon('arrow');
  const seo = site && indexed ? `<link rel="canonical" href="${site}/${lang}/${page}"><meta property="og:url" content="${site}/${lang}/${page}">
  ${Object.keys(languages).map((l) => `<link rel="alternate" hreflang="${l}" href="${site}/${l}/${page}">`).join('\n  ')}
  <link rel="alternate" hreflang="x-default" href="${site}/de/${page}">` : '';
  return `<!doctype html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  ${indexed ? '' : '<meta name="robots" content="noindex">'}
  <meta name="theme-color" content="${home ? '#d1b8af' : '#ffffff'}">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="${{ de: 'de_CH', fr: 'fr_CH', en: 'en_GB' }[lang]}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:image" content="${site}/assets/overview.png">
  <meta property="og:image:alt" content="${esc(c.previewAlt[0])}">
  <meta name="twitter:card" content="summary_large_image">
  ${seo}
  <link rel="icon" href="/assets/flyary-192.png" type="image/png">
  <link rel="preload" href="/assets/plus-jakarta-sans-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="/site.css">
  ${head}
  <script src="/boot.js"></script>
  <script src="/site.js" defer></script>
</head>
<body id="top" class="${bodyClass}">
  <a class="skip-link" href="#main">${esc(c.skip)}</a>
  <header class="header">
    <div class="header-inner wrap">
      ${logo}
      <nav class="desktop-nav" aria-label="${esc(c.menu)}">${nav}</nav>
      <div class="header-actions">
        <nav class="languages" aria-label="${esc(c.language)}">${langs}</nav>
        <a class="button button-small button-primary header-cta" href="${app}">${esc(c.open)} ${arrow}</a>
        <button class="menu-toggle" hidden aria-expanded="false" aria-controls="mobile-nav" aria-label="${esc(c.menu)}" data-open-label="${esc(c.menu)}" data-close-label="${esc(c.close)}"><span></span><span></span></button>
      </div>
    </div>
    <nav id="mobile-nav" class="mobile-nav" aria-label="${esc(c.menu)}" hidden>${nav}<a href="${app}">${esc(c.open)} ${icon('diagonal')}</a></nav>
    <noscript><nav class="mobile-nav no-script-nav" aria-label="${esc(c.menu)}">${nav}<a href="${app}">${esc(c.open)}</a></nav></noscript>
  </header>
  <main id="main">
${main}
  </main>
  <footer class="footer"><div class="wrap"><div class="footer-top"><div>${logo}<p>${esc(c.footerText)}</p><p class="sample-note">${esc(c.sampleNote)} ${esc(c.screenLanguage)}.</p></div><nav class="languages" aria-label="${esc(c.language)}">${langs}</nav></div><div class="footer-bottom"><span>© ${new Date().getUTCFullYear()} Flyary · ${esc(c.copyright)}</span><nav aria-label="${esc(c.contact)}">${docsLink}<a href="mailto:${email}">${esc(c.contact)}</a><a href="${app}/legal">${esc(c.privacy)}</a><a href="${app}/legal/terms">${esc(c.terms)}</a></nav><a class="back-top" href="#top">${esc(c.top)} ${icon('diagonal')}</a></div></div></footer>
</body></html>`;
}

function render(lang) {
  const c = content[lang];
  const schoolMail = `mailto:${email}?subject=${encodeURIComponent(c.emailSubject)}`;
  const signup = signupPath(lang);
  const main = `    ${stage(c)}
    <section class="hero" aria-labelledby="hero-title">
      <h1 id="hero-title"><span class="hero-brand" translate="no">Flyary</span> <span class="hero-claim">${esc(c.claim)}</span></h1>
      <div class="hero-actions" data-fade><a class="button button-primary" href="${signup}">${esc(c.start)}</a><a class="hero-link" href="${schoolMail}">${esc(c.secondary)}</a></div>
    </section>

    <section id="app" class="chapter chapter-mist" data-chap="0" aria-labelledby="explorer-title">
      <div class="wrap explorer" data-fade>
        <div class="explorer-copy">
          <h2 id="explorer-title">${esc(c.explorerTitle)}</h2>
          <p class="chapter-intro">${esc(c.pilotIntro)}</p>
          <div class="preview-tabs" aria-label="${esc(c.tabsLabel)}">${c.tabs.map((label, i) => `<a id="tab-${i}" href="#preview-${i}" class="preview-tab" data-index="${i}" data-src="/assets/${screenshots[i]}" data-alt="${esc(c.previewAlt[i])}"><b>${esc(label)}</b><span>${esc(c.tabDescriptions[i])}</span></a>`).join('')}</div>
          <div class="preview-panels">${c.panels.map(([title, text, points], i) => `<article id="preview-${i}" class="preview-panel" data-index="${i}"><h3>${esc(title)}</h3><p>${esc(text)}</p><ul class="panel-points">${points.map((point) => `<li>${esc(point)}</li>`).join('')}</ul><img class="fallback-screen" src="/assets/${screenshots[i]}" alt="${esc(c.previewAlt[i])}" width="780" height="1688" loading="lazy"></article>`).join('')}</div>
        </div>
        <figure class="explorer-stage">${phone(`<img id="preview-image" src="/assets/${screenshots[0]}" alt="${esc(c.previewAlt[0])}" width="780" height="1688" loading="lazy">`)}</figure>
      </div>
    </section>
    <div class="gap"></div>

    <section id="schools" class="chapter chapter-forest" data-chap="1" aria-labelledby="school-title">
      <div class="wrap school" data-fade>
        <figure class="school-visual">${phone(`<img src="/assets/cockpit.png" width="780" height="1688" alt="${esc(c.schoolImageAlt)}" loading="lazy">`)}</figure>
        <div class="school-copy">
          <h2 id="school-title">${lines(c.schoolTitle)}</h2>
          <p class="chapter-intro">${esc(c.schoolIntro)}</p>
          <ol class="school-steps">${c.schoolFeatures.map(([title, text]) => `<li><h3>${esc(title)}</h3><p>${esc(text)}</p></li>`).join('')}</ol>
          <a class="button button-primary" href="${schoolMail}">${esc(c.schoolCta)}</a>
          <p class="chapter-note">${esc(c.schoolNote)}</p>
        </div>
      </div>
    </section>
    <div class="gap"></div>

    <section id="about" class="chapter chapter-meadow" data-chap="2" aria-labelledby="about-title">
      <div class="wrap more" data-fade>
        <div class="about">
          <h2 id="about-title">${lines(c.aboutTitle)}</h2>
          <div class="video-frame"><video src="/assets/flyary-story.mp4" poster="/assets/video-poster.jpg" width="1920" height="1080" controls preload="none" playsinline aria-label="${esc(c.aboutVideoPlay)}"></video><button class="video-play" type="button" hidden aria-label="${esc(c.aboutVideoPlay)}">${icon('play')}</button></div>
        </div>
        <div id="faq" class="faq">
          <h2>${esc(c.faqTitle)}</h2>
          <div class="faq-list">${c.faqs.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div>
          <a class="chapter-link" href="mailto:${email}">${esc(c.contact)}: ${email}</a>
        </div>
      </div>
    </section>
    <div class="gap"></div>

    <section class="chapter chapter-valley" data-chap="3" aria-labelledby="final-title">
      <div class="wrap final" data-fade>
        <h2 id="final-title">${lines(c.finalTitle)}</h2>
        <p>${esc(c.finalNote)}</p>
        <div class="final-actions"><a class="button button-primary" href="${signup}">${esc(c.start)}</a><a class="final-link" href="${schoolMail}">${esc(c.secondary)}</a></div>
      </div>
    </section>`;
  return shell(lang, { page: '', title: c.title, description: c.description, bodyClass: 'home', main, head: '<link rel="stylesheet" href="/home.css">\n  <script src="/stage.js" defer></script>' });
}

/** Pilot sign-up form. Plain HTML POST (works without JavaScript); errors come back as #status-… anchors. */
function renderSignup(lang) {
  const c = content[lang], s = c.signup;
  const optional = `<span class="optional">(${esc(s.optional)})</span>`;
  const choices = (name, type, entries, required) => `<div class="choice-row">${Object.entries(entries).map(([value, label], i) => `<label class="choice"><input type="${type}" name="${name}" value="${value}"${required && i === 0 ? ' required' : ''}><span>${esc(label)}</span></label>`).join('')}</div>`;
  const statuses = Object.entries(s.errors).map(([key, text]) => `<p id="status-${key}" class="form-status" role="alert">${esc(text)}${key === 'error' ? ` <a href="mailto:${email}">${esc(email)}</a>` : ''}</p>`).join('');
  const main = `    <section class="signup" aria-labelledby="signup-title">
      <div class="page-band page-band-summit" aria-hidden="true"></div>
      <div class="wrap signup-grid">
        <div class="signup-copy">
          <h1 id="signup-title">${esc(s.heading[0])}<br>${esc(s.heading[1])}</h1>
          <p class="section-intro">${esc(s.intro)}</p>
          <ul class="signup-points">${s.points.map((p) => `<li>${icon('check')}${esc(p)}</li>`).join('')}</ul>
        </div>
        <form id="form" class="signup-card" method="post" action="${waitlistEndpoint}" accept-charset="utf-8">
          <h2>${esc(s.formTitle)}</h2>
          ${statuses}
          <input type="hidden" name="lang" value="${lang}">
          <input type="hidden" name="started" value="">
          <div class="field"><label for="f-name">${esc(s.name)}</label><input id="f-name" name="name" required minlength="2" maxlength="100" autocomplete="name"></div>
          <div class="field"><label for="f-email">${esc(s.email)}</label><input id="f-email" name="email" type="email" required maxlength="200" autocomplete="email"></div>
          <fieldset class="field"><legend>${esc(s.role)}</legend>${choices('role', 'radio', s.roles, true)}</fieldset>
          <fieldset class="field"><legend>${esc(s.disciplines)}</legend>${choices('discipline', 'checkbox', s.discipline, false)}</fieldset>
          <div class="field"><label for="f-school">${esc(s.school)} ${optional}</label><input id="f-school" name="school" maxlength="120" autocomplete="organization"></div>
          <div class="field"><label for="f-comment">${esc(s.comment)} ${optional}</label><textarea id="f-comment" name="comment" rows="3" maxlength="1000" placeholder="${esc(s.commentPlaceholder)}"></textarea></div>
          <div class="hp" aria-hidden="true"><label for="f-website">${esc(s.honeypot)}</label><input id="f-website" name="website" tabindex="-1" autocomplete="off"></div>
          <label class="consent"><input type="checkbox" name="consent" value="yes" required><span>${esc(s.consent)} <a href="${app}/legal">${esc(s.privacy)}</a></span></label>
          <button class="button button-primary" type="submit">${esc(s.submit)} ${icon('arrow')}</button>
        </form>
      </div>
    </section>`;
  return shell(lang, { page: 'testpilot/', title: s.title, description: s.description, bodyClass: 'signup-page', main });
}

function renderThanks(lang) {
  const c = content[lang], t = c.thanks;
  const main = `    <section class="thanks" aria-labelledby="thanks-title">
      <div class="wrap thanks-inner">
        <h1 id="thanks-title">${esc(t.heading[0])}<br>${esc(t.heading[1])}</h1>
        <p>${esc(t.text)}</p>
        <a class="button button-primary" href="/${lang}/">${esc(t.back)}</a>
      </div>
      <img class="thanks-glider" src="/assets/landscape/schirm-320.webp" width="640" height="636" alt="">
    </section>`;
  return shell(lang, { page: 'danke/', title: t.title, description: c.description, indexed: false, bodyClass: 'signup-page', main });
}

// Start from an empty output so removed pages (e.g. the former technical docs) do not linger.
await ensureCurrentScreenshots();
await rm(out, { recursive: true, force: true });
await mkdir(join(out, 'assets'), { recursive: true });
for (const file of ['site.css', 'home.css', 'site.js', 'stage.js', 'boot.js']) await cp(join(here, file), join(out, file));
const assets = ['flyary-192.png', 'video-poster.jpg', 'flyary-story.mp4', 'overview.png', 'memories.png', 'training.png', 'school-flight.png', 'cockpit.png', 'feed.png', 'plus-jakarta-sans-latin-wght-normal.woff2', 'plus-jakarta-sans-license.txt'];
const appScreens = {
  'overview.png': 'mobile/01-home.png', 'training.png': 'mobile/10-training.png',
  'memories.png': 'mobile/59-flight-memories.png', 'school-flight.png': 'mobile/20-flight-notes.png',
  'cockpit.png': 'school-mobile/34-coaching.png', 'feed.png': 'mobile/22-feed.png',
};
for (const asset of assets) await cp(appScreens[asset] ? join(here, '../docs/handbook', appScreens[asset]) : join(here, 'assets', asset), join(out, 'assets', asset));
// The landscape layers ship as exported; the original scenes and the scripts stay in landscape-work.
await mkdir(join(out, 'assets/landscape'), { recursive: true });
for (const file of (await readdir(landscape)).filter((f) => f.endsWith('.webp'))) await cp(join(landscape, file), join(out, 'assets/landscape', file));
for (const lang of Object.keys(languages)) {
  for (const [dir, html] of [['', render(lang)], ['testpilot', renderSignup(lang)], ['danke', renderThanks(lang)]]) {
    await mkdir(join(out, lang, dir), { recursive: true });
    await writeFile(join(out, lang, dir, 'index.html'), html);
  }
}
await writeFile(join(out, 'index.html'), render('de'));
const docsUrls = await buildDocs({ out, site });
await writeFile(join(out, '404.html'), '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Flyary — 404</title><body><h1>404</h1><p><a href="/">Flyary</a></p></body></html>');
await writeFile(join(out, 'robots.txt'), `User-agent: *\nAllow: /\n${site ? `Sitemap: ${site}/sitemap.xml\n` : ''}`);
await writeFile(join(out, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${site ? [...Object.keys(languages).flatMap((l) => [`/${l}/`, signupPath(l)]), ...docsUrls].map((url) => `<url><loc>${esc(site + url)}</loc></url>`).join('') : ''}</urlset>`);
// Ensure a build fails immediately if an expected runtime asset is missing.
await Promise.all(assets.map((a) => readFile(join(out, 'assets', a))));
console.log(`Flyary website built: ${out} (DE / FR / EN).${site ? ` Canonical origin: ${site}` : ' Set SITE_URL to enable absolute SEO URLs and sitemap entries for deployment.'}`);
