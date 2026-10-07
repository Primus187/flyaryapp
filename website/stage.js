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
  // How far the name has sunk: starts gently and then keeps going at a steady pace, so it never comes to rest in view.
  const sinking = (u) => (u <= .5 ? 2 * u * u : 2 * u - .5);
  // Where the claim stands above the name (narrow screens) it goes behind the ridge together with it.
  function orderClaim(title, claim, above) {
    if (!claim.home) claim.home = claim.nextSibling;
    if (above) title.after(claim); else if (claim.previousSibling === title) claim.home.before(claim);
  }
  const place = (el, x, y, extra = '') => { el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)${extra}`; };

  // The glider's flight depends on the scroll position alone: it moves only while the page moves.
  // On the first screen it hangs at the right and heads left. From then on it alternates: in each open scene it comes in
  // from one edge, crosses the picture large and in front, and climbs into the band above the next chapter; while that
  // chapter is read it keeps flying across and leaves at the far edge. It turns round out of sight and enters the next
  // scene from that side. Positions are shares of the window; c holds the sizes and heights of one version of the page.
  function flightPlan(T, B, vh, c) {
    const OUT = .16, edge = (d) => (d > 0 ? 1 + OUT : -OUT);   // where it is out of sight when flying in direction d
    const keys = [{ y: 0, x: c.start[0], h: c.start[1], k: 1 }];
    let dir = -1;
    for (let i = 0; i < 3; i++) {
      const a = i === 0 ? 0 : B[i - 1] - c.lead * vh, b = T[i] - c.rise * vh;   // the open scene before chapter i
      if (i > 0) keys.push({ y: a, x: edge(-dir), h: c.enter, k: 1 });
      const from = keys[keys.length - 1].x, to = .5 + dir * .2;
      keys.push({ y: (a + b) / 2, x: (from + to) / 2, h: i === 0 ? c.heroFront : c.front, k: c.peak });   // large, in front (on the first screen above the name)
      keys.push({ y: b, x: to, h: c.arrive[0], k: c.arrive[1] });                  // up above the chapter, still large
      keys.push({ y: B[i] - (c.lead + .25) * vh, x: edge(dir), h: c.band, k: c.small });   // across, getting a little smaller, and out of sight
      dir = -dir;
    }
    // The last open scene: in from the left edge, large, to where the landing approach begins (beside the closing lines).
    const f = c.final, a = B[2] - c.lead * vh, b = T[3] + f.end * vh;   // there before the closing lines scroll in
    keys.push({ y: a, x: edge(-dir), h: f.enter, k: 1 });
    keys.push({ y: (a + b) / 2, x: f.midX, h: f.midH, k: f.midK });
    keys.push({ y: b, x: f.x, h: f.h, k: f.k });
    return keys;
  }
  // Where the glider is at scroll position y: [x, height, size, heading] with heading 1 = flying left.
  function flightAt(keys, y) {
    let n = 0; while (n < keys.length - 2 && y > keys[n + 1].y) n++;
    const a = keys[n], b = keys[n + 1], u = clamp((y - a.y) / Math.max(1, b.y - a.y)), e = ease(u);
    return [a.x + (b.x - a.x) * u, a.h + (b.h - a.h) * e, a.k + (b.k - a.k) * e, b.x < a.x ? 1 : -1];
  }
  // The picture faces left; it is mirrored when the glider flies right. Every turn happens out of sight.
  function drawGlider(px, py, k, heading, gw, gh, tilt) {
    place(glider, px - FEET[0] * gw, py - FEET[1] * gh, ` scale(${(k * heading).toFixed(3)},${k.toFixed(3)}) rotate(${tilt.toFixed(2)}deg)`);
  }

  // Touch devices. There the browser scrolls the page on the graphics chip, and a script can only follow. So everything
  // that has to stay in step with the text is plain page content: each chapter brings its own ground and its painted
  // upper edge (home.css). This script only moves what lies behind, where being a moment late cannot be seen: the far
  // layers of each scene, each at its own pace, and the glider. A scene is exchanged only while a chapter covers the
  // whole screen, and nothing is ever faded.
  if (root.classList.contains('touch-on')) {
    if (!stage) return;
    const REST = [null, { anchorRow: 700, anchor: .42 }, { anchorRow: 720, anchor: .40 }, { anchorRow: 715, anchor: .60 }];
    const TITLE_ROW = 748, CLAIM_ROW = 838, RISE_ROWS = 48, LAND = { col: 500, row: 1235 }, MEADOW_ROW = 1400;   // it lands beside the windsock, flying right, into the wind
    const FLY = { start: [.80, .30], lead: .75, rise: .45, enter: .34, heroFront: .22, front: .42, peak: 1.5, arrive: [.14, .9], band: .11, small: .7, final: { x: .30, midX: .07, end: .1, enter: .70, h: .72, k: 1.1, midH: .71, midK: 1.1 } };
    const scenes = [...stage.querySelectorAll('.scene')].sort((a, b) => a.dataset.scene - b.dataset.scene).map((el, i) => ({
      el, layers: [...el.querySelectorAll('.ly')].map((img) => ({ el: img, crop: +img.dataset.crop, f: +img.dataset.f })).filter((l) => i === 3 || l.f < 1),
    }));
    const title = stage.querySelector('.stage-title'), claim = stage.querySelector('.stage-claim'), footer = document.querySelector('.footer');
    const chapters = [...document.querySelectorAll('[data-chap]')];
    let W = 0, vh = 0, cw = 0, s = 1, T = [], B = [], A = [], end = 1, footH = 0, titleBottom = 0, brandH = 0, claimH = 0, above = false, keys = [], cur = 0, target = 0, running = false, meadow = 0, gw = 96, gh = 96;
    const measure = () => {
      W = stage.clientWidth; vh = stage.clientHeight;
      cw = Math.max(W, vh * .78); s = cw / 1024;
      for (const sc of scenes) for (const l of sc.layers) l.el.style.width = `${cw}px`;
      chapters.forEach((c, i) => { const r = c.getBoundingClientRect(); T[i] = r.top + scrollY; B[i] = T[i] + r.height; });
      A = [0, B[0], B[1], T[3]];   // where each scene's window on the page begins
      end = Math.max(T[3] + 1, root.scrollHeight - innerHeight);
      footH = Math.min(footer ? footer.offsetHeight : 0, vh * .6);
      brandH = title.firstElementChild.offsetHeight; claimH = claim.offsetHeight; above = W <= 640;   // on narrow screens the claim stands above the name
      orderClaim(title, claim, above);
      titleBottom = vh / 2 + brandH / 2;
      gw = Math.max(88, Math.min(170, W * .22)); gh = gw * 636 / 640;
      glider.style.width = `${gw}px`; glider.style.transformOrigin = `${FEET[0] * 100}% ${FEET[1] * 100}%`;
      keys = flightPlan(T, B, vh, FLY);
    };
    const landing = (y) => ease(clamp((y - T[3]) / (end - T[3])));
    const render = (y) => {
      const land = landing(y);
      // Read by soundscape.js; audio follows the same scene switches as the painting.
      const scene = T.slice(0, 3).filter((top) => y >= top).length;
      window.flyaryFlightState = { y, weights: [0, 1, 2, 3].map((i) => i === scene ? 1 : 0), landing: land };
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
        if (i === 0) {
          // The name starts clear above the ridge and keeps sinking behind it until it is gone and the clouds close over it.
          const sunk = (RISE_ROWS * s + brandH * .6) * sinking(y / (.6 * vh)), ty = base + (TITLE_ROW - RISE_ROWS) * s + shift(.44) + sunk;
          place(title, 0, ty);
          place(claim, 0, above ? ty - brandH - claimH / 2 : base + CLAIM_ROW * s + shift(.44) + sunk * .5);   // below the name it sinks into the clouds
        }
        if (i === 3) meadow = base - pan;
      });
    };
    const glide = (y) => {
      const land = landing(y);
      let [fx, fy, k, heading] = flightAt(keys, y);
      let px = fx * W, py = fy * vh + Math.sin(y / 170) * 5 * (1 - land);
      if (land > 0) {
        const lx = W / 2 + (LAND.col - 512) * s, ly = meadow + LAND.row * s;
        px += (lx - px) * land; py += (ly - py) * land; k += (.95 - k) * land;
      }
      drawGlider(px, py, k, heading, gw, gh, 0);
    };
    const frame = () => {
      cur += (target - cur) * .3;
      if (Math.abs(target - cur) < .4) cur = target;
      render(cur); glide(cur);
      if (cur !== target) requestAnimationFrame(frame); else running = false;
    };
    const follow = () => { target = Math.max(0, scrollY); if (!running) { running = true; requestAnimationFrame(frame); } };
    const refresh = () => { measure(); render(cur); glide(cur); follow(); };
    let width = 0;
    const setup = () => { if (root.clientWidth === width) return; width = root.clientWidth; refresh(); };   // the address bar sliding away is not a resize
    addEventListener('scroll', follow, { passive: true });
    addEventListener('resize', setup);
    addEventListener('load', refresh);
    if ('ResizeObserver' in window) new ResizeObserver(refresh).observe(document.querySelector('main'));
    setup(); cur = target = Math.max(0, scrollY); render(cur); glide(cur);
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
  const FLY = { start: [.88, .36], lead: .3, rise: .4, enter: .30, heroFront: .28, front: .42, peak: 1.6, arrive: [.2, 1], band: .15, small: .8, final: { x: .15, midX: .07, end: -.85, enter: .30, h: .46, k: 1.2, midH: .42, midK: 1.4 } };   // the glider's flight, see flightPlan
  const LAND = { col: 500, row: 1235 };   // it lands beside the windsock, flying right, into the wind
  // The name stands in the middle of the first screen; the summit scene is placed so that this row of the painting meets
  // the lower edge of the name, which puts the snow ridge in front of its feet.
  const TITLE_ROW = 748, CLAIM_ROW = 838, RISE_ROWS = 48;   // the claim lies on the snow below the name and moves with the ridge

  const scenes = [...stage.querySelectorAll('.scene')].sort((a, b) => a.dataset.scene - b.dataset.scene).map((el, i) => ({
    el, c: CFG[i], ground: el.querySelector('.groundfill'),
    layers: [...el.querySelectorAll('.ly')].map((img) => ({ el: img, crop: +img.dataset.crop, f: +img.dataset.f })),
  }));
  const title = stage.querySelector('.stage-title'), claim = stage.querySelector('.stage-claim'), footer = document.querySelector('.footer');
  const chapters = [...document.querySelectorAll('[data-chap]')];
  const fades = chapters.map((c) => c.querySelector('[data-fade]'));
  let W, vh, cw, s, footH = 0, titleBottom = 0, T = [], B = [], fadeTop = [], brandH = 0, claimH = 0, above = false, keys = [], cur = 0, target = 0, running = false, meadow = 0, pan = 0, gw = 120, gh = 120;

  function measure() {
    W = stage.clientWidth; vh = stage.clientHeight;
    cw = Math.max(W, vh * .78); s = cw / 1024;   // a scene is never narrower than the window, nor so small that it ends above the fold
    for (const sc of scenes) {
      for (const l of sc.layers) l.el.style.width = `${cw}px`;
      if (sc.ground) sc.ground.style.background = `linear-gradient(rgba(${sc.c.rgb},0) 0, rgb(${sc.c.rgb}) ${((sc.c.ground[1] - sc.c.ground[0]) * s).toFixed(0)}px)`;
    }
    chapters.forEach((c, i) => { const r = c.getBoundingClientRect(); T[i] = r.top + scrollY; B[i] = T[i] + r.height; fadeTop[i] = fades[i].getBoundingClientRect().top - r.top; });
    brandH = title.firstElementChild.offsetHeight; claimH = claim.offsetHeight; above = W <= 640;   // on narrow screens the claim stands above the name
    orderClaim(title, claim, above);
    titleBottom = vh / 2 + brandH / 2;
    footH = Math.min(footer ? footer.offsetHeight : 0, vh * .4);   // the valley scene ends above the footer
    gw = Math.max(96, Math.min(210, W * .14)); gh = gw * 636 / 640;
    glider.style.width = `${gw}px`;
    glider.style.transformOrigin = `${FEET[0] * 100}% ${FEET[1] * 100}%`;
    keys = flightPlan(T, B, vh, FLY);
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
    pan = ease(clamp((y - (T[3] - .15 * vh)) / Math.max(1, B[3] - T[3] - .85 * vh)));
    window.flyaryFlightState = { y, weights: [1 - q[0], q[0] * (1 - q[1]), q[1] * (1 - q[2]), q[2]], landing: pan };
    const x0 = (W - cw) / 2;
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
      if (i === 0) {
        // The name starts clear above the ridge and keeps sinking behind it until it is gone; the claim below it sinks
        // into the rising clouds.
        const sunk = (RISE_ROWS * s + brandH * .6) * sinking(y / (.55 * vh)), ty = base + (TITLE_ROW - RISE_ROWS) * s + sunk - D * .3 * t;
        place(title, 0, ty);
        place(claim, 0, above ? ty - brandH - claimH / 2 : base + CLAIM_ROW * s - D * .44 * t + sunk * .5);
        title.style.opacity = claim.style.opacity = (1 - clamp((rise[0] - .8) * 5)).toFixed(3);   // by then the ridge and the clouds hide them
      }
      // The leaving scene slides away upwards. Its lower edge is soft (a fixed mask in home.css, below the window while
      // the scene is at rest), so the next scene appears through a haze instead of along a line.
      place(sc.el, 0, i < 3 ? -q[i] * 1.5 * vh : 0);
    });

    // Content appears once its ground has risen and leaves early in the change of scene. It stays whole almost to
    // the top of the window, so that a chapter taller than the window can be read completely, and only dissolves
    // along the very edge (only the small gradient of the mask changes; the text itself is not painted again).
    for (let i = 0; i < 3; i++) {
      fades[i].style.opacity = (clamp((rise[i] - .2) / .3) * (1 - clamp((ql[i] - .2) / .4))).toFixed(3);
      const cut = Math.round(.02 * vh - (T[i] + fadeTop[i] - scrollY));
      const mask = cut > -.08 * vh ? `linear-gradient(to bottom, transparent ${cut}px, #000 ${cut + Math.round(.06 * vh)}px)` : '';
      if (fades[i].mask !== mask) { fades[i].mask = mask; fades[i].style.webkitMaskImage = mask; fades[i].style.maskImage = mask; }
    }
    fades[3].style.opacity = clamp((ql[2] - .6) / .35).toFixed(3);
  }

  function glide(y) {
    let [fx, fy, k, heading] = flightAt(keys, y);
    let px = fx * W, py = fy * vh + Math.sin(y / 170) * 7 * (1 - pan);
    if (pan > 0) {
      const lx = W / 2 + (LAND.col - 512) * s, ly = meadow + LAND.row * s;
      px += (lx - px) * pan; py += (ly - py) * pan; k += (1 - k) * pan;
    }
    drawGlider(px, py, k, heading, gw, gh, Math.sin(y / 260) * 3 * (1 - pan));
  }

  // The stage follows the scroll position with some inertia, which is what makes the layers feel fluid.
  function frame() {
    cur += (target - cur) * .1;
    if (Math.abs(target - cur) < .4) cur = target;
    render(cur); glide(cur);
    if (cur !== target) requestAnimationFrame(frame); else running = false;
  }
  function follow() { target = Math.max(0, scrollY); if (!running) { running = true; requestAnimationFrame(frame); } }
  function setup() { measure(); target = cur = Math.max(0, scrollY); render(cur); glide(cur); }
  addEventListener('scroll', follow, { passive: true });
  addEventListener('resize', setup);
  addEventListener('load', setup);
  // Opening a question or switching a tab changes the chapter heights.
  if ('ResizeObserver' in window) new ResizeObserver(() => { measure(); render(cur); glide(cur); follow(); }).observe(document.querySelector('main'));
  setup();
  root.classList.add('stage-ready');
})();
