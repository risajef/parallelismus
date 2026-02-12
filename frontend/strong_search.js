import * as api from '/static/app.js';

const qEl = document.getElementById('q');
const go = document.getElementById('go');
const results = document.getElementById('results');

async function doSearch() {
  const q = (qEl.value || '').trim();
  if (!q) { results.innerHTML = '<div>Enter a query</div>'; return; }
  results.innerHTML = '<div>Searching…</div>';
  try {
    const rows = await api.fetchStrongSearch(q);
    if (!rows || !rows.length) {
      results.innerHTML = '<div>(no results)</div>';
      return;
    }
    const out = document.createElement('ul');
    rows.forEach(r => {
      const li = document.createElement('li');
      const strong = document.createElement('div');
      strong.style.fontWeight = '600';
      strong.textContent = r.strong;
      li.appendChild(strong);
      const t = document.createElement('div');
      t.innerHTML = `<strong>Translations:</strong> ${Array.isArray(r.translation) ? r.translation.slice(0, 6).map(x => escapeHtml(x)).join(', ') : ''}`;
      li.appendChild(t);
      const o = document.createElement('div');
      o.innerHTML = `<strong>Originals:</strong> ${Array.isArray(r.original) ? r.original.slice(0, 6).map(x => escapeHtml(x)).join(', ') : ''}`;
      li.appendChild(o);
      // link to strong detail
      const a = document.createElement('a');
      a.href = '/strong/' + encodeURIComponent(r.strong);
      a.textContent = 'Open details';
      a.style.marginTop = '6px';
      a.target = '_blank';
      li.appendChild(a);

      out.appendChild(li);
    });
    results.innerHTML = '';
    results.appendChild(out);
  } catch (err) {
    results.innerHTML = '<div>Error: ' + String(err) + '</div>';
  }
}

function escapeHtml(s) { if (s == null) return ''; return String(s).replace(/[&<>\"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }

qEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });
go.addEventListener('click', doSearch);

// optionally prefill from query param
const params = new URLSearchParams(location.search);
if (params.get('q')) { qEl.value = params.get('q'); doSearch(); }
