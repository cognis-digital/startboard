// @ts-check
// Config validation for startboard.
//
// Pure and dependency-free. Returns a list of human-readable error strings; an
// empty list means the config is valid. This is a hand-rolled validator that
// mirrors the JSON Schema shipped in docs/startboard.schema.json — we keep both
// in sync so `validate` needs no runtime dependencies while still offering a
// machine-readable schema for editors/CI.

import { themeNames } from "./themes.js";

/**
 * @typedef {Object} Link
 * @property {string} label
 * @property {string} url
 * @property {string} [description]
 * @property {string} [icon]      emoji, "glyph:name", or inline <svg>
 * @property {number} [order]
 */

/**
 * @typedef {Object} LinkGroup
 * @property {string} title
 * @property {Link[]} links
 * @property {string} [icon]
 * @property {boolean} [collapsed]  render collapsed (CSS-only <details>)
 * @property {number} [order]
 */

/**
 * @typedef {Object} Note
 * @property {string} title
 * @property {string} body
 * @property {boolean} [markdown]  render body as markdown-ish (default true)
 * @property {number} [order]
 */

/**
 * @typedef {Object} StatusTarget
 * @property {string} name
 * @property {string} url         http(s) URL, or host:port when type="tcp"
 * @property {("http"|"tcp")} [type]
 * @property {number} [timeoutMs]
 * @property {number[]} [okStatuses]
 */

/**
 * @typedef {Object} Board
 * @property {string} title
 * @property {string} [icon]
 * @property {LinkGroup[]} [groups]
 * @property {Note[]} [notes]
 * @property {StatusTarget[]} [status]
 */

/**
 * @typedef {Object} Config
 * @property {string} title
 * @property {string} [subtitle]
 * @property {LinkGroup[]} [groups]
 * @property {Note[]} [notes]
 * @property {StatusTarget[]} [status]
 * @property {Board[]} [boards]
 * @property {string} [theme]     theme name, or "light"/"dark"
 * @property {string} [css]       extra inline CSS (validated: no url()/import)
 */

const ALLOWED_SCHEMES = ["http:", "https:"];

