// @ts-check
// Shared HTML-escaping primitive. Kept in its own module so both the builder
// and the markdown renderer share one audited implementation.

/**
 * Escape a string for safe insertion into HTML text or a double-quoted
 * attribute context. Escapes the five significant characters.
 * @param {unknown} value
 * @returns {string}
 */
export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * A minimal deterministic slug for CSS ids/anchors. Produces [a-z0-9-] only.
 * @param {string} value
 * @param {string} [fallback]
 * @returns {string}
 */
export function slug(value, fallback = "item") {
  const s = String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s.length > 0 ? s : fallback;
}
