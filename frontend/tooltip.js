export function makeStaticTooltip(containerEl) {
  const tooltip = document.createElement('div');
  tooltip.id = 'word-tooltip';
  tooltip.classList.add('static');
  tooltip.setAttribute('role', 'status');
  tooltip.setAttribute('aria-live', 'polite');
  if (containerEl) containerEl.appendChild(tooltip);
  return {
    el: tooltip,
    show(htmlContent) { tooltip.innerHTML = htmlContent || ''; tooltip.classList.add('show'); },
    hide() { tooltip.classList.remove('show'); },
    append(htmlContent) { tooltip.innerHTML = (tooltip.innerHTML || '') + htmlContent; tooltip.classList.add('show'); }
  };
}
export function buildTranslationGrid(translations, originals, esc) {
  const leftList = translations.length ? '<ul>' + translations.map(t => `<li>${esc(t)}</li>`).join('') + '</ul>' : '<div>-</div>';
  const rightList = originals.length ? '<ul>' + originals.map(o => `<li>${esc(o)}</li>`).join('') + '</ul>' : '<div>-</div>';
  return `<div class="tooltip-grid"><div class="tooltip-col"><h4>Translations</h4>${leftList}</div><div class="tooltip-col"><h4>Originals</h4>${rightList}</div></div>`;
}
export function buildShortcutHtml() {
  return `<div style="margin-top:6px;font-size:.9rem;color:var(--muted)"><strong>Keyboard</strong><ul style="margin:6px 0 0 1rem;padding:0"><li>Alt+S — focus Source input</li><li>Alt+T — focus Target input</li><li>Alt+R — focus Relation type</li><li>Alt+Enter — Add Relation</li></ul></div>`;
}
