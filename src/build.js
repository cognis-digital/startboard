// HTML generation for startboard.
// Produces a single self-contained HTML document: inline CSS, no external
// scripts, stylesheets, fonts, or images. Everything is escaped.

/**
 * Escape a string for safe insertion into HTML text or double-quoted
 * attribute context.
 * @param {string} value
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

const THEMES = {
  light: {
    bg: "#f4f5f7",
    panel: "#ffffff",
    text: "#1d2127",
    muted: "#5c6470",
    accent: "#2f6fed",
    border: "#e2e5ea",
  },
  dark: {
    bg: "#14171c",
    panel: "#1d222b",
    text: "#e6e9ef",
    muted: "#9aa2b1",
    accent: "#5b8cff",
    border: "#2a313c",
  },
};

function renderStyle(theme) {
  const t = THEMES[theme] || THEMES.light;
  // Inline stylesheet only. No @import, no url() pointing off-document.
  return `<style>
  :root {
    --bg: ${t.bg};
    --panel: ${t.panel};
    --text: ${t.text};
    --muted: ${t.muted};
    --accent: ${t.accent};
    --border: ${t.border};
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    line-height: 1.45;
  }
  header { padding: 2rem 1.5rem 1rem; max-width: 1100px; margin: 0 auto; }
  header h1 { margin: 0; font-size: 1.8rem; }
  header p { margin: 0.25rem 0 0; color: var(--muted); }
  main {
    max-width: 1100px;
    margin: 0 auto;
    padding: 1rem 1.5rem 3rem;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1rem;
    align-items: start;
  }
  .card {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 1rem 1.1rem;
  }
  .card h2 {
    margin: 0 0 0.6rem;
    font-size: 1.05rem;
    border-bottom: 1px solid var(--border);
    padding-bottom: 0.4rem;
  }
  ul.links { list-style: none; margin: 0; padding: 0; }
  ul.links li { margin: 0.2rem 0; }
  ul.links a { color: var(--accent); text-decoration: none; font-weight: 600; }
  ul.links a:hover { text-decoration: underline; }
  ul.links .desc { display: block; color: var(--muted); font-size: 0.82rem; font-weight: 400; }
  .note-body { white-space: pre-wrap; color: var(--text); margin: 0; }
  .status-row {
    display: flex; align-items: center; justify-content: space-between;
    padding: 0.35rem 0; border-bottom: 1px solid var(--border);
  }
  .status-row:last-child { border-bottom: none; }
  .status-row .name { font-weight: 600; }
  .status-row .url { display: block; color: var(--muted); font-size: 0.78rem; font-weight: 400; }
  .badge {
    font-size: 0.72rem; font-weight: 700; text-transform: uppercase;
    padding: 0.1rem 0.5rem; border-radius: 999px; border: 1px solid var(--border);
    color: var(--muted); white-space: nowrap;
  }
  footer { max-width: 1100px; margin: 0 auto; padding: 0 1.5rem 2rem; color: var(--muted); font-size: 0.8rem; }
</style>`;
}

function renderLinkGroup(group) {
  const items = group.links
    .map((link) => {
      const desc =
        typeof link.description === "string" && link.description.length > 0
          ? `<span class="desc">${escapeHtml(link.description)}</span>`
          : "";
      // rel/noopener hardening; target self by default to stay self-contained.
      return `      <li><a href="${escapeHtml(link.url)}" rel="noopener noreferrer">${escapeHtml(
        link.label
      )}</a>${desc}</li>`;
    })
    .join("\n");
  return `    <section class="card">
      <h2>${escapeHtml(group.title)}</h2>
      <ul class="links">
${items}
      </ul>
    </section>`;
}

function renderNote(note) {
  return `    <section class="card">
      <h2>${escapeHtml(note.title)}</h2>
      <p class="note-body">${escapeHtml(note.body)}</p>
    </section>`;
}

function renderStatusPanel(status) {
  const rows = status
    .map((target) => {
      return `      <div class="status-row">
        <span><span class="name">${escapeHtml(target.name)}</span><span class="url">${escapeHtml(
          target.url
        )}</span></span>
        <span class="badge">unchecked</span>
      </div>`;
    })
    .join("\n");
  return `    <section class="card">
      <h2>Status</h2>
${rows}
    </section>`;
}

/**
 * Render a config into a complete, self-contained HTML document.
 * Assumes the config has already been validated.
 * @param {import("./validate.js").Config} config
 * @returns {string}
 */
export function buildHtml(config) {
  const theme = config.theme === "dark" ? "dark" : "light";
  const groups = Array.isArray(config.groups) ? config.groups : [];
  const notes = Array.isArray(config.notes) ? config.notes : [];
  const status = Array.isArray(config.status) ? config.status : [];

  const cards = [];
  for (const g of groups) cards.push(renderLinkGroup(g));
  for (const n of notes) cards.push(renderNote(n));
  if (status.length > 0) cards.push(renderStatusPanel(status));

  const subtitle =
    typeof config.subtitle === "string" && config.subtitle.length > 0
      ? `\n    <p>${escapeHtml(config.subtitle)}</p>`
      : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="startboard">
<title>${escapeHtml(config.title)}</title>
${renderStyle(theme)}
</head>
<body>
  <header>
    <h1>${escapeHtml(config.title)}</h1>${subtitle}
  </header>
  <main>
${cards.join("\n")}
  </main>
  <footer>
    Generated by startboard. Maintained by Cognis Digital.
  </footer>
</body>
</html>
`;
}
