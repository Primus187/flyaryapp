// Loaded before the page renders: marks that JavaScript runs.
// A separate file because the Content-Security-Policy (vercel.json) allows no inline scripts.
document.documentElement.classList.add('js');
// The start page: mouse and trackpad devices get the moving stage, touch devices the version that keeps text and ground as plain page content, and
// visitors who asked for reduced motion the quiet version alone. Deciding this before the first paint avoids a visible
// switch; if stage.js does not confirm within a few seconds, the page falls back to the quiet version.
if (document.querySelector('script[src="/stage.js"]') && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const mode = matchMedia('(hover: hover) and (pointer: fine)').matches ? 'stage-on' : 'touch-on';
  document.documentElement.classList.add(mode);
  setTimeout(() => { if (!document.documentElement.classList.contains('stage-ready')) document.documentElement.classList.remove(mode); }, 5000);
}
