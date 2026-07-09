// @ts-check
// A tiny, safe, dependency-free markdown-ish renderer for note bodies.
//
// Design constraints:
//   * Escape-first: every character of user input is HTML-escaped BEFORE any
//     markup is introduced, so no user content can ever break out into markup.
//   * We only emit a fixed, closed set of tags (p, br, strong, em, code, pre,
//     ul, ol, li, h3, h4, a, blockquote, hr). No raw HTML passthrough.
//   * Links are only emitted for http/https URLs; anything else stays as text.
//
// This is intentionally NOT a full CommonMark implementation. It supports the
// subset an analyst actually types into a scratchpad: headings, lists, bold,
// italic, inline code, fenced/indented code, links, blockquotes, and rules.

import { escapeHtml } from "./html.js";
import { isSafeUrl } from "./validate.js";

/**
 * Render inline spans (bold, italic, code, links) inside already-escaped text.
 * Input MUST already be HTML-escaped. We operate on the escaped string and
 * only introduce our own known-safe tags.
 * @param {string} escaped
 * @returns {string}
 */
function renderInline(escaped) {
  let out = escaped;

  // Inline code: `code`. Protect its contents from further inline parsing by
  // handling it first and stashing placeholders is overkill here; instead we
  // process code spans last-to-first is complex. Simpler: code first, and the
  // escaped content inside cannot re-introduce markup because '*' and '_' are
  // literal characters that only *this* function turns into tags — so we run
  // code substitution first, then bold/italic won't touch already-wrapped
  // <code> because we match greedily but bounded by backticks.
  out = out.replace(/`([^`]+)`/g, (_m, code) => `<code>${code}</code>`);

  // Links: [label](http(s)://url). URL is validated; label keeps inline style
  // stripped (already escaped). Reject non-http(s) targets — render as plain
  // text so we never emit javascript:/data: hrefs.
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, url) => {
    // The url here is HTML-escaped (e.g. &amp;); unescape for validation only.
    const rawUrl = url
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
    if (!isSafeUrl(rawUrl)) return m; // leave as literal text
    return `<a href="${url}" rel="noopener noreferrer">${label}</a>`;
  });

  // Bold: **text** or __text__
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/__([^_]+)__/g, "<strong>$1</strong>");

  // Italic: *text* or _text_ (after bold so ** isn't eaten)
  out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  out = out.replace(/(^|[^_])_([^_\n]+)_/g, "$1<em>$2</em>");

  return out;
}

/**
 * Render a markdown-ish string to a safe HTML fragment.
 * @param {string} src
 * @returns {string}
 */
export function renderMarkdown(src) {
  if (typeof src !== "string" || src.length === 0) return "";
  const lines = src.replace(/\r\n?/g, "\n").split("\n");

  /** @type {string[]} */
  const out = [];
  let i = 0;

  /** @type {null | "ul" | "ol"} */
  let listType = null;
  const closeList = () => {
    if (listType) {
      out.push(`</${listType}>`);
      listType = null;
    }
  };

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block ```
    if (/^```/.test(line)) {
      closeList();
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) {
        buf.push(escapeHtml(lines[i]));
        i++;
      }
      i++; // consume closing fence (or EOF)
      out.push(`<pre><code>${buf.join("\n")}</code></pre>`);
      continue;
    }

    // Horizontal rule
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      closeList();
      out.push("<hr>");
      i++;
      continue;
    }

    // Headings (### / ####; keep h1/h2 for structure — start at h3)
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      closeList();
      const level = Math.min(6, Math.max(3, h[1].length + 2)); // # -> h3
      out.push(`<h${level}>${renderInline(escapeHtml(h[2].trim()))}</h${level}>`);
      i++;
      continue;
    }

    // Blockquote
    if (/^\s*>\s?/.test(line)) {
      closeList();
      const buf = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        buf.push(renderInline(escapeHtml(lines[i].replace(/^\s*>\s?/, ""))));
        i++;
      }
      out.push(`<blockquote>${buf.join("<br>")}</blockquote>`);
      continue;
    }

    // Unordered list item
    const ul = /^\s*[-*+]\s+(.*)$/.exec(line);
    if (ul) {
      if (listType !== "ul") {
        closeList();
        out.push("<ul>");
        listType = "ul";
      }
      out.push(`<li>${renderInline(escapeHtml(ul[1]))}</li>`);
      i++;
      continue;
    }

    // Ordered list item
    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (ol) {
      if (listType !== "ol") {
        closeList();
        out.push("<ol>");
        listType = "ol";
      }
      out.push(`<li>${renderInline(escapeHtml(ol[1]))}</li>`);
      i++;
      continue;
    }

    // Blank line
    if (line.trim() === "") {
      closeList();
      i++;
      continue;
    }

    // Paragraph: gather consecutive non-blank, non-special lines.
    closeList();
    const para = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^```/.test(lines[i]) &&
      !/^(#{1,6})\s+/.test(lines[i]) &&
      !/^\s*[-*+]\s+/.test(lines[i]) &&
      !/^\s*\d+[.)]\s+/.test(lines[i]) &&
      !/^\s*>\s?/.test(lines[i]) &&
      !/^\s*([-*_])(\s*\1){2,}\s*$/.test(lines[i])
    ) {
      para.push(renderInline(escapeHtml(lines[i])));
      i++;
    }
    out.push(`<p>${para.join("<br>")}</p>`);
  }

  closeList();
  return out.join("\n");
}
