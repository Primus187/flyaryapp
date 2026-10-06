// Loaded before the page renders: marks that JavaScript runs, so scroll reveals may start hidden.
// A separate file because the Content-Security-Policy (vercel.json) allows no inline scripts.
document.documentElement.classList.add('js');
// The start page shows its moving stage unless the visitor asked for reduced motion. Deciding this before the first
// paint avoids a visible switch; if stage.js does not confirm within a few seconds, the page falls back to the plain version.
if (document.querySelector('script[src="/stage.js"]') && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  document.documentElement.classList.add('stage-on');
  setTimeout(() => { if (!document.documentElement.classList.contains('stage-ready')) document.documentElement.classList.remove('stage-on'); }, 5000);
}
