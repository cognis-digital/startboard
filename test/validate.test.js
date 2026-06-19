import { test } from "node:test";
import assert from "node:assert/strict";
import { validateConfig, isSafeUrl } from "../src/validate.js";
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
});

test("missing title is rejected", () => {
  const errors = validateConfig({});
  assert.ok(errors.some((e) => e.includes("title")));
});

test("blank title is rejected", () => {
  const errors = validateConfig({ title: "   " });
  assert.ok(errors.some((e) => e.includes("title")));
});

test("bad theme is rejected", () => {
  const errors = validateConfig({ title: "x", theme: "neon" });
  assert.ok(errors.some((e) => e.includes("theme")));
});

test("link with non-http url is rejected", () => {
  const errors = validateConfig({
    title: "x",
    groups: [{ title: "g", links: [{ label: "bad", url: "javascript:alert(1)" }] }],
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
  const errors = validateConfig({
    title: "x",
    groups: [{ title: "g" }],
  });
  assert.ok(errors.some((e) => e.includes("links")));
});

test("note without body is rejected", () => {
  const errors = validateConfig({
    title: "x",
    notes: [{ title: "n" }],
  });
  assert.ok(errors.some((e) => e.includes("body")));
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

test("isSafeUrl accepts http/https only", () => {
  assert.equal(isSafeUrl("https://a.com"), true);
  assert.equal(isSafeUrl("http://a.com"), true);
  assert.equal(isSafeUrl("javascript:alert(1)"), false);
  assert.equal(isSafeUrl("data:text/html,x"), false);
  assert.equal(isSafeUrl("file:///etc/passwd"), false);
  assert.equal(isSafeUrl("not a url"), false);
  assert.equal(isSafeUrl(""), false);
});
