import { test } from "node:test";
import assert from "node:assert/strict";
import { buildHtml, escapeHtml } from "../src/build.js";
import { scaffoldConfig } from "../src/scaffold.js";

const sample = scaffoldConfig();

test("build produces a complete HTML document", () => {
  const html = buildHtml(sample);
  assert.ok(html.startsWith("<!DOCTYPE html>"));
  assert.ok(html.includes("<title>My Start Board</title>"));
  assert.ok(html.trimEnd().endsWith("</html>"));
});

test("build is self-contained: no external links/scripts/assets", () => {
  const html = buildHtml(sample);
  // No <script> tags at all.
  assert.equal(/<script\b/i.test(html), false, "must contain no <script> tags");
  // No external stylesheets / link rel.
  assert.equal(/<link\b/i.test(html), false, "must contain no <link> tags");
  // No <img>.
  assert.equal(/<img\b/i.test(html), false, "must contain no <img> tags");
  // No @import or url() in CSS pointing off-document.
  assert.equal(/@import/i.test(html), false, "must contain no @import");
  assert.equal(/url\(/i.test(html), false, "must contain no css url()");
});

test("only off-document references are user bookmark href values", () => {
  const html = buildHtml(sample);
  // Collect every http(s) occurrence and confirm each lives in an href= we put there.
  const httpRefs = html.match(/https?:\/\/[^\s"'<>]+/g) || [];
  for (const ref of httpRefs) {
    // Each external URL must come from the config's own links.
    const fromConfig = sample.groups
      .flatMap((g) => g.links)
      .some((l) => l.url === ref);
    const fromStatus = (sample.status || []).some((s) => s.url === ref);
    assert.ok(
      fromConfig || fromStatus,
      `unexpected external reference in output: ${ref}`
    );
  }
});

test("build escapes HTML in user content", () => {
  const cfg = {
    title: 'T<script>"&\'',
    groups: [
      {
        title: "<b>g</b>",
        links: [{ label: "<i>x</i>", url: "https://ok.com", description: "a&b" }],
      },
    ],
    notes: [{ title: "n<x>", body: "1 < 2 & 3 > 0" }],
  };
  const html = buildHtml(cfg);
  assert.equal(html.includes("<script>"), false);
  assert.ok(html.includes("T&lt;script&gt;"));
  assert.ok(html.includes("&lt;b&gt;g&lt;/b&gt;"));
  assert.ok(html.includes("1 &lt; 2 &amp; 3 &gt; 0"));
});

test("status panel renders unchecked badges (static build is offline)", () => {
  const html = buildHtml(sample);
  assert.ok(html.includes("Status"));
  assert.ok(html.includes("unchecked"));
});

test("dark vs light theme changes inline variables", () => {
  const dark = buildHtml({ title: "x", theme: "dark" });
  const light = buildHtml({ title: "x", theme: "light" });
  assert.notEqual(dark, light);
  assert.ok(dark.includes("--bg: #14171c"));
  assert.ok(light.includes("--bg: #f4f5f7"));
});

test("escapeHtml handles all five entities", () => {
  assert.equal(escapeHtml(`<>&"'`), "&lt;&gt;&amp;&quot;&#39;");
});

test("empty config (title only) still builds valid shell", () => {
  const html = buildHtml({ title: "Bare" });
  assert.ok(html.includes("<title>Bare</title>"));
  assert.ok(html.includes("<main>"));
});
