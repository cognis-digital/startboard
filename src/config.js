// @ts-check
// Config loading + `include` merge. Dependency-free.
//
// A config may reference other config files via a top-level `include` array of
// relative paths. Includes are resolved relative to the including file, merged
// depth-first (earlier includes first, then the current file's own fields),
// with array fields (groups/notes/status/boards) concatenated and scalar
// fields (title/subtitle/theme) taking the last-defined value. Cycles are
// detected and rejected.

import { readFile } from "node:fs/promises";
import { dirname, resolve, isAbsolute } from "node:path";

const ARRAY_KEYS = ["groups", "notes", "status", "boards"];

/**
 * Deep-ish merge of two config objects per startboard rules.
 * @param {Record<string, any>} base
 * @param {Record<string, any>} over
 * @returns {Record<string, any>}
 */
export function mergeConfig(base, over) {
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) {
    if (k === "include") continue;
    if (ARRAY_KEYS.includes(k) && Array.isArray(base[k]) && Array.isArray(v)) {
      out[k] = [...base[k], ...v];
    } else {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Parse a JSON string with a helpful error.
 * @param {string} raw
 * @param {string} path
 * @returns {any}
 */
export function parseConfig(raw, path) {
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `config "${path}" is not valid JSON: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/**
 * Load a config file, resolving and merging any `include` references.
 * Injectable `readFileFn` for hermetic testing.
 * @param {string} path
 * @param {(p: string) => Promise<string>} [readFileFn]
 * @param {Set<string>} [seen]
 * @returns {Promise<Record<string, any>>}
 */
export async function loadConfig(path, readFileFn, seen = new Set()) {
  const read = readFileFn || ((p) => readFile(p, "utf8"));
  const abs = isAbsolute(path) ? path : resolve(process.cwd(), path);

  if (seen.has(abs)) {
    throw new Error(`include cycle detected at "${path}"`);
  }
  seen.add(abs);

  let raw;
  try {
    raw = await read(abs);
  } catch (err) {
    throw new Error(
      `cannot read config "${path}": ${err instanceof Error ? err.message : String(err)}`
    );
  }
  const parsed = parseConfig(raw, path);

  if (parsed && typeof parsed === "object" && Array.isArray(parsed.include)) {
    const baseDir = dirname(abs);
    let merged = {};
    for (const inc of parsed.include) {
      if (typeof inc !== "string") {
        throw new Error(`config "${path}": include entries must be strings`);
      }
      const incPath = isAbsolute(inc) ? inc : resolve(baseDir, inc);
      const sub = await loadConfig(incPath, read, new Set(seen));
      merged = mergeConfig(merged, sub);
    }
    merged = mergeConfig(merged, parsed);
    delete merged.include;
    return merged;
  }

  return parsed;
}
