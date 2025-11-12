export function installShortcuts(shortcutBtn, tooltipApi, buildShortcutHtml) {
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
  document.addEventListener('keydown', (ev) => {
    if (!ev.altKey) return;
    const code = ev.key.toLowerCase();
    if (code === 's') {
      ev.preventDefault(); document.getElementById('src')?.focus();
    } else if (code === 't') {
      ev.preventDefault(); document.getElementById('tgt')?.focus();
    } else if (code === 'r') {
      ev.preventDefault(); document.getElementById('type')?.focus();
    } else if (ev.key === 'Enter') {
      ev.preventDefault(); document.getElementById('addRel')?.click();
    }
  });
}
