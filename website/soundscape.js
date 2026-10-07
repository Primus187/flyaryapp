// Sound is enabled by default; browsers may require a gesture before playback.
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
  button.setAttribute('aria-pressed', 'true');
  button.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M11 4 5 9H2v6h3l6 5V4Z"/><path class="sound-waves" d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/></svg><span></span>';
  const text = button.querySelector('span');
  text.textContent = labels[1];
  button.setAttribute('aria-label', labels[1]);
  document.body.append(button);
  const clamp = (n) => Math.max(0, Math.min(1, n));
  const smooth = (n) => { const t = clamp(n); return t * t * (3 - 2 * t); };
  const videos = [...document.querySelectorAll('video')];
  const chapters = [...document.querySelectorAll('[data-chap]')];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let context, master, tracks, loading, timer, enabled = true, operation = 0;
  let playbackAuthorized = false;
  let lastY = scrollY, lastTime = performance.now(), motion = 0, eaglePlayed = false, activeEagle;
  const natureScenes = new Set();
  let natureUntil = 0;
  function label(value) {
    text.textContent = value;
    button.setAttribute('aria-label', value);
    button.title = value;
  }
  function showPlayback() {
    const playing = enabled && tracks && context?.state === 'running' && !quiet();
    button.setAttribute('aria-pressed', String(Boolean(playing)));
    label(playing ? labels[1] : labels[0]);
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
  function loopBuffer(buffer, fadeSeconds = 1.5) {
    const overlap = Math.min(Math.round(buffer.sampleRate * fadeSeconds), Math.floor(buffer.length / 4));
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
      const names = ['flight-wind', 'summit-wind', 'nature', 'eagle', 'open-horizon'];
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
        source.buffer = loopBuffer(buffer, i === 4 ? 5 : 1.5);
        // Keep music below the wind even when the supplied track is mastered loudly.
        let musicLevel = 0;
        if (i === 4) {
          let energy = 0, peak = 0;
          for (let c = 0; c < source.buffer.numberOfChannels; c++) {
            for (const sample of source.buffer.getChannelData(c)) {
              energy += sample * sample;
              peak = Math.max(peak, Math.abs(sample));
            }
          }
          const rms = Math.sqrt(energy / (source.buffer.length * source.buffer.numberOfChannels));
          musicLevel = Math.min(.05, .0028 / Math.max(.0001, rms), .020 / Math.max(.0001, peak));
        }
        source.loop = true;
        source.connect(gain);
        source.start();
        return { source, gain, musicLevel };
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
    const speed = Math.min(1, Math.abs(s.y - lastY) / dt / .9);
    motion += (speed - motion) * (1 - Math.exp(-dt / 300));
    lastY = s.y; lastTime = now;
    const [summit, forest, hills, valley] = s.weights;
    const airborne = 1 - s.landing;
    // Music continues while reading; only the effects follow movement.
    gainTo(master, 3.2, .25);
    gainTo(tracks[0].gain, (.10 + .30 * motion) * airborne * motion, .2);
    gainTo(tracks[1].gain, .035 * summit * airborne * motion, .4);
    gainTo(tracks[4].gain, tracks[4].musicLevel, .7);
    const scene = s.weights.indexOf(Math.max(...s.weights));
    if (scene > 0 && motion > .08 && !natureScenes.has(scene)) {
      natureScenes.add(scene);
      natureUntil = now + 1200;
    }
    const natureAccent = clamp((natureUntil - now) / 500);
    gainTo(tracks[2].gain, (.018 * forest + .020 * hills + .022 * valley) * natureAccent * motion, .15);
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
    if (!enabled || !playbackAuthorized || quiet()) {
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
  async function start(gesture = false) {
    const current = operation;
    try {
      if (!context) {
        context = new AudioContext();
        master = context.createGain();
        master.gain.value = 0;
        master.connect(context.destination);
        context.addEventListener('statechange', showPlayback);
      }
      // Resume directly inside the click, before waiting for downloads (mobile autoplay policy).
      // A blocked autoplay resume may stay pending: do not block loading or the mute button.
      if (gesture || context.state === 'running') playbackAuthorized = true;
      if (!playbackAuthorized) await context.suspend();
      else context.resume().then(() => {
        if (enabled && tracks && current === operation) syncPlayback().catch(fail);
      }).catch(() => {});
      // Some mobile engines require a source to start inside the trusted touch event as well.
      if (gesture) {
        const primer = context.createBufferSource();
        primer.buffer = context.createBuffer(1, 1, context.sampleRate);
        primer.connect(context.destination);
        primer.start();
        primer.onended = () => primer.disconnect();
      }
      if (!tracks) { label(labels[2]); button.setAttribute('aria-busy', 'true'); }
      await load();
      if (operation !== current || !enabled) return;
      button.removeAttribute('aria-busy');
      showPlayback();
      if (context.state === 'running') await syncPlayback();
    } catch (error) { if (current === operation) fail(error); }
  }
  button.addEventListener('click', async () => {
    // A blocked automatic start is not audible playback: the first tap must enable it, not mute it.
    if (enabled && context?.state !== 'running' && !quiet()) { start(true); return; }
    operation++;
    enabled = !enabled;
    button.setAttribute('aria-pressed', String(enabled));
    button.removeAttribute('aria-busy');
    label(enabled ? labels[1] : labels[0]);
    if (enabled) { start(true); return; }
    if (master) master.gain.value = 0;
    clearInterval(timer);
    if (activeEagle) { activeEagle.stop(); activeEagle = null; }
    if (context) await context.suspend().catch(() => {});
  });
  const sync = () => { syncPlayback().catch(fail); };
  document.addEventListener('visibilitychange', sync);
  for (const video of videos) for (const event of ['play', 'pause', 'ended']) video.addEventListener(event, sync);
  addEventListener('pagehide', () => { clearInterval(timer); if (context) { master.gain.value = 0; context.suspend().catch(() => {}); } });
  addEventListener('pageshow', sync);
  start();
})();
