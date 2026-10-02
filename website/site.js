// Progressive enhancement: content, FAQ and navigation work without JavaScript; motion respects the
// visitor's "reduce motion" setting (the CSS keeps everything visible then).
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = matchMedia('(hover: hover) and (pointer: fine)');

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

// Header turns into frosted glass once the page scrolls away from the hero.
const header = document.querySelector('.header');
if (header) {
  const update = () => header.classList.toggle('is-scrolled', scrollY > 24 || (menu && !menu.hidden));
  addEventListener('scroll', update, { passive: true });
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
    tab.addEventListener('click', (e) => { e.preventDefault(); select(i); });
    tab.addEventListener('keydown', (e) => {
      const next = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? (i + 1) % tabs.length
        : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? (i + tabs.length - 1) % tabs.length
          : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : null;
      if (next !== null) { e.preventDefault(); select(next); tabs[next].focus(); }
    });
  });
  let swap;
  function select(index) {
    tabs.forEach((tab, i) => {
      tab.setAttribute('aria-selected', String(i === index));
      tab.tabIndex = i === index ? 0 : -1;
      panels[i].hidden = i !== index;
    });
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
    if (['#pilots', '#schools', '#app', '#about', '#faq'].includes(location.hash)) link.hash = location.hash;
  });
});

// Pilot sign-up: when the page was opened, so the server can reject bots that submit instantly.
const started = document.querySelector('#form input[name="started"]');
if (started) started.value = String(Date.now());

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

// Phones tilt gently towards the pointer; cards get a soft light that follows it.
if (finePointer.matches && !reduceMotion.matches) {
  document.querySelectorAll('[data-tilt]').forEach((el) => {
    let frame;
    el.addEventListener('pointermove', (e) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        el.style.setProperty('--ry', `${(x * 10).toFixed(2)}deg`);
        el.style.setProperty('--rx', `${(-y * 8).toFixed(2)}deg`);
      });
    });
    el.addEventListener('pointerleave', () => { el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); });
  });
  document.querySelectorAll('[data-glow]').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  });
}

// The about video loads YouTube's privacy-enhanced player only after the visitor clicks the poster.
document.querySelectorAll('.video-frame[data-video]').forEach((link) => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const frame = document.createElement('iframe');
    frame.src = `https://www.youtube-nocookie.com/embed/${link.dataset.video}?autoplay=1&rel=0`;
    frame.title = link.getAttribute('aria-label');
    frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    frame.allowFullscreen = true;
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    const box = document.createElement('div');
    box.className = 'video-frame';
    box.append(frame);
    link.replaceWith(box);
    frame.focus();
  });
});
