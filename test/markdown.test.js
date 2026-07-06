import { test } from "node:test";
import assert from "node:assert/strict";
import { renderMarkdown } from "../src/markdown.js";

test("empty input yields empty output", () => {
  assert.equal(renderMarkdown(""), "");
  assert.equal(renderMarkdown(null), "");
});

test("paragraphs and hard line breaks", () => {
  const html = renderMarkdown("line one\nline two\n\nsecond para");
  assert.ok(html.includes("<p>line one<br>line two</p>"));
  assert.ok(html.includes("<p>second para</p>"));
});

test("bold and italic", () => {
  assert.ok(renderMarkdown("**b** and *i*").includes("<strong>b</strong>"));
  assert.ok(renderMarkdown("**b** and *i*").includes("<em>i</em>"));
  assert.ok(renderMarkdown("__b__ and _i_").includes("<strong>b</strong>"));
});

test("inline code and fenced code", () => {
  assert.ok(renderMarkdown("use `npm test`").includes("<code>npm test</code>"));
  const fenced = renderMarkdown("```\nline1\nline2\n```");
  assert.ok(fenced.includes("<pre><code>line1\nline2</code></pre>"));
});

test("unordered and ordered lists", () => {
  const ul = renderMarkdown("- a\n- b");
  assert.ok(ul.includes("<ul>"));
  assert.ok(ul.includes("<li>a</li>"));
  const ol = renderMarkdown("1. a\n2. b");
  assert.ok(ol.includes("<ol>"));
  assert.ok(ol.includes("<li>a</li>"));
});

test("headings map # to h3..h6", () => {
  assert.ok(renderMarkdown("# Title").includes("<h3>Title</h3>"));
  assert.ok(renderMarkdown("### Deep").includes("<h5>Deep</h5>"));
});

test("blockquote and horizontal rule", () => {
  assert.ok(renderMarkdown("> quoted").includes("<blockquote>quoted</blockquote>"));
  assert.ok(renderMarkdown("---").includes("<hr>"));
});

test("safe links only: http/https become anchors, others stay literal", () => {
  assert.ok(
    renderMarkdown("[ok](https://a.com)").includes('<a href="https://a.com" rel="noopener noreferrer">ok</a>')
  );
  const bad = renderMarkdown("[x](javascript:alert(1))");
  assert.equal(/<a /.test(bad), false);
  assert.ok(bad.includes("[x]"));
});

test("HTML in markdown is escaped, never passed through", () => {
  const html = renderMarkdown("<script>alert(1)</script>\n\n<b>not bold</b>");
  assert.equal(html.includes("<script>"), false);
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(html.includes("&lt;b&gt;not bold&lt;/b&gt;"));
});

test("code span with angle brackets stays escaped", () => {
  const html = renderMarkdown("`<div>`");
  assert.ok(html.includes("<code>&lt;div&gt;</code>"));
});

test("XSS via link label is escaped", () => {
  const html = renderMarkdown('[<img src=x onerror=alert(1)>](https://a.com)');
  assert.equal(html.includes("<img"), false);
  assert.ok(html.includes("&lt;img"));
});
