// @ts-check
// HTML generation for startboard.
//
// Produces a single self-contained HTML document: inline CSS, no external
// scripts, stylesheets, fonts, or images. All user content is escaped. Icons
// are emoji text or self-generated inline-SVG data: URIs (same-document).
//
// Interactivity model:
//   * DEFAULT (no --interactive): ZERO JavaScript. Collapsible groups use
//     <details>/<summary>; multi-board switching uses the CSS radio "tab" hack;
//     there are no inline event handlers, so the output is CSP-friendly
//     (script-src 'none' works).
//   * --interactive: adds ONE small inline <script> that powers a
//     search-as-you-type filter. Still no external fetches. Callers who need a
//     strict no-JS/CSP-safe artifact simply omit the flag.

import { escapeHtml, slug } from "./html.js";
import { renderMarkdown } from "./markdown.js";
import { renderIcon } from "./icons.js";
import { resolveTheme, DEFAULT_THEME } from "./themes.js";

export { escapeHtml } from "./html.js";

/**
 * @param {import("./themes.js").Palette} p
 * @param {string} prefix
 * @returns {string}
 */
function paletteVars(p, prefix = "") {
  return [
    `${prefix}--bg: ${p.bg};`,
    `${prefix}--panel: ${p.panel};`,
    `${prefix}--text: ${p.text};`,
    `${prefix}--muted: ${p.muted};`,
    `${prefix}--accent: ${p.accent};`,
    `${prefix}--border: ${p.border};`,
    `${prefix}--up: ${p.up};`,
    `${prefix}--down: ${p.down};`,
    `${prefix}--warn: ${p.warn};`,
  ].join("\n    ");
}

/**
 * @param {string} themeName
 * @param {null|"light"|"dark"} forced
 * @param {string} [extraCss]
 * @returns {string}
 */
