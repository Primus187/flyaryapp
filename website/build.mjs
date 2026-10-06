import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
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
  book: '<path d="M12 6v15M3 4c4-1 7 0 9 2 2-2 5-3 9-2v15c-4-1-7 0-9 2-2-2-5-3-9-2Z"/>',
  mountain: '<path d="m2 20 8-15 4 7 2-4 6 12ZM7 11l3 2 3-2"/>',
  people: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 5"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  bag: '<path d="M5 7h14l2 14H3ZM9 7V5a3 3 0 0 1 6 0v2"/>',
  check: '<path d="m5 12 4 4L19 6"/>', down: '<path d="M12 4v16m-6-6 6 6 6-6"/>',
  upload: '<path d="M12 16V4m-5 5 5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
  chart: '<path d="M4 20V10m6 10V4m6 16v-7m4 7H2"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  radio: '<circle cx="12" cy="12" r="2"/><path d="M8.5 8.5a5 5 0 0 0 0 7m7 0a5 5 0 0 0 0-7M5.6 5.6a9 9 0 0 0 0 12.8m12.8 0a9 9 0 0 0 0-12.8"/>',
  award: '<circle cx="12" cy="9" r="6"/><path d="m8.5 14-1.5 7 5-3 5 3-1.5-7"/>',
  chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12Z"/>',
  sparkle: '<path d="M12 3v4m0 10v4M3 12h4m10 0h4M6 6l2.5 2.5m7 7L18 18M18 6l-2.5 2.5m-7 7L6 18"/>',
  play: '<path d="M8 5.5v13a1 1 0 0 0 1.5.9l10.4-6.5a1 1 0 0 0 0-1.8L9.5 4.6A1 1 0 0 0 8 5.5Z" fill="currentColor"/>',
  scale: '<path d="M12 3v18M7 21h10M5 7h14M5 7l-3 7a3 3 0 0 0 6 0Zm14 0-3 7a3 3 0 0 0 6 0Z"/>',
};
const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
// Every screenshot appears once: hero = logbook + stats, tour = memories, training, school flight, feed,
// schools section = flight-day cockpit; the about section shows the Flyary story video.
const screenshots = ['memories.png', 'training.png', 'school-flight.png', 'feed.png'];
const ids = ['app', 'schools', 'faq'];
const featureIcons = ['image', 'chart', 'book'];
const stepIcons = ['calendar', 'radio', 'award'];
const phone = (inner, cls = '') => `<div class="phone ${cls}"><div class="phone-screen">${inner}</div></div>`;
const signupPath = (lang) => `/${lang}/testpilot/`;

// Signature element: a flight track that draws itself across the sky, with a glider following it.
const flightPath = 'M-60 566 C 160 588, 330 528, 520 556 S 760 556, 880 460 S 1010 210, 1150 250 S 1330 170, 1520 50';
const sky = `<div class="sky" aria-hidden="true">
  <div class="aurora aurora-1"></div><div class="aurora aurora-2"></div><div class="aurora aurora-3"></div>
  <svg class="contours" viewBox="0 0 1440 800" preserveAspectRatio="xMidYMid slice"><g fill="none" stroke="currentColor">${[0, 1, 2, 3, 4, 5, 6].map((i) => `<path d="M-100 ${640 - i * 38} C 240 ${560 - i * 44}, 420 ${700 - i * 30}, 720 ${600 - i * 46} S 1180 ${520 - i * 36}, 1560 ${600 - i * 40}"/>`).join('')}</g></svg>
  <svg class="flight" viewBox="0 0 1440 640" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="trail" x1="0" x2="1"><stop offset="0" stop-color="#38bdf8" stop-opacity="0"/><stop offset=".35" stop-color="#38bdf8"/><stop offset="1" stop-color="#34d399"/></linearGradient></defs>
    <path class="flight-path" d="${flightPath}" pathLength="1"/>
    <g class="glider"><path d="M-14 -3 Q0 -12 14 -3" fill="none" stroke="#e6f6ff" stroke-width="3" stroke-linecap="round"/><path d="M-9 -2 L0 9 M9 -2 L0 9" stroke="#bfe7ff" stroke-width="1"/><circle cy="10" r="2.4" fill="#fff"/></g>
  </svg>
  <div class="stars"></div>
</div>`;

