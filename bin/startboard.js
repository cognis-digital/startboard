#!/usr/bin/env node
// startboard CLI entrypoint.
// Commands: build, validate, new, check, help.

import { readFile, writeFile } from "node:fs/promises";
import { validateConfig } from "../src/validate.js";
import { buildHtml } from "../src/build.js";
import { checkAll } from "../src/check.js";
import { scaffoldConfigJson } from "../src/scaffold.js";

const USAGE = `startboard — self-hosted start-page generator

Usage:
  startboard build <config.json> [-o board.html]   Generate self-contained HTML
  startboard validate <config.json>                Validate config (non-zero exit on error)
  startboard new [-o config.json]                  Scaffold a starter config
  startboard check <config.json>                   Probe status targets (network)
  startboard help                                  Show this help

Maintained by Cognis Digital. License: COCL 1.0
`;

/**
 * Minimal flag parser: pulls out -o/--out and returns positionals + out.
 * @param {string[]} args
 */
function parseArgs(args) {
  const positionals = [];
  let out = null;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "-o" || a === "--out") {
      out = args[i + 1] ?? null;
      i++;
    } else if (a.startsWith("--out=")) {
      out = a.slice("--out=".length);
    } else {
      positionals.push(a);
    }
  }
  return { positionals, out };
}

async function loadConfig(path) {
  let raw;
  try {
    raw = await readFile(path, "utf8");
  } catch (err) {
    throw new Error(`cannot read config "${path}": ${err.message}`);
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`config "${path}" is not valid JSON: ${err.message}`);
  }
}

function fail(message) {
  process.stderr.write(`error: ${message}\n`);
  process.exitCode = 1;
}

async function cmdValidate(config, path) {
  const errors = validateConfig(config);
  if (errors.length > 0) {
    process.stderr.write(`invalid config "${path}":\n`);
    for (const e of errors) process.stderr.write(`  - ${e}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`ok: "${path}" is a valid startboard config\n`);
}

async function cmdBuild(config, path, out) {
  const errors = validateConfig(config);
  if (errors.length > 0) {
    process.stderr.write(`invalid config "${path}":\n`);
    for (const e of errors) process.stderr.write(`  - ${e}\n`);
    process.exitCode = 1;
    return;
  }
  const html = buildHtml(config);
  if (out) {
    await writeFile(out, html, "utf8");
    process.stdout.write(`wrote ${out}\n`);
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

async function cmdCheck(config, path) {
  const errors = validateConfig(config);
  if (errors.length > 0) {
    process.stderr.write(`invalid config "${path}":\n`);
    for (const e of errors) process.stderr.write(`  - ${e}\n`);
    process.exitCode = 1;
    return;
  }
  const targets = Array.isArray(config.status) ? config.status : [];
  if (targets.length === 0) {
    process.stdout.write("no status targets defined\n");
    return;
  }
  const results = await checkAll(config);
  let anyDown = false;
  for (const r of results) {
    const detail =
      r.state === "error"
        ? `error: ${r.error}`
        : `${r.httpStatus} in ${r.ms}ms`;
    process.stdout.write(`[${r.state.toUpperCase()}] ${r.name} (${r.url}) — ${detail}\n`);
    if (r.state !== "up") anyDown = true;
  }
  if (anyDown) process.exitCode = 2;
}

async function main() {
  const argv = process.argv.slice(2);
  const command = argv[0];
  const { positionals, out } = parseArgs(argv.slice(1));

  if (!command || command === "help" || command === "--help" || command === "-h") {
    process.stdout.write(USAGE);
    return;
  }

  try {
    switch (command) {
      case "validate": {
        const path = positionals[0];
        if (!path) return fail("validate requires <config.json>");
        return await cmdValidate(await loadConfig(path), path);
      }
      case "build": {
        const path = positionals[0];
        if (!path) return fail("build requires <config.json>");
        return await cmdBuild(await loadConfig(path), path, out);
      }
      case "new": {
        return await cmdNew(out);
      }
      case "check": {
        const path = positionals[0];
        if (!path) return fail("check requires <config.json>");
        return await cmdCheck(await loadConfig(path), path);
      }
      default:
        return fail(`unknown command "${command}". Run "startboard help".`);
    }
  } catch (err) {
    fail(err.message);
  }
}

main();