function renderStyle(themeName, forced, extraCss) {
  const { theme } = resolveTheme(themeName);
  // Base palette = light. prefers-color-scheme: dark switches unless the config
  // forced a specific mode.
  let root;
  if (forced === "dark") {
    root = `:root {\n    ${paletteVars(theme.dark)}\n  }`;
  } else if (forced === "light") {
    root = `:root {\n    ${paletteVars(theme.light)}\n  }`;
  } else {
    root =
      `:root {\n    ${paletteVars(theme.light)}\n  }\n` +
      `  @media (prefers-color-scheme: dark) {\n    :root {\n    ${paletteVars(
        theme.dark
      )}\n    }\n  }`;
  }

  const custom =
    typeof extraCss === "string" && extraCss.trim().length > 0
      ? `\n  /* user css */\n  ${extraCss}\n`
      : "";

  return `<style>
  ${root}
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    line-height: 1.45;
  }
  a { color: var(--accent); }
  .wrap { max-width: 1180px; margin: 0 auto; padding: 0 1.25rem; }
  header { padding: 2rem 0 0.75rem; }
  header h1 { margin: 0; font-size: 1.7rem; }
  header p.subtitle { margin: 0.25rem 0 0; color: var(--muted); }
  main { padding: 1rem 0 3rem; }
  .board-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1rem;
    align-items: start;
  }
  .card {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 0.9rem 1.05rem;
  }
  .card > h2, .card > details > summary > h2 {
    margin: 0 0 0.55rem; font-size: 1.02rem;
    border-bottom: 1px solid var(--border); padding-bottom: 0.4rem;
    display: inline-flex; align-items: center; gap: 0.45rem;
  }
  details.group { margin: 0; }
  details.group > summary {
    list-style: none; cursor: pointer; display: block;
  }
  details.group > summary::-webkit-details-marker { display: none; }
  details.group > summary h2::after {
    content: "▸"; margin-left: auto; color: var(--muted); font-size: 0.8em;
    transition: transform 0.15s ease;
  }
  details.group[open] > summary h2::after { transform: rotate(90deg); }
  .icon { width: 1.05em; height: 1.05em; vertical-align: -0.15em; }
  .icon-emoji { font-size: 1.05em; line-height: 1; }
  ul.links { list-style: none; margin: 0; padding: 0; }
  ul.links li { margin: 0.18rem 0; display: flex; gap: 0.5rem; align-items: baseline; }
  ul.links a { text-decoration: none; font-weight: 600; }
  ul.links a:hover { text-decoration: underline; }
  ul.links .link-body { display: flex; flex-direction: column; }
  ul.links .desc { color: var(--muted); font-size: 0.82rem; font-weight: 400; }
  .note-body { color: var(--text); }
  .note-body :first-child { margin-top: 0; }
  .note-body :last-child { margin-bottom: 0; }
  .note-body pre {
    background: var(--bg); border: 1px solid var(--border); border-radius: 6px;
    padding: 0.6rem 0.75rem; overflow-x: auto; font-size: 0.85rem;
  }
  .note-body code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.88em;
  }
  .note-body blockquote {
    margin: 0.5rem 0; padding: 0.1rem 0.85rem; border-left: 3px solid var(--border);
    color: var(--muted);
  }
  .note-body ul, .note-body ol { margin: 0.4rem 0; padding-left: 1.3rem; }
  .status-row {
    display: flex; align-items: center; justify-content: space-between; gap: 0.5rem;
    padding: 0.35rem 0; border-bottom: 1px solid var(--border);
  }
  .status-row:last-child { border-bottom: none; }
  .status-row .name { font-weight: 600; }
  .status-row .url { display: block; color: var(--muted); font-size: 0.78rem; font-weight: 400; word-break: break-all; }
  .status-meta { color: var(--muted); font-size: 0.75rem; text-align: right; white-space: nowrap; }
  .badge {
    font-size: 0.7rem; font-weight: 700; text-transform: uppercase;
    padding: 0.12rem 0.5rem; border-radius: 999px; border: 1px solid var(--border);
    color: var(--muted); white-space: nowrap;
  }
  .badge.up { color: var(--up); border-color: var(--up); }
  .badge.down { color: var(--down); border-color: var(--down); }
  .badge.error { color: var(--warn); border-color: var(--warn); }
  .checked-at { color: var(--muted); font-size: 0.72rem; margin: 0.4rem 0 0; }
  /* CSS-only tabbed boards (radio hack) */
  .tabs input[type="radio"] { position: absolute; opacity: 0; pointer-events: none; }
  .tablist { display: flex; flex-wrap: wrap; gap: 0.4rem; margin: 0.75rem 0 0; padding: 0; }
  .tablist label {
    cursor: pointer; padding: 0.35rem 0.8rem; border-radius: 8px 8px 0 0;
    border: 1px solid var(--border); border-bottom: none; color: var(--muted);
    font-weight: 600; font-size: 0.9rem; display: inline-flex; gap: 0.4rem; align-items: center;
  }
  .tabpanel { display: none; border-top: 1px solid var(--border); padding-top: 1rem; }
  ${tabSelectors()}
  .search { margin: 0.75rem 0 0; }
  .search input {
    width: 100%; padding: 0.55rem 0.75rem; border-radius: 8px;
    border: 1px solid var(--border); background: var(--panel); color: var(--text);
    font-size: 0.95rem;
  }
  .noscript-hint { color: var(--muted); font-size: 0.8rem; }
  footer { padding: 0 0 2rem; color: var(--muted); font-size: 0.8rem; }
  .skip-link {
    position: absolute; left: -999px; top: 0; background: var(--accent); color: #fff;
    padding: 0.5rem 0.9rem; border-radius: 0 0 8px 0; z-index: 10;
  }
  .skip-link:focus { left: 0; }
  @media print {
    .tablist, .search, .skip-link { display: none; }
    .tabpanel { display: block !important; }
    details.group { open: true; }
    details.group > summary h2::after { content: ""; }
    .card { break-inside: avoid; }
  }${custom}
</style>`;
}

/**
 * Generate the radio-hack tab selectors for up to N boards. Emitted regardless
 * of board count (harmless), bounded to keep CSS small.
 * @returns {string}
 */
function tabSelectors() {
  const n = 24;
  const rules = [];
  for (let i = 0; i < n; i++) {
    rules.push(
      `  #tab-${i}:checked ~ .tablist label[for="tab-${i}"] { background: var(--panel); color: var(--text); border-bottom: 1px solid var(--panel); margin-bottom: -1px; }`
    );
    rules.push(`  #tab-${i}:checked ~ #panel-${i} { display: block; }`);
  }
  return rules.join("\n");
}

