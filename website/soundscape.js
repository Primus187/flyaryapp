// Optional, local-only soundscape. No requests or AudioContext until the visitor opts in.
(() => {
  if (!document.body.classList.contains('home') || !window.AudioContext) return;
  const labels = {
    de: ['Flug mit Ton erleben', 'Ton ausschalten', 'Ton wird geladen …', 'Ton nicht verfügbar – erneut versuchen'],
    fr: ['Vivre le vol avec le son', 'Couper le son', 'Chargement du son …', 'Son indisponible – réessayer'],
    en: ['Experience the flight with sound', 'Turn sound off', 'Loading sound …', 'Sound unavailable – retry'],
  }[document.documentElement.lang] || ['Sound on', 'Sound off', 'Loading …', 'Sound unavailable – retry'];
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'sound-toggle';
  button.setAttribute('aria-pressed', 'false');
  button.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M11 4 5 9H2v6h3l6 5V4Z"/><path class="sound-waves" d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/></svg><span></span>';
  const text = button.querySelector('span');
  text.textContent = labels[0];
  button.setAttribute('aria-label', labels[0]);
  document.body.append(button);
  const clamp = (n) => Math.max(0, Math.min(1, n));
  const smooth = (n) => { const t = clamp(n); return t * t * (3 - 2 * t); };
  const videos = [...document.querySelectorAll('video')];
  const chapters = [...document.querySelectorAll('[data-chap]')];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let context, master, tracks, loading, timer, enabled = false, operation = 0;
  let lastY = scrollY, lastTime = performance.now(), motion = 0, eaglePlayed = false, activeEagle;
  const natureScenes = new Set();
  let natureUntil = 0;
  function label(value) {
    text.textContent = value;
    button.setAttribute('aria-label', value);
    button.title = value;
  }

  function quiet() { return document.hidden || videos.some((video) => !video.paused && !video.ended); }
  function fallbackState() {
    const bounds = chapters.map((chapter) => chapter.getBoundingClientRect());
    const scene = bounds.slice(0, 3).filter((r) => r.top <= innerHeight * .3).length;
    const final = bounds[3];
    return { y: scrollY, weights: [0, 1, 2, 3].map((i) => i === scene ? 1 : 0),
      landing: final ? smooth(-final.top / Math.max(1, document.documentElement.scrollHeight - innerHeight - (final.top + scrollY))) : 0 };
  }
  function state() {
    return !reducedMotion.matches && window.flyaryFlightState ? window.flyaryFlightState : fallbackState();
  }

  // Overlap the tail and head in the decoded buffer: recorded ambience loops without a hard seam.
  function loopBuffer(buffer) {
    const overlap = Math.min(Math.round(buffer.sampleRate * 1.5), Math.floor(buffer.length / 4));
    const length = buffer.length - overlap;
    const result = context.createBuffer(buffer.numberOfChannels, length, buffer.sampleRate);
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      const input = buffer.getChannelData(c), output = result.getChannelData(c);
      output.set(input.subarray(overlap));
      for (let j = 0; j < overlap; j++) {
        const t = j / Math.max(1, overlap - 1);
        output[length - overlap + j] = input[length + j] * (1 - t) + input[j] * t;
      }
    }
    return result;
  }
  async function load() {
    if (tracks) return;
    if (loading) return loading;
    loading = (async () => {
      const names = ['flight-wind', 'summit-wind', 'nature', 'eagle'];
      const buffers = await Promise.all(names.map(async (name) => {
        const response = await fetch(`/assets/audio/${name}.mp3`);
        if (!response.ok) throw new Error(`Audio unavailable: ${name}`);
        return context.decodeAudioData(await response.arrayBuffer());
      }));
      tracks = buffers.map((buffer, i) => {
        const gain = context.createGain();
        gain.gain.value = 0;
        gain.connect(master);
        if (i === 3) return { buffer, gain };
        const source = context.createBufferSource();
        source.buffer = loopBuffer(buffer);
        source.loop = true;
        source.connect(gain);
        source.start();
        return { source, gain };
      });
    })();
    try { await loading; } finally { loading = null; }
  }
  function gainTo(gain, value, time = .35) {
    gain.gain.setTargetAtTime(value, context.currentTime, time);
  }
  function update() {
    if (!enabled || !tracks || quiet() || context.state !== 'running') return;
    const s = state(), now = performance.now(), dt = Math.max(1, now - lastTime);
    const speed = Math.min(1, Math.abs(s.y - lastY) / dt / 1.8);
    motion += (speed - motion) * (1 - Math.exp(-dt / 300));
    lastY = s.y; lastTime = now;
    const [summit, forest, hills, valley] = s.weights;
    const airborne = 1 - s.landing;
    // Every sound follows movement. Reading restores silence, including any bird accents.
    gainTo(master, .8 * motion, .25);
    gainTo(tracks[0].gain, (.10 + .30 * motion) * airborne, .2);
    gainTo(tracks[1].gain, .035 * summit * airborne, .4);
    const scene = s.weights.indexOf(Math.max(...s.weights));
    if (scene > 0 && motion > .08 && !natureScenes.has(scene)) {
      natureScenes.add(scene);
      natureUntil = now + 1200;
    }
    const natureAccent = clamp((natureUntil - now) / 500);
    gainTo(tracks[2].gain, (.018 * forest + .020 * hills + .022 * valley) * natureAccent, .15);
    // Only trigger while travelling through the first scene; enabling at an anchor never fires the call.
    if (!eaglePlayed && summit > .7 && motion > .12 && s.y > innerHeight * .35 && s.y < innerHeight * 1.2) {
      eaglePlayed = true;
      activeEagle = context.createBufferSource();
      activeEagle.buffer = tracks[3].buffer;
      activeEagle.connect(tracks[3].gain);
      gainTo(tracks[3].gain, .018, .04);
      tracks[3].gain.gain.setTargetAtTime(0, context.currentTime + .3, .08);
      activeEagle.start(context.currentTime, 0, Math.min(.65, tracks[3].buffer.duration));
      activeEagle.onended = () => { activeEagle = null; };
    }
  }
  function resetMotion() { lastY = state().y; lastTime = performance.now(); motion = 0; }
  async function syncPlayback() {
    if (!context || !tracks) return;
    if (!enabled || quiet()) {
      clearInterval(timer);
      master.gain.value = 0;
      if (activeEagle) { activeEagle.stop(); activeEagle = null; }
      await context.suspend();
    } else {
      resetMotion();
      await context.resume();
      // A visibility/video event can arrive while resume is pending.
      if (!enabled || quiet()) { master.gain.value = 0; await context.suspend(); return; }
      master.gain.value = 0;
      update();
      clearInterval(timer);
      timer = setInterval(update, 80);
    }
  }
  function fail(error) {
    console.warn('Flyary soundscape:', error);
    enabled = false;
    clearInterval(timer);
    if (master) master.gain.value = 0;
    if (context) context.suspend().catch(() => {});
    button.setAttribute('aria-pressed', 'false');
    button.removeAttribute('aria-busy');
    label(labels[3]);
  }
  button.addEventListener('click', async () => {
    const current = ++operation;
    enabled = !enabled;
    button.setAttribute('aria-pressed', String(enabled));
    button.removeAttribute('aria-busy');
    label(enabled ? labels[1] : labels[0]);
    if (!enabled) {
      if (master) master.gain.value = 0;
      clearInterval(timer);
      if (activeEagle) { activeEagle.stop(); activeEagle = null; }
      if (context) await context.suspend().catch(() => {});
      return;
    }
    try {
      if (!context) {
        context = new AudioContext();
        master = context.createGain();
        master.gain.value = 0;
        master.connect(context.destination);
      }
      // Resume directly inside the click, before waiting for downloads (mobile autoplay policy).
      const resume = context.resume();
      if (!tracks) { label(labels[2]); button.setAttribute('aria-busy', 'true'); }
      await Promise.all([resume, load()]);
      if (operation !== current || !enabled) return;
      button.removeAttribute('aria-busy');
      label(labels[1]);
      await syncPlayback();
    } catch (error) { if (current === operation) fail(error); }
  });
  const sync = () => { syncPlayback().catch(fail); };
  document.addEventListener('visibilitychange', sync);
  for (const video of videos) for (const event of ['play', 'pause', 'ended']) video.addEventListener(event, sync);
  addEventListener('pagehide', () => { clearInterval(timer); if (context) { master.gain.value = 0; context.suspend().catch(() => {}); } });
  addEventListener('pageshow', sync);
})();
