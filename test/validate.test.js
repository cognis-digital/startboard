import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateConfig,
  isSafeUrl,
  isHostPort,
  isSafeCss,
} from "../src/validate.js";
import { scaffoldConfig } from "../src/scaffold.js";

test("scaffold config validates clean", () => {
  assert.deepEqual(validateConfig(scaffoldConfig()), []);
});

test("minimal config (title only) is valid", () => {
  assert.deepEqual(validateConfig({ title: "Hi" }), []);
});

test("non-object config is rejected", () => {
  assert.ok(validateConfig(null).length > 0);
  assert.ok(validateConfig("nope").length > 0);
  assert.ok(validateConfig([]).length > 0);
  assert.ok(validateConfig(42).length > 0);
});

test("missing title is rejected", () => {
  assert.ok(validateConfig({}).some((e) => e.includes("title")));
});

test("blank title is rejected", () => {
  assert.ok(validateConfig({ title: "   " }).some((e) => e.includes("title")));
});

test("bad theme is rejected", () => {
  assert.ok(validateConfig({ title: "x", theme: "neon" }).some((e) => e.includes("theme")));
});

test("all built-in theme names are accepted", () => {
  for (const t of ["slate", "terminal", "amber", "ocean", "light", "dark"]) {
    assert.deepEqual(validateConfig({ title: "x", theme: t }), [], `theme ${t}`);
  }
});

test("link with non-http url is rejected", () => {
  const errors = validateConfig({
    title: "x",
    groups: [{ title: "g", links: [{ label: "bad", url: "javascript:alert(1)" }] }],
  });
  assert.ok(errors.some((e) => e.includes("http(s)")));
});

test("link with data: url is rejected", () => {
  const errors = validateConfig({
    title: "x",
    groups: [{ title: "g", links: [{ label: "bad", url: "data:text/html,<b>" }] }],
  });
  assert.ok(errors.some((e) => e.includes("http(s)")));
});

test("link missing label is rejected", () => {
  const errors = validateConfig({
    title: "x",
    groups: [{ title: "g", links: [{ url: "https://ok.com" }] }],
  });
  assert.ok(errors.some((e) => e.includes("label")));
});

test("group without links array is rejected", () => {
  assert.ok(
    validateConfig({ title: "x", groups: [{ title: "g" }] }).some((e) => e.includes("links"))
  );
});

test("group.collapsed must be boolean", () => {
  const errors = validateConfig({
    title: "x",
    groups: [{ title: "g", collapsed: "yes", links: [] }],
  });
  assert.ok(errors.some((e) => e.includes("collapsed")));
});

test("group/link icon must be a string", () => {
  const errors = validateConfig({
    title: "x",
    groups: [{ title: "g", icon: 5, links: [{ label: "a", url: "https://a.com", icon: {} }] }],
  });
  assert.ok(errors.some((e) => e.includes(".icon")));
});

test("note without body is rejected", () => {
  assert.ok(
    validateConfig({ title: "x", notes: [{ title: "n" }] }).some((e) => e.includes("body"))
  );
});

test("note.markdown must be boolean", () => {
  const errors = validateConfig({
    title: "x",
    notes: [{ title: "n", body: "b", markdown: "true" }],
  });
  assert.ok(errors.some((e) => e.includes("markdown")));
});

test("status target with bad timeout is rejected", () => {
  const errors = validateConfig({
    title: "x",
    status: [{ name: "s", url: "https://ok.com", timeoutMs: -1 }],
  });
  assert.ok(errors.some((e) => e.includes("timeoutMs")));
});

test("status target with non-integer okStatuses is rejected", () => {
  const errors = validateConfig({
    title: "x",
    status: [{ name: "s", url: "https://ok.com", okStatuses: ["200"] }],
  });
  assert.ok(errors.some((e) => e.includes("okStatuses")));
});

test("tcp status target requires host:port", () => {
  const bad = validateConfig({
    title: "x",
    status: [{ name: "s", type: "tcp", url: "https://ok.com" }],
  });
  assert.ok(bad.some((e) => e.includes("host:port")));
  const good = validateConfig({
    title: "x",
    status: [{ name: "s", type: "tcp", url: "localhost:5432" }],
  });
  assert.deepEqual(good, []);
});

test("bad status type is rejected", () => {
  const errors = validateConfig({
    title: "x",
    status: [{ name: "s", type: "ping", url: "https://ok.com" }],
  });
  assert.ok(errors.some((e) => e.includes("type")));
});

test("boards are validated recursively", () => {
  const errors = validateConfig({
    title: "x",
    boards: [{ title: "b", groups: [{ title: "g", links: [{ label: "a" }] }] }],
  });
  assert.ok(errors.some((e) => e.includes("config.boards[0].groups[0].links[0].url")));
});

test("board without title is rejected", () => {
  assert.ok(
    validateConfig({ title: "x", boards: [{ groups: [] }] }).some((e) =>
      e.includes("boards[0].title")
    )
  );
});

test("unsafe css is rejected", () => {
  assert.ok(
    validateConfig({ title: "x", css: "@import url(http://evil)" }).some((e) => e.includes("css"))
  );
  assert.ok(
    validateConfig({ title: "x", css: ".a{background:url(https://x/y.png)}" }).some((e) =>
      e.includes("css")
    )
  );
  assert.deepEqual(validateConfig({ title: "x", css: ".a{color:red}" }), []);
});

test("isSafeUrl accepts http/https only", () => {
  assert.equal(isSafeUrl("https://a.com"), true);
  assert.equal(isSafeUrl("http://a.com"), true);
  assert.equal(isSafeUrl("javascript:alert(1)"), false);
  assert.equal(isSafeUrl("data:text/html,x"), false);
  assert.equal(isSafeUrl("file:///etc/passwd"), false);
  assert.equal(isSafeUrl("not a url"), false);
  assert.equal(isSafeUrl(""), false);
});

test("isHostPort validates host:port", () => {
  assert.equal(isHostPort("localhost:5432"), true);
  assert.equal(isHostPort("10.0.0.1:80"), true);
  assert.equal(isHostPort("db.internal:65535"), true);
  assert.equal(isHostPort("nope"), false);
  assert.equal(isHostPort("host:99999"), false);
  assert.equal(isHostPort("host:0"), false);
});

test("isSafeCss rejects fetch vectors", () => {
  assert.equal(isSafeCss(".a{color:red}"), true);
  assert.equal(isSafeCss("@import 'x'"), false);
  assert.equal(isSafeCss(".a{background:url(data:x)}"), false);
  assert.equal(isSafeCss(".a{width:expression(alert(1))}"), false);
  assert.equal(isSafeCss("</style><script>x</script>"), false);
});
