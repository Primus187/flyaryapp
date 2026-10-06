// Progressive enhancement: content, FAQ and navigation work without JavaScript; motion respects the
// visitor's "reduce motion" setting (the CSS keeps everything visible then).
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

const menuButton = document.querySelector('.menu-toggle');
const menu = document.querySelector('#mobile-nav');
function closeMenu(restoreFocus = false) {
  menu.hidden = true;
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.setAttribute('aria-label', menuButton.dataset.openLabel);
  if (restoreFocus) menuButton.focus();
}
if (menuButton && menu) {
  menuButton.hidden = false;
  menuButton.addEventListener('click', () => {
    const opening = menu.hidden;
    menu.hidden = !opening;
    menuButton.setAttribute('aria-expanded', String(opening));
    menuButton.setAttribute('aria-label', opening ? menuButton.dataset.closeLabel : menuButton.dataset.openLabel);
  });
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) closeMenu(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) closeMenu(true); });
  document.addEventListener('click', (e) => { if (!menu.hidden && !e.target.closest('.header')) closeMenu(); });
  matchMedia('(min-width: 1001px)').addEventListener('change', (e) => { if (e.matches) closeMenu(); });
}

// Header turns into frosted glass once the page scrolls away from the top.
const header = document.querySelector('.header');
if (header) {
  // On the start page it also moves out of the way while reading down and returns when scrolling up.
  const home = document.body.classList.contains('home');
  let last = scrollY;
  const update = () => {
    const open = menu && !menu.hidden;
    header.classList.toggle('is-scrolled', scrollY > 24 || open);
    if (home) header.classList.toggle('is-away', !open && scrollY > 240 && scrollY > last && !header.contains(document.activeElement));
    last = scrollY;
  };
  addEventListener('scroll', update, { passive: true });
  header.addEventListener('focusin', () => header.classList.remove('is-away'));
  menuButton?.addEventListener('click', update);
  update();
}

const tabs = [...document.querySelectorAll('.preview-tab')];
const panels = [...document.querySelectorAll('.preview-panel')];
const image = document.querySelector('#preview-image');
if (tabs.length && panels.length === tabs.length && image) {
  document.querySelector('.preview-tabs').setAttribute('role', 'tablist');
  tabs.forEach((tab, i) => {
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', panels[i].id);
    panels[i].setAttribute('role', 'tabpanel');
    panels[i].setAttribute('aria-labelledby', tab.id);
    panels[i].tabIndex = 0;
    tab.addEventListener('click', (e) => { e.preventDefault(); select(i, true); });
    tab.addEventListener('keydown', (e) => {
      const next = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? (i + 1) % tabs.length
        : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? (i + tabs.length - 1) % tabs.length
          : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : null;
      if (next !== null) { e.preventDefault(); select(next, true); tabs[next].focus(); }
    });
  });
  let swap;
  function select(index, link = false) {
    tabs.forEach((tab, i) => {
      tab.setAttribute('aria-selected', String(i === index));
      tab.tabIndex = i === index ? 0 : -1;
      panels[i].hidden = i !== index;
    });
    // Keep the chosen tab in the URL so it can be shared; no history entry per tab.
    if (link) history.replaceState(null, '', `#${panels[index].id}`);
    const src = tabs[index].dataset.src;
    const alt = tabs[index].dataset.alt;
    if (image.getAttribute('src') === src) return;
    clearTimeout(swap);
    if (reduceMotion.matches) { image.src = src; image.alt = alt; return; }
    // Cross-fade: fade out, switch the screen, fade back in once it is decoded.
    image.classList.add('is-swapping');
    swap = setTimeout(() => {
      image.src = src; image.alt = alt;
      const show = () => image.classList.remove('is-swapping');
      image.decode().then(show, show);
    }, 180);
  }
  const linkedPanel = panels.findIndex((p) => `#${p.id}` === location.hash);
  select(linkedPanel < 0 ? 0 : linkedPanel);
  document.querySelector('#app').classList.add('enhanced');
}

// Keep the section when visitors change language; language choice is in the URL, not a cookie.
document.querySelectorAll('.languages a').forEach((link) => {
  link.addEventListener('click', () => {
    if (['#schools', '#app', '#about', '#faq'].includes(location.hash) || /^#preview-\d$/.test(location.hash)) link.hash = location.hash;
  });
});

// Pilot sign-up: when the page was opened, so the server can reject bots that submit instantly.
const started = document.querySelector('#form input[name="started"]');
if (started) started.value = String(Date.now());
// A server-side error comes back as #status-…; move focus there so it is announced and in view.
// (The message is not focusable yet while this script runs, so focus waits for load.)
const formStatus = document.getElementById(location.hash.slice(1));
if (formStatus?.classList.contains('form-status')) {
  formStatus.tabIndex = -1;
  addEventListener('load', () => formStatus.focus());
}

// Reveal on scroll, staggered within each group of siblings.
const reveals = [...document.querySelectorAll('.reveal')];
if (reveals.length) {
  const groups = new Map();
  for (const el of reveals) {
    const list = groups.get(el.parentElement) || [];
    el.style.setProperty('--d', `${Math.min(list.length, 6) * 0.08}s`);
    list.push(el);
    groups.set(el.parentElement, list);
  }
  if ('IntersectionObserver' in window && !reduceMotion.matches) {
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('is-visible'));
  }
}

// The about video shows a large play button on its poster; native controls take over once it plays.
document.querySelectorAll('.video-frame').forEach((frame) => {
  const video = frame.querySelector('video');
  const play = frame.querySelector('.video-play');
  if (!video || !play) return;
  play.hidden = false;
  play.addEventListener('click', () => { video.play(); video.focus(); });
  video.addEventListener('play', () => { play.hidden = true; });
});
