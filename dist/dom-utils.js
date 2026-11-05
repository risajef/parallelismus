export function createOption(value, text) {
  const opt = document.createElement('option');
  opt.value = String(value);
  opt.textContent = String(text);
  return opt;
}
export function setOptions(selectEl, items, valueKey, labelKey) {
  selectEl.innerHTML = '';
  items.forEach(it => selectEl.appendChild(createOption(it[valueKey], it[labelKey] ?? it[valueKey])));
}
export function escapeHtml(str) {
  if (str == null) return '';
  return String(str).replace(/[&<>\"]/g, function (s) {
    switch (s) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      default: return '';
    }
  });
}
export function sampleRandom(arr, n) {
  if (!Array.isArray(arr)) return [];
  const len = arr.length;
  if (len <= n) return arr.slice();
  const out = [];
  const seen = new Set();
  while (out.length < n) {
    const i = Math.floor(Math.random() * len);
    if (!seen.has(i)) { seen.add(i); out.push(arr[i]); }
  }
  return out;
}

export function renderVariants(container, translations, originals, transliterate) {
    container.replaceChildren();
    for (const [heading,values] of [['Translations',translations],['Originals',originals]]) {
        const title = document.createElement('h3');title.textContent = heading;container.appendChild(title);
        const list = document.createElement('ul');
        for (const value of values) {
            const item = document.createElement('li');
            const tr = heading === 'Originals' ? transliterate(value || '') : '';
            item.textContent = String(value) + (tr ? ' — ' + tr : '');list.appendChild(item);
        }
        container.appendChild(list);
    }
}