/** Head, header and footer shared by the home page and the sign-up pages. `page` is '' (home), 'testpilot/' or 'danke/'. */
function shell(lang, { page, title, description, indexed = true, bodyClass, main }) {
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
  <meta name="theme-color" content="#06111f">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="${{ de: 'de_CH', fr: 'fr_CH', en: 'en_GB' }[lang]}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:image" content="${site}/assets/overview.png">
  <meta property="og:image:alt" content="${esc(c.previewAlt[0])}">
  <meta name="twitter:card" content="summary_large_image">
  ${seo}
  <link rel="icon" href="/assets/flyary-192.png" type="image/png">
  <link rel="stylesheet" href="/site.css">
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
  <footer class="footer wrap"><div class="footer-top"><div>${logo}<p>${esc(c.footerText)}</p><p class="sample-note">${esc(c.sampleNote)} ${esc(c.screenLanguage)}.</p></div><nav class="languages" aria-label="${esc(c.language)}">${langs}</nav></div><div class="footer-bottom"><span>© ${new Date().getUTCFullYear()} Flyary · ${esc(c.copyright)}</span><nav aria-label="${esc(c.contact)}">${docsLink}<a href="mailto:${email}">${esc(c.contact)}</a><a href="${app}/legal">${esc(c.privacy)}</a><a href="${app}/legal/terms">${esc(c.terms)}</a></nav><a class="back-top" href="#top">${esc(c.top)} ${icon('diagonal')}</a></div></footer>
</body></html>`;
}

function render(lang) {
  const c = content[lang];
  const schoolMail = `mailto:${email}?subject=${encodeURIComponent(c.emailSubject)}`;
  const signup = signupPath(lang);
  const arrow = icon('arrow');
  const marquee = (hidden) => `<ul class="marquee-list"${hidden ? ' aria-hidden="true"' : ''}>${c.highlights.map((h) => `<li>${icon('sparkle')}${esc(h)}</li>`).join('')}</ul>`;
  const main = `    <section class="hero" aria-labelledby="hero-title">
      ${sky}
      <div class="wrap hero-grid">
        <div class="hero-copy">
          <p class="eyebrow eyebrow-pill reveal"><span class="pulse" aria-hidden="true"></span>${esc(c.eyebrow)}</p>
          <h1 id="hero-title" class="reveal">${esc(c.hero[0])}<br><span class="gradient-text">${esc(c.hero[1])}</span></h1>
          <p class="hero-intro reveal">${esc(c.intro)}</p>
          <p class="small-note reveal">${esc(c.phase)}</p>
          <div class="hero-actions reveal"><a class="button button-primary button-glow" href="${signup}">${esc(c.start)} ${arrow}</a><a class="button button-ghost" href="${schoolMail}">${esc(c.secondary)} ${icon('diagonal')}</a></div>
          <p class="small-note reveal">${icon('check')}${esc(c.note)}</p>
        </div>
        <figure class="hero-stage reveal" data-tilt>
          <div class="stage-glow" aria-hidden="true"></div>
          ${phone(`<img src="/assets/stats.png" alt="${esc(c.heroBackAlt)}" width="780" height="1688" fetchpriority="high">`, 'phone-back')}
          ${phone(`<img src="/assets/logbook.png" alt="${esc(c.heroFrontAlt)}" width="780" height="1688" fetchpriority="high">`, 'phone-front')}
          <ul class="hero-chips" aria-hidden="true">${c.heroChips.map((chip, i) => `<li class="chip chip-${i}">${icon(['image', 'chart', 'award'][i])}${esc(chip)}</li>`).join('')}</ul>
          <figcaption>${esc(c.previewCaption)} · ${esc(c.screenLanguage)}</figcaption>
        </figure>
      </div>
      <a class="scroll-hint" href="#app"><span>${esc(c.scrollHint)}</span>${icon('down')}</a>
    </section>

    <section class="marquee" aria-label="${esc(c.highlightsLabel)}"><div class="marquee-track">${marquee(false)}${marquee(true)}</div></section>

    <section id="app" class="section explorer wrap" aria-labelledby="explorer-title">
      <div class="section-heading reveal"><p class="eyebrow">${esc(c.productLabel)}</p><h2 id="explorer-title">${esc(c.explorerTitle)}</h2></div>
      <div class="explorer-grid">
        <div class="product-explorer">
          <div class="preview-tabs" aria-label="${esc(c.tabsLabel)}">${c.tabs.map((label, i) => `<a id="tab-${i}" href="#preview-${i}" class="preview-tab reveal" data-index="${i}" data-src="/assets/${screenshots[i]}" data-alt="${esc(c.previewAlt[i])}"><span class="tab-index">0${i + 1}</span><span class="tab-body"><span class="tab-title">${esc(label)}</span><span class="tab-description">${esc(c.tabDescriptions[i])}</span></span>${arrow}</a>`).join('')}</div>
          <div class="preview-panels">${c.panels.map(([title, text, points], i) => `<article id="preview-${i}" class="preview-panel" data-index="${i}"><h3>${esc(title)}</h3><p>${esc(text)}</p><ul class="panel-points">${points.map((point) => `<li>${icon('check')}${esc(point)}</li>`).join('')}</ul><img class="fallback-screen" src="/assets/${screenshots[i]}" alt="${esc(c.previewAlt[i])}" width="780" height="1688" loading="lazy"></article>`).join('')}</div>
        </div>
        <figure class="explorer-stage reveal">
          <div class="stage-glow" aria-hidden="true"></div>
          ${phone(`<img id="preview-image" src="/assets/${screenshots[0]}" alt="${esc(c.previewAlt[0])}" width="780" height="1688">`, 'phone-explorer')}
        </figure>
      </div>
    </section>

    <section id="pilots" class="section wrap pilot-section" aria-labelledby="pilot-title">
      <div class="section-heading split reveal"><div><p class="eyebrow">${esc(c.pilotLabel)}</p><h2 id="pilot-title">${lines(c.pilotTitle)}</h2></div><p class="section-intro">${esc(c.pilotIntro)}</p></div>
      <div class="feature-grid">${c.pilotFeatures.map(([title, text, label], i) => `<article class="feature-card reveal" data-glow><span class="feature-icon">${icon(featureIcons[i])}</span><p class="feature-label">${esc(label)}</p><h3>${esc(title)}</h3><p>${esc(text)}</p></article>`).join('')}</div>
      <a class="text-link reveal" href="${signup}">${esc(c.start)} ${arrow}</a>
    </section>

    <section id="schools" class="school-section" aria-labelledby="school-title">
      <div class="school-backdrop" aria-hidden="true"><div class="aurora aurora-2"></div><div class="aurora aurora-3"></div></div>
      <div class="wrap school-grid">
        <figure class="school-visual reveal" data-tilt><div class="stage-glow" aria-hidden="true"></div>${phone(`<img src="/assets/cockpit.png" width="780" height="1688" alt="${esc(c.schoolImageAlt)}" loading="lazy">`)}</figure>
        <div class="school-copy">
          <p class="eyebrow reveal">${esc(c.schoolLabel)}</p>
          <h2 id="school-title" class="reveal">${lines(c.schoolTitle)}</h2>
          <p class="section-intro reveal">${esc(c.schoolIntro)}</p>
          <ol class="school-steps">${c.schoolFeatures.map(([title, text], i) => `<li class="reveal"><span class="step-node" aria-hidden="true">${icon(stepIcons[i])}</span><div><p class="step-label">${esc(c.stepLabel)} ${i + 1}</p><h3>${esc(title)}</h3><p>${esc(text)}</p></div></li>`).join('')}</ol>
          <a class="button button-white reveal" href="${schoolMail}">${esc(c.schoolCta)} ${arrow}</a>
          <p class="small-note reveal">${esc(c.schoolNote)}</p>
        </div>
      </div>
      <div class="wrap school-bottom"><span>${esc(c.schoolBadge)}</span><span>${esc(c.schoolRoles)}</span></div>
    </section>

    <section id="about" class="section wrap about" aria-labelledby="about-title">
      <div class="about-heading reveal"><p class="eyebrow">${esc(c.aboutLabel)}</p><h2 id="about-title">${lines(c.aboutTitle)}</h2></div>
      <figure class="about-video reveal"><div class="stage-glow" aria-hidden="true"></div><div class="video-frame"><video src="/assets/flyary-story.mp4" poster="/assets/video-poster.jpg" width="1920" height="1080" controls preload="none" playsinline aria-label="${esc(c.aboutVideoPlay)}"></video><button class="video-play" type="button" hidden aria-label="${esc(c.aboutVideoPlay)}">${icon('play')}</button></div></figure>
      <a class="text-link about-link reveal" href="${signup}">${esc(c.start)} ${arrow}</a>
    </section>

    <section id="faq" class="section wrap faq-section" aria-labelledby="faq-title"><div class="faq-intro reveal"><p class="eyebrow">FAQ</p><h2 id="faq-title">${esc(c.faqTitle)}</h2><a class="text-link" href="mailto:${email}">${esc(c.contact)} ${icon('diagonal')}</a></div><div class="faq-list">${c.faqs.map(([q, a]) => `<details class="reveal"><summary>${esc(q)}<span class="faq-plus" aria-hidden="true"></span></summary><div class="faq-answer"><p>${esc(a)}</p></div></details>`).join('')}</div></section>

    <section class="final-cta" aria-labelledby="final-title"><div class="wrap"><div class="final-card reveal"><div class="final-sheen" aria-hidden="true"></div><div><h2 id="final-title">${lines(c.finalTitle)}</h2><p>${esc(c.finalNote)}</p></div><div class="final-actions"><a class="button button-white" href="${signup}">${esc(c.start)} ${arrow}</a><a class="final-link" href="${schoolMail}">${esc(c.secondary)}</a></div></div></div></section>`;
  return shell(lang, { page: '', title: c.title, description: c.description, bodyClass: 'home', main });
}

/** Pilot sign-up form. Plain HTML POST (works without JavaScript); errors come back as #status-… anchors. */
function renderSignup(lang) {
  const c = content[lang], s = c.signup;
  const optional = `<span class="optional">(${esc(s.optional)})</span>`;
  const choices = (name, type, entries, required) => `<div class="choice-row">${Object.entries(entries).map(([value, label], i) => `<label class="choice"><input type="${type}" name="${name}" value="${value}"${required && i === 0 ? ' required' : ''}><span>${esc(label)}</span></label>`).join('')}</div>`;
  const statuses = Object.entries(s.errors).map(([key, text]) => `<p id="status-${key}" class="form-status" role="alert">${esc(text)}${key === 'error' ? ` <a href="mailto:${email}">${esc(email)}</a>` : ''}</p>`).join('');
  const main = `    <section class="signup" aria-labelledby="signup-title">
      <div class="school-backdrop" aria-hidden="true"><div class="aurora aurora-2"></div><div class="aurora aurora-3"></div></div>
      <div class="wrap signup-grid">
        <div class="signup-copy">
          <p class="eyebrow reveal">${esc(s.label)}</p>
          <h1 id="signup-title" class="reveal">${esc(s.heading[0])}<br><span class="gradient-text">${esc(s.heading[1])}</span></h1>
          <p class="section-intro reveal">${esc(s.intro)}</p>
          <ul class="signup-points">${s.points.map((p) => `<li class="reveal">${icon('check')}${esc(p)}</li>`).join('')}</ul>
        </div>
        <form id="form" class="signup-card reveal" method="post" action="${waitlistEndpoint}" accept-charset="utf-8">
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
          <button class="button button-primary button-glow" type="submit">${esc(s.submit)} ${icon('arrow')}</button>
        </form>
      </div>
    </section>`;
  return shell(lang, { page: 'testpilot/', title: s.title, description: s.description, bodyClass: 'signup-page', main });
}

function renderThanks(lang) {
  const c = content[lang], t = c.thanks;
  const main = `    <section class="signup thanks" aria-labelledby="thanks-title">
      <div class="school-backdrop" aria-hidden="true"><div class="aurora aurora-2"></div><div class="aurora aurora-3"></div></div>
      <div class="wrap thanks-inner">
        <span class="thanks-icon reveal" aria-hidden="true">${icon('check')}</span>
        <p class="eyebrow reveal">${esc(t.label)}</p>
        <h1 id="thanks-title" class="reveal">${esc(t.heading[0])}<br><span class="gradient-text">${esc(t.heading[1])}</span></h1>
        <p class="section-intro reveal">${esc(t.text)}</p>
        <a class="button button-white reveal" href="/${lang}/">${esc(t.back)} ${icon('arrow')}</a>
      </div>
    </section>`;
  return shell(lang, { page: 'danke/', title: t.title, description: c.description, indexed: false, bodyClass: 'signup-page', main });
}

// Start from an empty output so removed pages (e.g. the former technical docs) do not linger.
await ensureCurrentScreenshots();
await rm(out, { recursive: true, force: true });
await mkdir(join(out, 'assets'), { recursive: true });
for (const file of ['site.css', 'site.js', 'boot.js']) await cp(join(here, file), join(out, file));
const assets = ['flyary-192.png', 'video-poster.jpg', 'flyary-story.mp4', 'overview.png', 'logbook.png', 'stats.png', 'memories.png', 'training.png', 'school-flight.png', 'cockpit.png', 'feed.png', 'plus-jakarta-sans-latin-wght-normal.woff2', 'plus-jakarta-sans-license.txt'];
const appScreens = {
  'overview.png': 'mobile/01-home.png', 'logbook.png': 'mobile/06-flightbook.png',
  'stats.png': 'mobile/12-stats.png', 'training.png': 'mobile/10-training.png',
  'memories.png': 'mobile/59-flight-memories.png', 'school-flight.png': 'mobile/20-flight-notes.png',
  'cockpit.png': 'school-mobile/34-coaching.png', 'feed.png': 'mobile/22-feed.png',
};
for (const asset of assets) await cp(appScreens[asset] ? join(here, '../docs/handbook', appScreens[asset]) : join(here, 'assets', asset), join(out, 'assets', asset));
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