/** @param {import("./validate.js").Link} link */
function renderLink(link) {
  const icon = renderIcon(link.icon);
  const iconHtml = icon ? `${icon} ` : "";
  const desc =
    typeof link.description === "string" && link.description.length > 0
      ? `<span class="desc">${escapeHtml(link.description)}</span>`
      : "";
  const search = escapeHtml(
    `${link.label} ${link.description || ""} ${link.url}`.toLowerCase()
  );
  return `        <li data-search="${search}">${iconHtml}<span class="link-body"><a href="${escapeHtml(
    link.url
  )}" rel="noopener noreferrer">${escapeHtml(link.label)}</a>${desc}</span></li>`;
}

/** @param {any[]} items */
function ordered(items) {
  return items
    .map((it, i) => ({ it, i }))
    .sort((a, b) => {
      const ao = typeof a.it.order === "number" ? a.it.order : 0;
      const bo = typeof b.it.order === "number" ? b.it.order : 0;
      return ao - bo || a.i - b.i;
    })
    .map((x) => x.it);
}

/** @param {import("./validate.js").LinkGroup} group */
function renderGroup(group) {
  const links = ordered(group.links || []).map(renderLink).join("\n");
  const icon = renderIcon(group.icon);
  const iconHtml = icon ? `${icon} ` : "";
  const heading = `<h2>${iconHtml}${escapeHtml(group.title)}</h2>`;
  const list = `<ul class="links">\n${links}\n      </ul>`;
  if (group.collapsed) {
    return `      <section class="card" role="region" aria-label="${escapeHtml(group.title)}">
        <details class="group">
          <summary>${heading}</summary>
          ${list}
        </details>
      </section>`;
  }
  return `      <section class="card" role="region" aria-label="${escapeHtml(group.title)}">
        <details class="group" open>
          <summary>${heading}</summary>
          ${list}
        </details>
      </section>`;
}

/** @param {import("./validate.js").Note} note */
function renderNote(note) {
  const useMd = note.markdown !== false;
  const body = useMd
    ? renderMarkdown(note.body)
    : `<p style="white-space:pre-wrap">${escapeHtml(note.body)}</p>`;
  return `      <section class="card" role="region" aria-label="${escapeHtml(note.title)}">
        <h2>${escapeHtml(note.title)}</h2>
        <div class="note-body">${body}</div>
      </section>`;
}

/**
 * @param {import("./validate.js").StatusTarget[]} status
 * @param {Map<string, import("./check.js").CheckResult>} [results]
 * @param {string} [checkedAt]
 */
function renderStatusPanel(status, results, checkedAt) {
  const rows = status
    .map((target) => {
      const r = results && results.get(statusKey(target));
      let badge = '<span class="badge">unchecked</span>';
      let meta = "";
      if (r) {
        const cls = r.state === "up" ? "up" : r.state === "down" ? "down" : "error";
        badge = `<span class="badge ${cls}">${escapeHtml(r.state)}</span>`;
        if (r.state === "error") {
          meta = `<span class="status-meta">${escapeHtml(r.error || "error")}</span>`;
        } else {
          const code = r.httpStatus != null ? `${r.httpStatus} · ` : "";
          meta = `<span class="status-meta">${escapeHtml(code)}${r.ms != null ? `${r.ms}ms` : ""}</span>`;
        }
      }
      return `        <div class="status-row">
          <span><span class="name">${escapeHtml(target.name)}</span><span class="url">${escapeHtml(
            target.url
          )}</span></span>
          ${meta}${badge}
        </div>`;
    })
    .join("\n");
  const stamp = checkedAt
    ? `\n        <p class="checked-at">Last checked: ${escapeHtml(checkedAt)}</p>`
    : "";
  return `      <section class="card" role="region" aria-label="Service status">
        <h2>Status</h2>
${rows}${stamp}
      </section>`;
}

/**
 * @param {import("./validate.js").StatusTarget} target
 * @returns {string}
 */
export function statusKey(target) {
  return `${target.type || "http"}|${target.name}|${target.url}`;
}

/**
 * @param {import("./validate.js").Board|import("./validate.js").Config} b
 * @param {object} opts
 * @param {Map<string, import("./check.js").CheckResult>} [opts.results]
 * @param {string} [opts.checkedAt]
 */
