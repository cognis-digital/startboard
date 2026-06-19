// Status probing for startboard.
// The networked path. The fetcher is injectable so tests can pass a fake
// and never touch the network. The default fetcher uses global fetch.

/**
 * @typedef {Object} CheckResult
 * @property {string} name
 * @property {string} url
 * @property {("up"|"down"|"error")} state
 * @property {number} [httpStatus]
 * @property {number} [ms]
 * @property {string} [error]
 */

/**
 * Default fetcher: performs a real network request using global fetch.
 * Returns a minimal { status } shape. Never used in tests.
 * @param {string} url
 * @param {{ timeoutMs: number }} opts
 * @returns {Promise<{ status: number }>}
 */
export async function defaultFetcher(url, opts) {
  const timeoutMs = opts && opts.timeoutMs ? opts.timeoutMs : 5000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
    });
    return { status: res.status };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Decide whether an HTTP status counts as "up".
 * @param {number} status
 * @param {number[]} [okStatuses]
 * @returns {boolean}
 */
function isOk(status, okStatuses) {
  if (Array.isArray(okStatuses) && okStatuses.length > 0) {
    return okStatuses.includes(status);
  }
  return status >= 200 && status < 400;
}

/**
 * Probe a single status target.
 * @param {import("./validate.js").StatusTarget} target
 * @param {(url: string, opts: { timeoutMs: number }) => Promise<{ status: number }>} fetcher
 * @returns {Promise<CheckResult>}
 */
export async function checkTarget(target, fetcher) {
  const timeoutMs =
    typeof target.timeoutMs === "number" && target.timeoutMs > 0
      ? target.timeoutMs
      : 5000;
  const started = Date.now();
  try {
    const res = await fetcher(target.url, { timeoutMs });
    const ms = Date.now() - started;
    const status = res && typeof res.status === "number" ? res.status : 0;
    return {
      name: target.name,
      url: target.url,
      state: isOk(status, target.okStatuses) ? "up" : "down",
      httpStatus: status,
      ms,
    };
  } catch (err) {
    return {
      name: target.name,
      url: target.url,
      state: "error",
      ms: Date.now() - started,
      error: err && err.message ? err.message : String(err),
    };
  }
}

/**
 * Probe all status targets in a config.
 * @param {import("./validate.js").Config} config
 * @param {(url: string, opts: { timeoutMs: number }) => Promise<{ status: number }>} [fetcher]
 * @returns {Promise<CheckResult[]>}
 */
export async function checkAll(config, fetcher = defaultFetcher) {
  const targets = Array.isArray(config.status) ? config.status : [];
  const results = [];
  for (const target of targets) {
    // Sequential to keep ordering deterministic and load gentle.
    results.push(await checkTarget(target, fetcher));
  }
  return results;
}
