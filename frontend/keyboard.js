export function installShortcuts(shortcutBtn, tooltipApi, buildShortcutHtml, root = document) {
  const getById = id => root.querySelector('#' + CSS.escape(id));
  function isComposeMode() {
    const typeEl = getById('type');
    return typeEl && typeEl.value === 'composes';
  }

  let showShortcuts = false;
  if (shortcutBtn) {
    shortcutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      showShortcuts = !showShortcuts;
      if (showShortcuts) {
        const html = (buildShortcutHtml && typeof buildShortcutHtml === 'function') ? buildShortcutHtml() : (tooltipApi.buildShortcutHtml ? tooltipApi.buildShortcutHtml() : '');
        tooltipApi.append(html);
        shortcutBtn.setAttribute('aria-pressed', 'true');
      } else {
        tooltipApi.hide();
        shortcutBtn.setAttribute('aria-pressed', 'false');
      }
    });
  }
  // global keyboard shortcuts (Alt+S/T/R, Alt+Enter)
  root.addEventListener('keydown', (ev) => {
    if (!ev.altKey) return;
    const code = ev.key.toLowerCase();
    if (code === 's') {
      ev.preventDefault();
      if (isComposeMode()) getById('member-input')?.focus();
      else getById('src')?.focus();
    } else if (code === 't') {
      ev.preventDefault();
      if (isComposeMode()) getById('compose-target')?.focus();
      else getById('tgt')?.focus();
    } else if (code === 'r') {
      ev.preventDefault(); getById('type')?.focus();
    } else if (ev.key === 'Enter') {
      ev.preventDefault(); getById('addRel')?.click();
    }
  });
}
