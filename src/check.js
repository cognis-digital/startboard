// @ts-check
// Status probing for startboard.
//
// The networked path. Probers are injectable so tests pass fakes and never
// touch the network. Two probe types:
//   * http  — GET the URL, classify by HTTP status (default fetcher = global fetch)
//   * tcp   — open a socket to host:port, classify by connect success
//
// checkAll runs probes with a bounded concurrency limit and preserves input
// order in the returned array.

import net from "node:net";
import { statusKey } from "./build.js";

/**
 * @typedef {Object} CheckResult
 * @property {string} name
 * @property {string} url
 * @property {("http"|"tcp")} type
 * @property {("up"|"down"|"error")} state
 * @property {string} key           stable key matching build.statusKey(target)
 * @property {number} [httpStatus]
 * @property {number} [ms]
 * @property {string} [error]
 */

/**
 * Default HTTP fetcher: a real network request using global fetch.
 * @param {string} url
 * @param {{ timeoutMs: number }} opts
 * @returns {Promise<{ status: number }>}
 */
export async function defaultFetcher(url, opts) {
  const timeoutMs = opts && opts.timeoutMs ? opts.timeoutMs : 5000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: "GET", redirect: "follow", signal: controller.signal });
    return { status: res.status };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Default TCP prober: resolve when a socket connects, reject otherwise.
 * @param {string} hostPort  "host:port"
 * @param {{ timeoutMs: number }} opts
 * @returns {Promise<{ connected: true }>}
 */
export function defaultTcpProbe(hostPort, opts) {
  const timeoutMs = opts && opts.timeoutMs ? opts.timeoutMs : 5000;
  const idx = hostPort.lastIndexOf(":");
  const host = hostPort.slice(0, idx);
  const port = Number(hostPort.slice(idx + 1));
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let settled = false;
    const done = (err) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (err) reject(err);
      else resolve({ connected: true });
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(null));
    socket.once("timeout", () => done(new Error("connect timeout")));
    socket.once("error", (e) => done(e));
    socket.connect(port, host);
  });
}

/**
 * @param {number} status
 * @param {number[]} [okStatuses]
 * @returns {boolean}
 */
function isOk(status, okStatuses) {
  if (Array.isArray(okStatuses) && okStatuses.length > 0) return okStatuses.includes(status);
  return status >= 200 && status < 400;
}

/**
 * Probe a single status target.
 * @param {import("./validate.js").StatusTarget} target
 * @param {object} [probers]
 * @param {(url: string, opts: { timeoutMs: number }) => Promise<{ status: number }>} [probers.fetcher]
 * @param {(hp: string, opts: { timeoutMs: number }) => Promise<{ connected: true }>} [probers.tcp]
 * @returns {Promise<CheckResult>}
 */
export async function checkTarget(target, probers = {}) {
  // Back-compat: a bare fetcher function may be passed (legacy 2-arg form).
  const p = typeof probers === "function" ? { fetcher: probers } : probers || {};
  const fetcher = p.fetcher || defaultFetcher;
  const tcp = p.tcp || defaultTcpProbe;
  const type = target.type === "tcp" ? "tcp" : "http";
  const timeoutMs =
    typeof target.timeoutMs === "number" && target.timeoutMs > 0 ? target.timeoutMs : 5000;
  const key = statusKey(target);
  const started = Date.now();
  try {
    if (type === "tcp") {
      await tcp(target.url, { timeoutMs });
      return { name: target.name, url: target.url, type, key, state: "up", ms: Date.now() - started };
    }
    const res = await fetcher(target.url, { timeoutMs });
    const ms = Date.now() - started;
    const status = res && typeof res.status === "number" ? res.status : 0;
    return {
      name: target.name,
      url: target.url,
      type,
      key,
      state: isOk(status, target.okStatuses) ? "up" : "down",
      httpStatus: status,
      ms,
    };
  } catch (err) {
    return {
      name: target.name,
      url: target.url,
      type,
      key,
      state: "error",
      ms: Date.now() - started,
      error: err && err.message ? err.message : String(err),
    };
  }
}

/**
 * Probe all status targets in a config with bounded concurrency, preserving
 * input order in the result array.
 *
 * Back-compat: `probers` may be a bare fetcher function (legacy 2-arg form).
 * @param {import("./validate.js").Config} config
 * @param {object|Function} [probers]  { fetcher, tcp, concurrency } or a fetcher fn
 * @returns {Promise<CheckResult[]>}
 */
export async function checkAll(config, probers = {}) {
  // Legacy call form: checkAll(config, fakeFetcher)
  const opts = typeof probers === "function" ? { fetcher: probers } : probers || {};
  const targets = Array.isArray(config.status) ? config.status : [];
  if (targets.length === 0) return [];

  const concurrency = Math.max(1, Math.min(opts.concurrency || 6, targets.length));
  const results = new Array(targets.length);
  let next = 0;

  async function worker() {
    while (true) {
      const i = next++;
      if (i >= targets.length) return;
      results[i] = await checkTarget(targets[i], opts);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}
