import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mergeConfig, loadConfig, parseConfig } from "../src/config.js";
import { validateConfig } from "../src/validate.js";

test("mergeConfig concatenates array fields and overrides scalars", () => {
  const base = { title: "A", groups: [{ title: "g1", links: [] }] };
  const over = { title: "B", groups: [{ title: "g2", links: [] }], subtitle: "s" };
  const merged = mergeConfig(base, over);
  assert.equal(merged.title, "B");
  assert.equal(merged.subtitle, "s");
  assert.equal(merged.groups.length, 2);
  assert.equal(merged.groups[0].title, "g1");
  assert.equal(merged.groups[1].title, "g2");
});

test("parseConfig gives a helpful error on bad JSON", () => {
  assert.throws(() => parseConfig("{ not json", "x.json"), /not valid JSON/);
});

test("loadConfig resolves and merges includes (real tmpdir files)", async () => {
  const dir = await mkdtemp(join(tmpdir(), "sb-inc-"));
  try {
    await writeFile(
      join(dir, "base.json"),
      JSON.stringify({
        theme: "terminal",
        groups: [{ title: "base-group", links: [{ label: "b", url: "https://b.com" }] }],
      }),
      "utf8"
    );
    await writeFile(
      join(dir, "main.json"),
      JSON.stringify({
        include: ["./base.json"],
        title: "Main",
        groups: [{ title: "main-group", links: [{ label: "m", url: "https://m.com" }] }],
      }),
      "utf8"
    );
    const cfg = await loadConfig(join(dir, "main.json"));
    assert.equal(cfg.title, "Main");
    assert.equal(cfg.theme, "terminal"); // from base
    assert.equal(cfg.groups.length, 2);
    assert.equal(cfg.groups[0].title, "base-group"); // includes first
    assert.equal(cfg.groups[1].title, "main-group");
    assert.equal(cfg.include, undefined, "include key stripped after merge");
    assert.deepEqual(validateConfig(cfg), []);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("loadConfig detects include cycles", async () => {
  const dir = await mkdtemp(join(tmpdir(), "sb-cyc-"));
  try {
    await writeFile(join(dir, "a.json"), JSON.stringify({ title: "A", include: ["./b.json"] }), "utf8");
    await writeFile(join(dir, "b.json"), JSON.stringify({ title: "B", include: ["./a.json"] }), "utf8");
    await assert.rejects(() => loadConfig(join(dir, "a.json")), /cycle/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("loadConfig surfaces missing-file errors", async () => {
  const reader = async () => { throw new Error("nope"); };
  await assert.rejects(() => loadConfig("missing.json", reader), /cannot read config/);
});
