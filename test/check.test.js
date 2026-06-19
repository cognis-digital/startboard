import { test } from "node:test";
import assert from "node:assert/strict";
import { checkTarget, checkAll } from "../src/check.js";

// All tests inject a fake fetcher — no network access ever happens.

test("checkTarget reports up on 200 by default", async () => {
  const fake = async () => ({ status: 200 });
  const r = await checkTarget({ name: "a", url: "https://a.com" }, fake);
  assert.equal(r.state, "up");
  assert.equal(r.httpStatus, 200);
  assert.equal(typeof r.ms, "number");
});

test("checkTarget reports down on 500", async () => {
  const fake = async () => ({ status: 500 });
  const r = await checkTarget({ name: "a", url: "https://a.com" }, fake);
  assert.equal(r.state, "down");
  assert.equal(r.httpStatus, 500);
});

test("okStatuses override default range", async () => {
  const fake = async () => ({ status: 204 });
  // 204 is in default ok range, but restrict to [200] only -> down.
  const r = await checkTarget(
    { name: "a", url: "https://a.com", okStatuses: [200] },
    fake
  );
  assert.equal(r.state, "down");
});

test("okStatuses can mark a normally-down code as up", async () => {
  const fake = async () => ({ status: 401 });
  const r = await checkTarget(
    { name: "a", url: "https://a.com", okStatuses: [401] },
    fake
  );
  assert.equal(r.state, "up");
});

test("checkTarget captures fetcher errors as state=error", async () => {
  const fake = async () => {
    throw new Error("boom");
  };
  const r = await checkTarget({ name: "a", url: "https://a.com" }, fake);
  assert.equal(r.state, "error");
  assert.equal(r.error, "boom");
});

test("checkTarget passes timeoutMs through to fetcher", async () => {
  let seen = null;
  const fake = async (_url, opts) => {
    seen = opts.timeoutMs;
    return { status: 200 };
  };
  await checkTarget({ name: "a", url: "https://a.com", timeoutMs: 1234 }, fake);
  assert.equal(seen, 1234);
});

test("checkAll probes every target in order", async () => {
  const config = {
    title: "x",
    status: [
      { name: "one", url: "https://one.com" },
      { name: "two", url: "https://two.com", okStatuses: [200] },
    ],
  };
  const responses = { "https://one.com": 200, "https://two.com": 503 };
  const fake = async (url) => ({ status: responses[url] });
  const results = await checkAll(config, fake);
  assert.equal(results.length, 2);
  assert.equal(results[0].name, "one");
  assert.equal(results[0].state, "up");
  assert.equal(results[1].name, "two");
  assert.equal(results[1].state, "down");
});

test("checkAll returns empty for config without status", async () => {
  const fake = async () => ({ status: 200 });
  const results = await checkAll({ title: "x" }, fake);
  assert.deepEqual(results, []);
});