function isPlainObject(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

/**
 * Only http/https are allowed so the board never embeds javascript:, data:, or
 * file: links.
 * @param {string} value
 * @returns {boolean}
 */
export function isSafeUrl(value) {
  if (typeof value !== "string" || value.length === 0) return false;
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  return ALLOWED_SCHEMES.includes(parsed.protocol);
}

/**
 * Validate a host:port target used for TCP probes.
 * @param {string} value
 * @returns {boolean}
 */
export function isHostPort(value) {
  if (typeof value !== "string") return false;
  const m = /^([^\s:]+):(\d{1,5})$/.exec(value.trim());
  if (!m) return false;
  const port = Number(m[2]);
  return port >= 1 && port <= 65535;
}

/**
 * Inline CSS supplied via `css` must not fetch off-document or run script.
 * @param {string} css
 * @returns {boolean}
 */
export function isSafeCss(css) {
  if (typeof css !== "string") return false;
  const lowered = css.toLowerCase();
  if (/@import/.test(lowered)) return false;
  if (/url\(\s*['"]?\s*(https?:|\/\/|data:)/.test(lowered)) return false;
  if (/expression\s*\(/.test(lowered)) return false;
  if (lowered.includes("</style") || lowered.includes("<script")) return false;
  return true;
}

/** @param {any[]} links @param {string} where @param {string[]} errors */
function validateLinks(links, where, errors) {
  links.forEach((link, li) => {
    const lw = `${where}.links[${li}]`;
    if (!isPlainObject(link)) {
      errors.push(`${lw} must be an object`);
      return;
    }
    if (!isNonEmptyString(link.label)) {
      errors.push(`${lw}.label is required and must be a non-empty string`);
    }
    if (!isNonEmptyString(link.url)) {
      errors.push(`${lw}.url is required and must be a non-empty string`);
    } else if (!isSafeUrl(link.url)) {
      errors.push(`${lw}.url must be an http(s) URL (got ${JSON.stringify(link.url)})`);
    }
    if (link.description !== undefined && typeof link.description !== "string") {
      errors.push(`${lw}.description must be a string when present`);
    }
    if (link.icon !== undefined && typeof link.icon !== "string") {
      errors.push(`${lw}.icon must be a string when present`);
    }
    if (link.order !== undefined && typeof link.order !== "number") {
      errors.push(`${lw}.order must be a number when present`);
    }
  });
}

/** @param {any[]} groups @param {string} where @param {string[]} errors */
function validateGroups(groups, where, errors) {
  if (!Array.isArray(groups)) {
    errors.push(`${where} must be an array when present`);
    return;
  }
  groups.forEach((group, gi) => {
    const gw = `${where}[${gi}]`;
    if (!isPlainObject(group)) {
      errors.push(`${gw} must be an object`);
      return;
    }
    if (!isNonEmptyString(group.title)) {
      errors.push(`${gw}.title is required and must be a non-empty string`);
    }
    if (group.icon !== undefined && typeof group.icon !== "string") {
      errors.push(`${gw}.icon must be a string when present`);
    }
    if (group.collapsed !== undefined && typeof group.collapsed !== "boolean") {
      errors.push(`${gw}.collapsed must be a boolean when present`);
    }
    if (group.order !== undefined && typeof group.order !== "number") {
      errors.push(`${gw}.order must be a number when present`);
    }
    if (!Array.isArray(group.links)) {
      errors.push(`${gw}.links must be an array`);
      return;
    }
    validateLinks(group.links, gw, errors);
  });
}

/** @param {any[]} notes @param {string} where @param {string[]} errors */
function validateNotes(notes, where, errors) {
  if (!Array.isArray(notes)) {
    errors.push(`${where} must be an array when present`);
    return;
  }
  notes.forEach((note, ni) => {
    const nw = `${where}[${ni}]`;
    if (!isPlainObject(note)) {
      errors.push(`${nw} must be an object`);
      return;
    }
    if (!isNonEmptyString(note.title)) {
      errors.push(`${nw}.title is required and must be a non-empty string`);
    }
    if (typeof note.body !== "string") {
      errors.push(`${nw}.body is required and must be a string`);
    }
    if (note.markdown !== undefined && typeof note.markdown !== "boolean") {
      errors.push(`${nw}.markdown must be a boolean when present`);
    }
    if (note.order !== undefined && typeof note.order !== "number") {
      errors.push(`${nw}.order must be a number when present`);
    }
  });
}

/** @param {any[]} status @param {string} where @param {string[]} errors */
function validateStatus(status, where, errors) {
  if (!Array.isArray(status)) {
    errors.push(`${where} must be an array when present`);
    return;
  }
  status.forEach((target, si) => {
    const tw = `${where}[${si}]`;
    if (!isPlainObject(target)) {
      errors.push(`${tw} must be an object`);
      return;
    }
    if (!isNonEmptyString(target.name)) {
      errors.push(`${tw}.name is required and must be a non-empty string`);
    }
    const type = target.type === undefined ? "http" : target.type;
    if (type !== "http" && type !== "tcp") {
      errors.push(`${tw}.type must be "http" or "tcp" when present`);
    }
    if (!isNonEmptyString(target.url)) {
      errors.push(`${tw}.url is required and must be a non-empty string`);
    } else if (type === "tcp") {
      if (!isHostPort(target.url)) {
        errors.push(`${tw}.url must be "host:port" for a tcp target (got ${JSON.stringify(target.url)})`);
      }
    } else if (!isSafeUrl(target.url)) {
      errors.push(`${tw}.url must be an http(s) URL (got ${JSON.stringify(target.url)})`);
    }
    if (
      target.timeoutMs !== undefined &&
      (typeof target.timeoutMs !== "number" ||
        !Number.isFinite(target.timeoutMs) ||
        target.timeoutMs <= 0)
    ) {
      errors.push(`${tw}.timeoutMs must be a positive number when present`);
    }
    if (target.okStatuses !== undefined) {
      if (
        !Array.isArray(target.okStatuses) ||
        !target.okStatuses.every((s) => typeof s === "number" && Number.isInteger(s))
      ) {
        errors.push(`${tw}.okStatuses must be an array of integers when present`);
      }
    }
  });
}

/**
 * Validate a config object. Does not throw — returns an array of error
 * messages. Callers decide how to surface them.
 * @param {unknown} config
 * @returns {string[]}
 */
export function validateConfig(config) {
  /** @type {string[]} */
  const errors = [];

  if (!isPlainObject(config)) {
    errors.push("config must be a JSON object");
    return errors;
  }

  if (!isNonEmptyString(config.title)) {
    errors.push("config.title is required and must be a non-empty string");
  }

  if (config.subtitle !== undefined && typeof config.subtitle !== "string") {
    errors.push("config.subtitle must be a string when present");
  }

  if (config.theme !== undefined) {
    const ok = ["light", "dark", ...themeNames()];
    if (typeof config.theme !== "string" || !ok.includes(config.theme)) {
      errors.push(`config.theme must be one of ${ok.map((s) => `"${s}"`).join(", ")} when present`);
    }
  }

  if (config.css !== undefined) {
    if (typeof config.css !== "string") {
      errors.push("config.css must be a string when present");
    } else if (!isSafeCss(config.css)) {
      errors.push("config.css must not use @import, url(http/data), expression(), or embedded tags");
    }
  }

  if (config.groups !== undefined) validateGroups(config.groups, "config.groups", errors);
  if (config.notes !== undefined) validateNotes(config.notes, "config.notes", errors);
  if (config.status !== undefined) validateStatus(config.status, "config.status", errors);

  if (config.boards !== undefined) {
    if (!Array.isArray(config.boards)) {
      errors.push("config.boards must be an array when present");
    } else {
      config.boards.forEach((board, bi) => {
        const bw = `config.boards[${bi}]`;
        if (!isPlainObject(board)) {
          errors.push(`${bw} must be an object`);
          return;
        }
        if (!isNonEmptyString(board.title)) {
          errors.push(`${bw}.title is required and must be a non-empty string`);
        }
        if (board.icon !== undefined && typeof board.icon !== "string") {
          errors.push(`${bw}.icon must be a string when present`);
        }
        if (board.groups !== undefined) validateGroups(board.groups, `${bw}.groups`, errors);
        if (board.notes !== undefined) validateNotes(board.notes, `${bw}.notes`, errors);
        if (board.status !== undefined) validateStatus(board.status, `${bw}.status`, errors);
      });
    }
  }

  return errors;
}
