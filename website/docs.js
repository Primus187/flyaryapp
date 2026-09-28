const sidebar = document.querySelector('.docs-sidebar details');
if (sidebar && matchMedia('(max-width: 700px)').matches) sidebar.open = false;
document.querySelectorAll('.doc-print').forEach((button) => {
  button.hidden = false;
  button.addEventListener('click', () => window.print());
});

const search = document.querySelector('.docs-search');
if (search && Array.isArray(window.flyaryDocs)) {
  const normalise = (s) => s.toLocaleLowerCase('de').normalize('NFD').replace(/\p{M}/gu, '');
  const entries = window.flyaryDocs.map((entry) => ({ ...entry, normalTitle: normalise(entry.title), normalText: normalise(entry.text) }));
  const input = document.querySelector('#docs-query');
  const results = document.querySelector('#search-results');
  const status = document.querySelector('#search-status');
  search.hidden = false;
  let timer;
  function update() {
    const terms = normalise(input.value.trim()).split(/\s+/).filter(Boolean);
    results.replaceChildren();
    if (!terms.length) { status.textContent = search.dataset.hint; return; }
    const matches = entries.filter((entry) => terms.every((term) => entry.normalTitle.includes(term) || entry.normalText.includes(term)))
      .map((entry) => ({ entry, score: terms.reduce((sum, term) => sum + (entry.normalTitle.includes(term) ? 10 : 1), 0) }))
      .sort((a, b) => b.score - a.score);
    status.textContent = matches.length ? `${results.getAttribute('aria-label')}: ${matches.length}${matches.length > 20 ? ' (20)' : ''}` : search.dataset.empty;
    for (const { entry } of matches.slice(0, 20)) {
      const li = document.createElement('li');
      const group = document.createElement('small'); group.textContent = entry.group;
      const link = document.createElement('a'); link.href = entry.url; link.textContent = entry.title;
      const excerpt = document.createElement('p');
      const found = entry.normalText.indexOf(terms[0]);
      const start = Math.max(0, found - 65);
      excerpt.textContent = `${start ? '… ' : ''}${entry.text.slice(start, start + 230)}${start + 230 < entry.text.length ? ' …' : ''}`;
      li.append(group, link, excerpt); results.append(li);
    }
  }
  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(update, 120); });
}
