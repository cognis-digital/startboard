import { test } from "node:test";
import assert from "node:assert/strict";
import { checkTarget, checkAll } from "../src/check.js";

// All tests inject fake probers — no network access ever happens.

test("checkTarget reports up on 200 by default (bare fetcher, legacy form)", async () => {
  const r = await checkTarget({ name: "a", url: "https://a.com" }, async () => ({ status: 200 }));
  assert.equal(r.state, "up");
  assert.equal(r.httpStatus, 200);
  assert.equal(r.type, "http");
  assert.equal(typeof r.ms, "number");
  assert.equal(typeof r.key, "string");
});

test("checkTarget accepts {fetcher} prober object", async () => {
  const r = await checkTarget(
    { name: "a", url: "https://a.com" },
    { fetcher: async () => ({ status: 301 }) }
  );
  assert.equal(r.state, "up"); // 3xx ok by default
});

test("checkTarget reports down on 500", async () => {
  const r = await checkTarget({ name: "a", url: "https://a.com" }, async () => ({ status: 500 }));
  assert.equal(r.state, "down");
  assert.equal(r.httpStatus, 500);
});

test("okStatuses override default range", async () => {
  const r = await checkTarget(
    { name: "a", url: "https://a.com", okStatuses: [200] },
    async () => ({ status: 204 })
  );
  assert.equal(r.state, "down");
});

test("okStatuses can mark a normally-down code as up", async () => {
  const r = await checkTarget(
    { name: "a", url: "https://a.com", okStatuses: [401] },
    async () => ({ status: 401 })
  );
  assert.equal(r.state, "up");
});

test("checkTarget captures fetcher errors as state=error", async () => {
  const r = await checkTarget({ name: "a", url: "https://a.com" }, async () => {
    throw new Error("boom");
  });
  assert.equal(r.state, "error");
  assert.equal(r.error, "boom");
});

test("checkTarget models a timeout via a rejecting fetcher", async () => {
  const r = await checkTarget(
    { name: "a", url: "https://a.com", timeoutMs: 10 },
    { fetcher: async () => { throw new Error("timeout"); } }
  );
  assert.equal(r.state, "error");
  assert.equal(r.error, "timeout");
});

test("checkTarget passes timeoutMs through to fetcher", async () => {
  let seen = null;
  await checkTarget(
    { name: "a", url: "https://a.com", timeoutMs: 1234 },
    { fetcher: async (_u, o) => { seen = o.timeoutMs; return { status: 200 }; } }
  );
  assert.equal(seen, 1234);
});

test("tcp probe: up when the injected prober connects", async () => {
  const r = await checkTarget(
    { name: "db", type: "tcp", url: "localhost:5432" },
    { tcp: async () => ({ connected: true }) }
  );
  assert.equal(r.state, "up");
  assert.equal(r.type, "tcp");
  assert.equal(r.httpStatus, undefined);
});

test("tcp probe: error when the injected prober rejects", async () => {
  const r = await checkTarget(
    { name: "db", type: "tcp", url: "localhost:5432", timeoutMs: 50 },
    { tcp: async () => { throw new Error("ECONNREFUSED"); } }
  );
  assert.equal(r.state, "error");
  assert.equal(r.error, "ECONNREFUSED");
});

test("checkAll probes every target and preserves input order", async () => {
  const config = {
    title: "x",
    status: [
      { name: "one", url: "https://one.com" },
      { name: "two", url: "https://two.com", okStatuses: [200] },
      { name: "db", type: "tcp", url: "localhost:1" },
    ],
  };
  const responses = { "https://one.com": 200, "https://two.com": 503 };
  const results = await checkAll(config, {
    fetcher: async (url) => ({ status: responses[url] }),
    tcp: async () => ({ connected: true }),
  });
  assert.equal(results.length, 3);
  assert.equal(results[0].name, "one");
  assert.equal(results[0].state, "up");
  assert.equal(results[1].name, "two");
  assert.equal(results[1].state, "down");
  assert.equal(results[2].name, "db");
  assert.equal(results[2].state, "up");
});

test("checkAll honors concurrency and still returns ordered results", async () => {
  const n = 20;
  const status = Array.from({ length: n }, (_, i) => ({ name: `s${i}`, url: `https://s${i}.com` }));
  let active = 0;
  let maxActive = 0;
  const fetcher = async () => {
    active++;
    maxActive = Math.max(maxActive, active);
    await new Promise((r) => setTimeout(r, 2));
    active--;
    return { status: 200 };
  };
  const results = await checkAll({ title: "x", status }, { fetcher, concurrency: 4 });
  assert.equal(results.length, n);
  assert.ok(maxActive <= 4, `concurrency respected (saw ${maxActive})`);
  results.forEach((r, i) => assert.equal(r.name, `s${i}`));
});

test("checkAll legacy bare-fetcher form still works", async () => {
  const results = await checkAll(
    { title: "x", status: [{ name: "a", url: "https://a.com" }] },
    async () => ({ status: 200 })
  );
  assert.equal(results[0].state, "up");
});

test("checkAll returns empty for config without status", async () => {
  assert.deepEqual(await checkAll({ title: "x" }, async () => ({ status: 200 })), []);
});
