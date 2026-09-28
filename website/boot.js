// Loaded before the page renders: marks that JavaScript runs, so scroll reveals may start hidden.
// A separate file because the Content-Security-Policy (vercel.json) allows no inline scripts.
document.documentElement.classList.add('js');
