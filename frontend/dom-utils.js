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
  return String(str).replace(/[&<>\"]+/g, function (s) {
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
