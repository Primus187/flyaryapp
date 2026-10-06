// The moving start page: a fixed stage of four painted scenes behind the content, and a paraglider that flies through all
// of them. Before each chapter the nearest layer of the scene (clouds, firs, meadow) rises and becomes the ground the text
// sits on; when the chapter leaves, the scene slides away upwards and the next one, already waiting beneath it, appears.
// Everything that changes while scrolling is a transform or an opacity, so the browser only has to move finished pictures:
// nothing is repainted, decoded or switched on in the middle of a change of scene.
// boot.js switches the page to this version (`stage-on`); this file confirms it with `stage-ready`.
(function () {
  const root = document.documentElement, stage = document.querySelector('.stage'), glider = document.querySelector('.glider');
  if (!glider) return;
  const FEET = [.447, .818];   // the point of the glider picture that is placed: the pilot's feet
  const clamp = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const ease = (t) => t * t * (3 - 2 * t);
  const place = (el, x, y, extra = '') => { el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)${extra}`; };

  // Touch devices. There the browser scrolls the page on the graphics chip, and a script can only follow. So everything
  // that has to stay in step with the text is plain page content: each chapter brings its own ground and its painted
  // upper edge (home.css). This script only moves what lies behind, where being a moment late cannot be seen: the far
  // layers of each scene, each at its own pace, and the glider. A scene is exchanged only while a chapter covers the
  // whole screen, and nothing is ever faded.
  if (root.classList.contains('touch-on')) {
    if (!stage) return;
    const REST = [null, { anchorRow: 700, anchor: .42 }, { anchorRow: 720, anchor: .40 }, { anchorRow: 715, anchor: .60 }];
    const TITLE_ROW = 748, LAND = { col: 430, row: 1250 }, MEADOW_ROW = 1400;
    const SCENE = [[.80, .30], [.30, .40], [.70, .40], [.70, .62]], CORNER = [.9, .085];
    const scenes = [...stage.querySelectorAll('.scene')].sort((a, b) => a.dataset.scene - b.dataset.scene).map((el, i) => ({
      el, layers: [...el.querySelectorAll('.ly')].map((img) => ({ el: img, crop: +img.dataset.crop, f: +img.dataset.f })).filter((l) => i === 3 || l.f < 1),
    }));
    const title = stage.querySelector('.stage-title'), footer = document.querySelector('.footer');
    const chapters = [...document.querySelectorAll('[data-chap]')];
    let W = 0, vh = 0, cw = 0, s = 1, T = [], B = [], A = [], end = 1, footH = 0, titleBottom = 0, keys = [], cur = 0, target = 0, running = false, gw = 96, gh = 96, face = 1;
    const measure = () => {
      W = stage.clientWidth; vh = stage.clientHeight;
      cw = Math.max(W, vh * .78); s = cw / 1024;
      for (const sc of scenes) for (const l of sc.layers) l.el.style.width = `${cw}px`;
      chapters.forEach((c, i) => { const r = c.getBoundingClientRect(); T[i] = r.top + scrollY; B[i] = T[i] + r.height; });
      A = [0, B[0], B[1], T[3]];   // where each scene's window on the page begins
      end = Math.max(T[3] + 1, root.scrollHeight - innerHeight);
      footH = Math.min(footer ? footer.offsetHeight : 0, vh * .6);
      titleBottom = vh / 2 + title.firstElementChild.offsetHeight / 2;
      gw = Math.max(88, Math.min(170, W * .22)); gh = gw * 636 / 640;
      glider.style.width = `${gw}px`; glider.style.transformOrigin = `${FEET[0] * 100}% ${FEET[1] * 100}%`;
      keys = [{ y: 0, p: SCENE[0], k: 1 }];
      for (let i = 0; i < 3; i++) {
        keys.push({ y: T[i] - .45 * vh, p: CORNER, k: .45 });      // the chapter has risen half way
        keys.push({ y: B[i] - .75 * vh, p: CORNER, k: .45 });      // the next scene comes into view
        keys.push({ y: B[i] + .05 * vh, p: SCENE[i + 1], k: 1 });
      }
    };
    const render = (y) => {
      let meadow = 0;
      const land = ease(clamp((y - T[3]) / (end - T[3])));
      scenes.forEach((sc, i) => {
        // On screen from one screen before its window until the chapter after it covers everything.
        const visible = (i === 3 || y < T[i]) && (i === 0 || y > T[i - 1] - vh);
        if (sc.el.hidden === visible) sc.el.hidden = !visible;
        if (!sc.loaded && (i < 2 || y > T[i - 2] - vh)) { sc.loaded = true; for (const l of sc.layers) { l.el.loading = 'eager'; l.el.decode?.().catch(() => {}); } }
        if (!visible) return;
        const base = Math.min(0, i === 0 ? titleBottom - TITLE_ROW * s : REST[i].anchor * vh - REST[i].anchorRow * s);
        const rel = y - A[i];
        // Before its window is fully open the scene settles from a little lower, the far layers from furthest down;
        // afterwards the nearer a layer, the faster it follows the page. Far layers only ever sink behind near ones.
        const shift = (f) => (rel < 0 ? -rel * .12 * (1.5 - .5 * f) : -rel * .5 * f);
        // The valley scene starts low, so that the closing lines rise through open sky before the lake comes up.
        const pan = i === 3 ? Math.max(0, MEADOW_ROW * s + base - (vh - footH)) * land : 0;   // down to the meadow above the footer
        for (const l of sc.layers) place(l.el, (W - cw) / 2, base + l.crop * s + (i === 3 ? (rel < 0 ? shift(l.f) - rel * .45 : 0) - pan * l.f : shift(l.f)));
        if (i === 0) place(title, 0, base + TITLE_ROW * s + shift(.4));
        if (i === 3) meadow = base - pan;
      });
      let n = 0; while (n < keys.length - 2 && y > keys[n + 1].y) n++;
      const a = keys[n], b = keys[n + 1], u = ease(clamp((y - a.y) / Math.max(1, b.y - a.y)));
      let px = (a.p[0] + (b.p[0] - a.p[0]) * u) * W, py = (a.p[1] + (b.p[1] - a.p[1]) * u) * vh + Math.sin(y / 170) * 5 * (1 - land), k = a.k + (b.k - a.k) * u;
      let heading = u > 0 && u < 1 && Math.abs(b.p[0] - a.p[0]) > .05 ? (b.p[0] < a.p[0] ? 1 : -1) : 0;   // the picture faces left
      if (land > 0) {
        const lx = W / 2 + (LAND.col - 512) * s, ly = meadow + LAND.row * s;
        px += (lx - px) * land; py += (ly - py) * land; k += (.62 - k) * land; heading = lx < px ? 1 : -1;
      }
      if (heading) face += (heading - face) * .12;
      const turn = face < 0 ? Math.min(face, -.25) : Math.max(face, .25);
      place(glider, px - FEET[0] * gw, py - FEET[1] * gh, ` scale(${(k * turn).toFixed(3)},${k.toFixed(3)})`);
      return heading !== 0 && Math.abs(heading - face) > .02;
    };
    const frame = () => {
      cur += (target - cur) * .3;
      if (Math.abs(target - cur) < .4) cur = target;
      const turning = render(cur);
      if (cur !== target || turning) requestAnimationFrame(frame); else running = false;
    };
    const follow = () => { target = Math.max(0, scrollY); if (!running) { running = true; requestAnimationFrame(frame); } };
    let width = 0;
    const setup = () => { if (root.clientWidth === width) return; width = root.clientWidth; measure(); follow(); };   // the address bar sliding away is not a resize
    addEventListener('scroll', follow, { passive: true });
    addEventListener('resize', setup);
    addEventListener('load', () => { measure(); follow(); });
    if ('ResizeObserver' in window) new ResizeObserver(() => { measure(); follow(); }).observe(document.querySelector('main'));
    setup(); cur = target = Math.max(0, scrollY); render(cur);
    root.classList.add('stage-ready');
    return;
  }
  if (!root.classList.contains('stage-on') || !stage) return;

  // All rows are rows of the painted scene at a width of 1024.
  // anchorRow sits at `anchor` of the window height while the scene is at rest. For the first three scenes the nearest
  // layer then rises until coverRow reaches `target`; below the `ground` rows the painting fades into the plain ground colour.
  const CFG = [
    { coverRow: 1200, target: .17, ground: [1270, 1480], rgb: '233,235,245' },   // placed by its title, see TITLE_ROW
    { anchorRow: 700, anchor: .42, coverRow: 1130, target: .20, ground: [1190, 1340], rgb: '20,38,42' },
    { anchorRow: 720, anchor: .40, coverRow: 1345, target: .10, ground: [1310, 1510], rgb: '44,74,53' },
    { anchorRow: 715, anchor: .60, panRow: 1400 },
  ];
  // The glider's flight, as shares of window width and height. In each open scene it hangs at VIEW; while a chapter is on
  // screen it soars along the strip of scenery above it, from STRIP[i][0] to STRIP[i][1]; at the end it lands on LAND in
  // the valley scene.
  const VIEW = [[.88, .36], [.30, .40], [.72, .40], [.30, .34]];
  const STRIP = [[[.82, .15], [.40, .16]], [[.22, .16], [.66, .15]], [[.80, .15], [.38, .16]]];
  const LAND = { col: 430, row: 1250 };
  // The name stands in the middle of the first screen; the summit scene is placed so that this row of the painting meets
  // the lower edge of the name, which puts the snow ridge in front of its feet.
  const TITLE_ROW = 748;

  const scenes = [...stage.querySelectorAll('.scene')].sort((a, b) => a.dataset.scene - b.dataset.scene).map((el, i) => ({
    el, c: CFG[i], ground: el.querySelector('.groundfill'),
    layers: [...el.querySelectorAll('.ly')].map((img) => ({ el: img, crop: +img.dataset.crop, f: +img.dataset.f })),
  }));
  const title = stage.querySelector('.stage-title'), footer = document.querySelector('.footer');
  const chapters = [...document.querySelectorAll('[data-chap]')];
  const fades = chapters.map((c) => c.querySelector('[data-fade]'));
  let W, vh, cw, s, footH = 0, titleBottom = 0, T = [], B = [], fadeTop = [], keys = [], cur = 0, target = 0, running = false, gw = 120, gh = 120, face = 1;

  function measure() {
    W = stage.clientWidth; vh = stage.clientHeight;
    cw = Math.max(W, vh * .78); s = cw / 1024;   // a scene is never narrower than the window, nor so small that it ends above the fold
    for (const sc of scenes) {
      for (const l of sc.layers) l.el.style.width = `${cw}px`;
      if (sc.ground) sc.ground.style.background = `linear-gradient(rgba(${sc.c.rgb},0) 0, rgb(${sc.c.rgb}) ${((sc.c.ground[1] - sc.c.ground[0]) * s).toFixed(0)}px)`;
    }
    chapters.forEach((c, i) => { const r = c.getBoundingClientRect(); T[i] = r.top + scrollY; B[i] = T[i] + r.height; fadeTop[i] = fades[i].getBoundingClientRect().top - r.top; });
    titleBottom = vh / 2 + title.firstElementChild.offsetHeight / 2;
    footH = Math.min(footer ? footer.offsetHeight : 0, vh * .4);   // the valley scene ends above the footer
    gw = Math.max(96, Math.min(210, W * .14)); gh = gw * 636 / 640;
    glider.style.width = `${gw}px`;
    glider.style.transformOrigin = `${FEET[0] * 100}% ${FEET[1] * 100}%`;
    // Flight plan: scroll position -> place and size. Between two entries the glider glides smoothly.
    keys = [{ y: 0, p: VIEW[0], k: 1 }];
    for (let i = 0; i < 3; i++) {
      keys.push({ y: T[i] - .40 * vh, p: STRIP[i][0], k: .72 });   // its ground has risen: up into the strip
      keys.push({ y: B[i] - .30 * vh, p: STRIP[i][1], k: .72 });   // has crossed the strip while the chapter was read
      keys.push({ y: B[i] + .45 * vh, p: VIEW[i + 1], k: 1 });     // down into the next scene
    }
  }

  function render(y) {
    const rise = [], q = [], ql = [], near = [];
    for (let i = 0; i < 3; i++) {
      near[i] = T[i] - y < 2.2 * vh;   // its chapter is about one screen away
      rise[i] = ease(clamp((1.0 * vh - (T[i] - y)) / (.6 * vh)));
      // A scene gives way to the next only when the end of its chapter has reached the upper third of the window,
      // over about one window height.
      ql[i] = clamp((.30 * vh - (B[i] - y)) / (1.05 * vh));
      q[i] = ease(ql[i]);
    }
    const pan = ease(clamp((y - (T[3] - .15 * vh)) / Math.max(1, B[3] - T[3] - .85 * vh)));
    const x0 = (W - cw) / 2;
    let meadow = 0;
    scenes.forEach((sc, i) => {
      // A scene is switched on long before it is seen: as soon as the chapter above it comes near, it lies finished
      // beneath the scene in front. Its pictures are fetched and decoded one chapter earlier still.
      const c = sc.c, visible = (i === 0 || near[i - 1]) && (i === 3 || ql[i] < 1);
      if (sc.el.hidden === visible) sc.el.hidden = !visible;
      if (!sc.loaded && (i < 2 || near[i - 2])) {
        sc.loaded = true;
        for (const l of sc.layers) { l.el.loading = 'eager'; l.el.decode?.().catch(() => {}); }
      }
      if (!visible) return;
      // The painting never starts below the top of the window, so on tall narrow screens the name sits a little higher.
      const base = i === 0 ? Math.min(0, titleBottom - TITLE_ROW * s) : c.anchor * vh - c.anchorRow * s;
      const D = i < 3 ? c.coverRow * s + base - c.target * vh : Math.max(0, c.panRow * s + base - (vh - footH));
      const t = i < 3 ? rise[i] : pan;
      // While it appears, a scene drifts up into place from a little lower, the far layers from furthest down,
      // so the change reads as one continuous descent and far layers only ever sink behind near ones.
      const intro = i > 0 ? 1 - q[i - 1] : 0, drop = intro * Math.min(.16 * vh, Math.max(0, -base) / 1.5);
      for (const l of sc.layers) place(l.el, x0, base + l.crop * s - D * l.f * t + drop * (1.5 - .5 * l.f));
      const coverY = base - D * t + drop;
      if (sc.ground) place(sc.ground, 0, coverY + c.ground[0] * s);
      if (i === 3) meadow = coverY;
      if (i === 0) { place(title, 0, base + TITLE_ROW * s - D * .3 * t); title.style.opacity = (1 - clamp(rise[0] * 2.4)).toFixed(3); }
      // The leaving scene slides away upwards. Its lower edge is soft (a fixed mask in home.css, below the window while
      // the scene is at rest), so the next scene appears through a haze instead of along a line.
      place(sc.el, 0, i < 3 ? -q[i] * 1.5 * vh : 0);
    });

    // Content appears once its ground has risen and leaves early in the change of scene. It dissolves before it
    // scrolls up into the strip of scenery, which belongs to the landscape and the glider (only the small gradient
    // of the mask changes; the text itself is not painted again).
    for (let i = 0; i < 3; i++) {
      fades[i].style.opacity = (clamp((rise[i] - .2) / .3) * (1 - clamp((ql[i] - .2) / .4))).toFixed(3);
      const cut = Math.round(.18 * vh - (T[i] + fadeTop[i] - scrollY));
      const mask = cut > -.1 * vh ? `linear-gradient(to bottom, transparent ${cut}px, #000 ${cut + Math.round(.09 * vh)}px)` : '';
      if (fades[i].mask !== mask) { fades[i].mask = mask; fades[i].style.webkitMaskImage = mask; fades[i].style.maskImage = mask; }
    }
    fades[3].style.opacity = clamp((ql[2] - .6) / .35).toFixed(3);

    // The glider is always on screen: it follows its flight plan and finally lands.
    let n = 0; while (n < keys.length - 2 && y > keys[n + 1].y) n++;
    const a = keys[n], b = keys[n + 1], u = ease(clamp((y - a.y) / Math.max(1, b.y - a.y)));
    let px = (a.p[0] + (b.p[0] - a.p[0]) * u) * W, py = (a.p[1] + (b.p[1] - a.p[1]) * u) * vh + Math.sin(y / 170) * 7, k = a.k + (b.k - a.k) * u;
    let heading = u > 0 && u < 1 && Math.abs(b.p[0] - a.p[0]) > .05 ? (b.p[0] < a.p[0] ? 1 : -1) : 0;   // the picture faces left
    if (pan > 0) {
      const lx = W / 2 + (LAND.col - 512) * s, ly = meadow + LAND.row * s;
      px += (lx - px) * pan; py += (ly - py) * pan; k += (.6 - k) * pan; heading = lx < px ? 1 : -1;
    }
    if (heading) face += (heading - face) * .12;   // turns by swinging round, not by flipping
    const turn = face < 0 ? Math.min(face, -.25) : Math.max(face, .25);
    place(glider, px - FEET[0] * gw, py - FEET[1] * gh, ` scale(${(k * turn).toFixed(3)},${k.toFixed(3)}) rotate(${(Math.sin(y / 260) * 3 * (1 - pan)).toFixed(2)}deg)`);
    return heading !== 0 && Math.abs(heading - face) > .02;
  }

  // The stage follows the scroll position with some inertia, which is what makes the layers feel fluid.
  function frame() {
    cur += (target - cur) * .1;
    if (Math.abs(target - cur) < .4) cur = target;
    const turning = render(cur);
    if (cur !== target || turning) requestAnimationFrame(frame); else running = false;
  }
  function follow() { target = Math.max(0, scrollY); if (!running) { running = true; requestAnimationFrame(frame); } }
  function setup() { measure(); target = cur = Math.max(0, scrollY); render(cur); }
  addEventListener('scroll', follow, { passive: true });
  addEventListener('resize', setup);
  addEventListener('load', setup);
  // Opening a question or switching a tab changes the chapter heights.
  if ('ResizeObserver' in window) new ResizeObserver(() => { measure(); follow(); }).observe(document.querySelector('main'));
  setup();
  root.classList.add('stage-ready');
})();
