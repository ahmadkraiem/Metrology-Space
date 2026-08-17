/**
 * Shared display naming for landmark / annotation identifiers.
 * Internal ids stay snake_case; UI labels use Title Case.
 */

/**
 * Convert a snake_case (or similar) id into a Title Case display label.
 * Empty / non-string values return an empty string.
 * Already spaced Title Case strings are returned trimmed.
 *
 * @param {unknown} id
 * @returns {string}
 */
export function formatLandmarkDisplayName(id) {
  if (id == null) {
    return '';
  }

  const raw = String(id).trim();
  if (!raw) {
    return '';
  }

  // Prefer snake_case / kebab-case tokenization; fall back to whitespace splits.
  const tokens = raw.includes('_') || raw.includes('-')
    ? raw.split(/[_-]+/)
    : raw.split(/\s+/);

  return tokens
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
