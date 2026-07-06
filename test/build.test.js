import { test } from "node:test";
import assert from "node:assert/strict";
import { buildHtml, escapeHtml, statusKey } from "../src/build.js";
import { scaffoldConfig } from "../src/scaffold.js";

const sample = scaffoldConfig();

/**
 * Assert an HTML string is fully self-contained: no off-document fetches of any
 * kind. The ONLY external http(s) references permitted are user link/status
 * URLs (they are anchor href targets, not resources the page loads).
 * @param {string} html
 * @param {string[]} allowedUrls
 */
function assertSelfContained(html, allowedUrls) {
  assert.equal(/<link\b/i.test(html), false, "no <link> tags");
  assert.equal(/<img[^>]+src\s*=\s*["']https?:/i.test(html), false, "no remote <img>");
  assert.equal(/@import/i.test(html), false, "no @import");
  // No CSS url() pointing off-document (data: url would be same-doc, still we use none).
  assert.equal(/url\(\s*["']?\s*(https?:|\/\/)/i.test(html), false, "no remote css url()");
  // No <script src=...>
  assert.equal(/<script[^>]+src=/i.test(html), false, "no external script src");
  // Every http(s) occurrence must be an allowed user URL.
  const refs = html.match(/https?:\/\/[^\s"'<>]+/g) || [];
  for (const ref of refs) {
    // The xmlns namespace URI in an inline SVG is not a fetch; skip it.
    if (ref.startsWith("http://www.w3.org/2000/svg")) continue;
    assert.ok(allowedUrls.includes(ref), `unexpected external reference: ${ref}`);
  }
}

function sampleUrls(cfg) {
  const urls = [];
  for (const g of cfg.groups || []) for (const l of g.links) urls.push(l.url);
  for (const s of cfg.status || []) urls.push(s.url);
  for (const b of cfg.boards || []) {
    for (const g of b.groups || []) for (const l of g.links) urls.push(l.url);
    for (const s of b.status || []) urls.push(s.url);
  }
  return urls;
}

test("build produces a complete HTML document", () => {
  const html = buildHtml(sample);
  assert.ok(html.startsWith("<!DOCTYPE html>"));
  assert.ok(html.includes("<title>My Start Board</title>"));
  assert.ok(html.trimEnd().endsWith("</html>"));
});

test("default build is self-contained with ZERO external refs beyond user URLs", () => {
  const html = buildHtml(sample);
  assertSelfContained(html, sampleUrls(sample));
});

test("default build has NO <script> tags (CSP-friendly)", () => {
  const html = buildHtml(sample);
  assert.equal(/<script\b/i.test(html), false, "default output must be script-free");
});

test("default build has no inline event handlers", () => {
  const html = buildHtml(sample);
  assert.equal(/\son\w+\s*=/i.test(html), false, "no on* handlers");
});

test("--interactive adds exactly one inline script (still no external refs)", () => {
  const html = buildHtml(sample, { interactive: true });
  const scripts = html.match(/<script\b/gi) || [];
  assert.equal(scripts.length, 1, "exactly one inline script");
  assert.equal(/<script[^>]+src=/i.test(html), false, "script is inline, not external");
  assert.ok(html.includes('id="sb-search"'), "search box present");
  assertSelfContained(html, sampleUrls(sample));
});

test("build escapes HTML in user content (XSS attempt stays escaped)", () => {
  const cfg = {
    title: 'T<script>"&\'',
    groups: [
      {
        title: "<b>g</b>",
        links: [{ label: "<i>x</i>", url: "https://ok.com", description: "a&b" }],
      },
    ],
    notes: [{ title: "n<x>", body: "1 < 2 & 3 > 0", markdown: false }],
  };
  const html = buildHtml(cfg);
  assert.equal(html.includes("<script>T"), false);
  assert.ok(html.includes("T&lt;script&gt;"));
  assert.ok(html.includes("&lt;b&gt;g&lt;/b&gt;"));
  assert.ok(html.includes("1 &lt; 2 &amp; 3 &gt; 0"));
});

test("markdown note with injected script stays inert", () => {
  const cfg = {
    title: "x",
    notes: [{ title: "n", body: "<script>alert(1)</script>\n\n**bold** [x](javascript:alert(1))" }],
  };
  const html = buildHtml(cfg);
  assert.equal(html.includes("<script>alert"), false);
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(html.includes("<strong>bold</strong>"));
  // javascript: link must NOT become an anchor
  assert.equal(/<a href="javascript:/i.test(html), false);
});

test("status panel renders unchecked badges when no results injected", () => {
  const html = buildHtml(sample);
  assert.ok(html.includes("Status"));
  assert.ok(html.includes("unchecked"));
});

test("injected check results render up/down/error badges + timestamp", () => {
  const results = [
    { name: "Example", url: "https://example.com", type: "http", state: "up", httpStatus: 200, ms: 12, key: statusKey(sample.status[0]) },
  ];
  const html = buildHtml(sample, { results, checkedAt: "2026-01-01T00:00:00Z" });
  assert.ok(html.includes('class="badge up"'));
  assert.ok(html.includes("200 · 12ms"));
  assert.ok(html.includes("Last checked: 2026-01-01T00:00:00Z"));
});

test("themes change inline variables; legacy dark/light still work", () => {
  const dark = buildHtml({ title: "x", theme: "dark" });
  const light = buildHtml({ title: "x", theme: "light" });
  assert.notEqual(dark, light);
  assert.ok(dark.includes("--bg: #14171c"));
  assert.ok(light.includes("--bg: #f4f5f7"));
  const terminal = buildHtml({ title: "x", theme: "terminal" });
  assert.ok(terminal.includes("prefers-color-scheme: dark"), "auto dark mode present");
  assert.ok(terminal.includes("#25d366"), "terminal accent present");
});

test("collapsed group renders <details> without open", () => {
  const cfg = {
    title: "x",
    groups: [
      { title: "Open", links: [{ label: "a", url: "https://a.com" }] },
      { title: "Shut", collapsed: true, links: [{ label: "b", url: "https://b.com" }] },
    ],
  };
  const html = buildHtml(cfg);
  assert.ok(html.includes("<details class=\"group\" open>"));
  assert.ok(html.includes("<details class=\"group\">"));
});

test("multi-board config renders CSS-only radio tabs", () => {
  const cfg = {
    title: "x",
    boards: [
      { title: "Alpha", groups: [{ title: "g", links: [{ label: "a", url: "https://a.com" }] }] },
      { title: "Beta", notes: [{ title: "n", body: "hi" }] },
    ],
  };
  const html = buildHtml(cfg);
  assert.ok(html.includes('type="radio" name="sb-board" id="tab-0" checked'));
  assert.ok(html.includes('id="tab-1"'));
  assert.ok(html.includes('label for="tab-0"'));
  assert.ok(html.includes('id="panel-1"'));
  // still no script in default multi-board
  assert.equal(/<script\b/i.test(html), false);
  assertSelfContained(html, sampleUrls(cfg));
});

test("icons: emoji renders as text, glyph renders as data-URI svg (same-doc)", () => {
  const cfg = {
    title: "x",
    groups: [
      { title: "E", icon: "📈", links: [{ label: "a", url: "https://a.com" }] },
      { title: "G", icon: "glyph:chart", links: [{ label: "b", url: "https://b.com", icon: "glyph:book" }] },
    ],
  };
  const html = buildHtml(cfg);
  assert.ok(html.includes("📈"));
  assert.ok(html.includes("src=\"data:image/svg+xml,"), "glyph became inline data URI");
  // data URI is same-document, not an external fetch
  assertSelfContained(html, sampleUrls(cfg));
});

test("custom css is injected and honored", () => {
  const html = buildHtml({ title: "x" }, { css: ".card{border-radius:0}" });
  assert.ok(html.includes(".card{border-radius:0}"));
});

test("group/note/link order is respected", () => {
  const cfg = {
    title: "x",
    groups: [
      { title: "Second", order: 2, links: [{ label: "a", url: "https://a.com" }] },
      { title: "First", order: 1, links: [{ label: "b", url: "https://b.com" }] },
    ],
  };
  const html = buildHtml(cfg);
  assert.ok(html.indexOf("First") < html.indexOf("Second"));
});

test("escapeHtml handles all five entities", () => {
  assert.equal(escapeHtml(`<>&"'`), "&lt;&gt;&amp;&quot;&#39;");
});

test("empty config (title only) still builds valid shell", () => {
  const html = buildHtml({ title: "Bare" });
  assert.ok(html.includes("<title>Bare</title>"));
  assert.ok(html.includes("<main"));
});
