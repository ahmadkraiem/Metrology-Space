/**
 * Shared presentation badge and escaping utilities.
 * Pure UI presentation helpers with zero domain or state side-effects.
 */

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function badgeClassForTone(tone) {
  if (tone === 'ok') {
    return 'body-evidence-badge body-evidence-badge--ok';
  }
  if (tone === 'warn') {
    return 'body-evidence-badge body-evidence-badge--warn';
  }
  if (tone === 'muted') {
    return 'body-evidence-badge body-evidence-badge--muted';
  }
  return 'body-evidence-badge';
}

export function renderBadge(label, tone = 'default', title = '') {
  const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
  return `<span class="${badgeClassForTone(tone)}"${titleAttr}>${escapeHtml(label)}</span>`;
}
