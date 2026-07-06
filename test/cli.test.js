import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const run = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const BIN = join(here, "..", "bin", "startboard.js");
const EXAMPLE = join(here, "..", "examples", "config.json");

function cli(args, opts = {}) {
  return run(process.execPath, [BIN, ...args], opts).then(
    (ok) => ({ code: 0, ...ok }),
    (err) => ({ code: err.code ?? 1, stdout: err.stdout ?? "", stderr: err.stderr ?? "" })
  );
}

test("help prints usage", async () => {
  const { code, stdout } = await cli(["help"]);
  assert.equal(code, 0);
  assert.ok(stdout.includes("startboard"));
  assert.ok(stdout.includes("build"));
  assert.ok(stdout.includes("--interactive"));
});

test("validate passes on the shipped example (CI gate)", async () => {
  const { code, stdout } = await cli(["validate", EXAMPLE]);
  assert.equal(code, 0);
  assert.ok(stdout.includes("ok"));
});

test("validate exits non-zero on a broken config", async () => {
  const dir = await mkdtemp(join(tmpdir(), "sb-"));
  try {
    const bad = join(dir, "bad.json");
    await writeFile(bad, JSON.stringify({ subtitle: "no title" }), "utf8");
    const { code, stderr } = await cli(["validate", bad]);
    assert.notEqual(code, 0);
    assert.ok(stderr.includes("title"));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("validate reports invalid JSON clearly", async () => {
  const dir = await mkdtemp(join(tmpdir(), "sb-"));
  try {
    const bad = join(dir, "bad.json");
    await writeFile(bad, "{ not json", "utf8");
    const { code, stderr } = await cli(["validate", bad]);
    assert.notEqual(code, 0);
    assert.ok(stderr.includes("not valid JSON"));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("new scaffolds a config that validates", async () => {
  const dir = await mkdtemp(join(tmpdir(), "sb-"));
  try {
    const cfg = join(dir, "config.json");
    assert.equal((await cli(["new", "-o", cfg])).code, 0);
    assert.equal((await cli(["validate", cfg])).code, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("build writes a self-contained HTML file (no <script>, no <link>)", async () => {
  const dir = await mkdtemp(join(tmpdir(), "sb-"));
  try {
    const outPath = join(dir, "board.html");
    const { code, stdout } = await cli(["build", EXAMPLE, "-o", outPath]);
    assert.equal(code, 0);
    assert.ok(stdout.includes("bytes"));
    const html = await readFile(outPath, "utf8");
    assert.ok(html.startsWith("<!DOCTYPE html>"));
    assert.equal(/<script\b/i.test(html), false);
    assert.equal(/<link\b/i.test(html), false);
    assert.equal(/<img[^>]+src\s*=\s*["']https?:/i.test(html), false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("build --interactive adds one inline script", async () => {
  const { code, stdout } = await cli(["build", EXAMPLE, "--interactive"]);
  assert.equal(code, 0);
  assert.equal((stdout.match(/<script\b/gi) || []).length, 1);
  assert.equal(/<script[^>]+src=/i.test(stdout), false);
});

test("build --theme overrides theme", async () => {
  const { code, stdout } = await cli(["build", EXAMPLE, "--theme", "amber"]);
  assert.equal(code, 0);
  assert.ok(stdout.includes("#e8a33d") || stdout.includes("#b5651d"));
});

test("build to stdout when no -o", async () => {
  const { code, stdout } = await cli(["build", EXAMPLE]);
  assert.equal(code, 0);
  assert.ok(stdout.startsWith("<!DOCTYPE html>"));
});

test("build resolves includes", async () => {
  const dir = await mkdtemp(join(tmpdir(), "sb-"));
  try {
    await writeFile(
      join(dir, "base.json"),
      JSON.stringify({ groups: [{ title: "Base", links: [{ label: "b", url: "https://b.com" }] }] }),
      "utf8"
    );
    await writeFile(
      join(dir, "main.json"),
      JSON.stringify({ title: "Combined", include: ["./base.json"] }),
      "utf8"
    );
    const { code, stdout } = await cli(["build", join(dir, "main.json")]);
    assert.equal(code, 0);
    assert.ok(stdout.includes("Combined"));
    assert.ok(stdout.includes("Base"));
    assert.ok(stdout.includes("https://b.com"));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("unknown command exits non-zero", async () => {
  const { code, stderr } = await cli(["frobnicate"]);
  assert.notEqual(code, 0);
  assert.ok(stderr.includes("unknown command"));
});

test("build on missing file errors cleanly", async () => {
  const { code, stderr } = await cli(["build", "does-not-exist.json"]);
  assert.notEqual(code, 0);
  assert.ok(stderr.includes("cannot read"));
});
