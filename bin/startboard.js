#!/usr/bin/env node
// @ts-check
// startboard CLI entrypoint.
// Commands: build, validate, new, check, help.

import { readFile, writeFile } from "node:fs/promises";
import { validateConfig } from "../src/validate.js";
import { buildHtml } from "../src/build.js";
import { checkAll } from "../src/check.js";
import { scaffoldConfigJson } from "../src/scaffold.js";
import { loadConfig } from "../src/config.js";
import { themeNames } from "../src/themes.js";

const USAGE = `startboard — self-hosted start-page generator

Usage:
  startboard build <config.json> [options]        Generate self-contained HTML
  startboard validate <config.json>               Validate config (non-zero exit on error)
  startboard new [-o config.json]                 Scaffold a starter config
  startboard check <config.json> [--json]         Probe status targets (network)
  startboard help                                 Show this help

Build options:
  -o, --out <file>       Write HTML to <file> (default: stdout)
  --interactive          Add an inline search-as-you-type filter (adds 1 script)
  --theme <name>         Override theme: ${themeNames().join(", ")}, light, dark
  --css <file>           Inject extra inline CSS from <file> (validated)
  --check                Probe status targets and embed live results (network)
  --concurrency <n>      Max parallel probes for --check / check (default 6)

Check options:
  --json                 Emit machine-readable JSON results
  --concurrency <n>      Max parallel probes (default 6)

Notes:
  build & validate are fully offline. Only check (and build --check) use network.
  The default build emits ZERO JavaScript (CSP-friendly). --interactive adds one
  small inline script; no external resources are ever fetched either way.

Maintained by Cognis Digital. License: COCL 1.0
`;

/**
 * Flag parser. Returns positionals plus known options.
 * @param {string[]} args
 */
function parseArgs(args) {
  /** @type {string[]} */
  const positionals = [];
  const opts = {
    out: /** @type {string|null} */ (null),
    interactive: false,
    json: false,
    check: false,
    theme: /** @type {string|null} */ (null),
    css: /** @type {string|null} */ (null),
    concurrency: /** @type {number|null} */ (null),
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "-o" || a === "--out") opts.out = args[++i] ?? null;
    else if (a.startsWith("--out=")) opts.out = a.slice(6);
    else if (a === "--interactive") opts.interactive = true;
    else if (a === "--json") opts.json = true;
    else if (a === "--check") opts.check = true;
    else if (a === "--theme") opts.theme = args[++i] ?? null;
    else if (a.startsWith("--theme=")) opts.theme = a.slice(8);
    else if (a === "--css") opts.css = args[++i] ?? null;
    else if (a.startsWith("--css=")) opts.css = a.slice(6);
    else if (a === "--concurrency") opts.concurrency = Number(args[++i]);
    else if (a.startsWith("--concurrency=")) opts.concurrency = Number(a.slice(14));
    else positionals.push(a);
  }
  return { positionals, opts };
}

function fail(message) {
  process.stderr.write(`error: ${message}\n`);
  process.exitCode = 1;
}

function printErrors(path, errors) {
  process.stderr.write(`invalid config "${path}":\n`);
  for (const e of errors) process.stderr.write(`  - ${e}\n`);
  process.exitCode = 1;
}

async function cmdValidate(path) {
  const config = await loadConfig(path);
  const errors = validateConfig(config);
  if (errors.length > 0) return printErrors(path, errors);
  process.stdout.write(`ok: "${path}" is a valid startboard config\n`);
}

async function cmdBuild(path, opts) {
  const config = await loadConfig(path);
  const errors = validateConfig(config);
  if (errors.length > 0) return printErrors(path, errors);

  if (opts.theme) config.theme = opts.theme;
  let css;
  if (opts.css) css = await readFile(opts.css, "utf8");

  /** @type {import("../src/build.js").BuildOptions} */
  const buildOpts = { interactive: opts.interactive, css };

  if (opts.check) {
    const probeOpts = opts.concurrency ? { concurrency: opts.concurrency } : {};
    // Gather all status targets across the top-level config and any boards.
    const allStatus = [
      ...(Array.isArray(config.status) ? config.status : []),
      ...(Array.isArray(config.boards)
        ? config.boards.flatMap((b) => (Array.isArray(b.status) ? b.status : []))
        : []),
    ];
    const results = await checkAll({ ...config, status: allStatus }, probeOpts);
    buildOpts.results = results;
    buildOpts.checkedAt = new Date().toISOString();
  }

  const html = buildHtml(config, buildOpts);
  if (opts.out) {
    await writeFile(opts.out, html, "utf8");
    process.stdout.write(`wrote ${opts.out} (${Buffer.byteLength(html)} bytes)\n`);
  } else {
    process.stdout.write(html);
  }
}

async function cmdNew(out) {
  const json = scaffoldConfigJson();
  if (out) {
    await writeFile(out, json, "utf8");
    process.stdout.write(`wrote ${out}\n`);
  } else {
    process.stdout.write(json);
  }
}

async function cmdCheck(path, opts) {
  const config = await loadConfig(path);
  const errors = validateConfig(config);
  if (errors.length > 0) return printErrors(path, errors);

  const allStatus = [
    ...(Array.isArray(config.status) ? config.status : []),
    ...(Array.isArray(config.boards)
      ? config.boards.flatMap((b) => (Array.isArray(b.status) ? b.status : []))
      : []),
  ];
  if (allStatus.length === 0) {
    if (opts.json) process.stdout.write("[]\n");
    else process.stdout.write("no status targets defined\n");
    return;
  }

  const probeOpts = opts.concurrency ? { concurrency: opts.concurrency } : {};
  const results = await checkAll({ ...config, status: allStatus }, probeOpts);

  if (opts.json) {
    process.stdout.write(JSON.stringify(results, null, 2) + "\n");
  } else {
    for (const r of results) {
      const detail =
        r.state === "error"
          ? `error: ${r.error}`
          : r.type === "tcp"
          ? `connected in ${r.ms}ms`
          : `${r.httpStatus} in ${r.ms}ms`;
      process.stdout.write(`[${r.state.toUpperCase()}] ${r.name} (${r.url}) — ${detail}\n`);
    }
  }
  if (results.some((r) => r.state !== "up")) process.exitCode = 2;
}

async function main() {
  const argv = process.argv.slice(2);
  const command = argv[0];
  const { positionals, opts } = parseArgs(argv.slice(1));

  if (!command || command === "help" || command === "--help" || command === "-h") {
    process.stdout.write(USAGE);
    return;
  }

  try {
    switch (command) {
      case "validate": {
        if (!positionals[0]) return fail("validate requires <config.json>");
        return await cmdValidate(positionals[0]);
      }
      case "build": {
        if (!positionals[0]) return fail("build requires <config.json>");
        return await cmdBuild(positionals[0], opts);
      }
      case "new":
        return await cmdNew(opts.out);
      case "check": {
        if (!positionals[0]) return fail("check requires <config.json>");
        return await cmdCheck(positionals[0], opts);
      }
      default:
        return fail(`unknown command "${command}". Run "startboard help".`);
    }
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err));
  }
}

main();