function renderBoardBody(b, opts) {
  const groups = Array.isArray(b.groups) ? ordered(b.groups) : [];
  const notes = Array.isArray(b.notes) ? ordered(b.notes) : [];
  const status = Array.isArray(b.status) ? b.status : [];
  const cards = [];
  for (const g of groups) cards.push(renderGroup(g));
  for (const n of notes) cards.push(renderNote(n));
  if (status.length > 0) cards.push(renderStatusPanel(status, opts.results, opts.checkedAt));
  return `    <div class="board-grid">
${cards.join("\n")}
    </div>`;
}

const SEARCH_SCRIPT = `<script>
(function () {
  var box = document.getElementById("sb-search");
  if (!box) return;
  function apply() {
    var q = box.value.trim().toLowerCase();
    var items = document.querySelectorAll("li[data-search]");
    for (var i = 0; i < items.length; i++) {
      var hit = q === "" || items[i].getAttribute("data-search").indexOf(q) !== -1;
      items[i].style.display = hit ? "" : "none";
    }
  }
  box.addEventListener("input", apply);
})();
</script>`;

/**
 * Render a config into a complete, self-contained HTML document.
 * Assumes the config has already been validated.
 * @param {import("./validate.js").Config} config
 * @param {object} [options]
 * @param {boolean} [options.interactive]  add the inline search script
 * @param {import("./check.js").CheckResult[]} [options.results]  inject live status
 * @param {string} [options.checkedAt]      timestamp label for status
 * @param {string} [options.css]            extra CSS (overrides config.css if set)
 * @returns {string}
 */
export function buildHtml(config, options = {}) {
  const interactive = options.interactive === true;
  const { forced } = resolveTheme(config.theme);
  const themeName = typeof config.theme === "string" ? config.theme : DEFAULT_THEME;
  const extraCss = options.css != null ? options.css : config.css;

  const resultsMap = new Map();
  if (Array.isArray(options.results)) {
    for (const r of options.results) {
      resultsMap.set(r.key || `http|${r.name}|${r.url}`, r);
    }
  }
  const renderOpts = { results: resultsMap, checkedAt: options.checkedAt };

  const subtitle =
    typeof config.subtitle === "string" && config.subtitle.length > 0
      ? `\n    <p class="subtitle">${escapeHtml(config.subtitle)}</p>`
      : "";

  const searchBox = interactive
    ? `\n  <div class="wrap"><div class="search"><label class="skip-link" for="sb-search">Search links</label><input id="sb-search" type="search" placeholder="Filter links…" aria-label="Filter links"></div></div>`
    : "";

  let mainInner;
  const boards = Array.isArray(config.boards) ? config.boards : [];
  if (boards.length > 0) {
    // Multi-board: CSS radio-hack tabs. First board checked by default.
    const radios = [];
    const labels = [];
    const panels = [];
    boards.forEach((board, i) => {
      const checked = i === 0 ? " checked" : "";
      radios.push(
        `    <input type="radio" name="sb-board" id="tab-${i}"${checked}>`
      );
      const icon = renderIcon(board.icon);
      const iconHtml = icon ? `${icon} ` : "";
      labels.push(
        `      <label for="tab-${i}">${iconHtml}${escapeHtml(board.title)}</label>`
      );
      panels.push(
        `    <div class="tabpanel" id="panel-${i}" role="tabpanel" aria-label="${escapeHtml(
          board.title
        )}">
${renderBoardBody(board, renderOpts)}
    </div>`
      );
    });
    mainInner = `  <div class="tabs">
${radios.join("\n")}
    <div class="tablist" role="tablist">
${labels.join("\n")}
    </div>
${panels.join("\n")}
  </div>`;
  } else {
    mainInner = renderBoardBody(config, renderOpts);
  }

  const script = interactive ? `\n${SEARCH_SCRIPT}` : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="startboard">
<title>${escapeHtml(config.title)}</title>
${renderStyle(themeName, forced, extraCss)}
</head>
<body>
  <a class="skip-link" href="#main">Skip to content</a>
  <div class="wrap">
  <header>
    <h1>${escapeHtml(config.title)}</h1>${subtitle}
  </header>
  </div>${searchBox}
  <main id="main" class="wrap">
${mainInner}
  </main>
  <footer class="wrap">
    Generated by startboard. Maintained by Cognis Digital.
  </footer>${script}
</body>
</html>
`;
}
