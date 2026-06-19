// Config validation for startboard.
// Pure, dependency-free. Returns a list of human-readable error strings;
// an empty list means the config is valid.

/**
 * @typedef {Object} Link
 * @property {string} label
 * @property {string} url
 * @property {string} [description]
 */

/**
 * @typedef {Object} LinkGroup
 * @property {string} title
 * @property {Link[]} links
 */

/**
 * @typedef {Object} Note
 * @property {string} title
 * @property {string} body
 */

/**
 * @typedef {Object} StatusTarget
 * @property {string} name
 * @property {string} url
 * @property {number} [timeoutMs]
 * @property {number[]} [okStatuses]
 */

/**
 * @typedef {Object} Config
 * @property {string} title
 * @property {string} [subtitle]
 * @property {LinkGroup[]} [groups]
 * @property {Note[]} [notes]
 * @property {StatusTarget[]} [status]
 * @property {("light"|"dark")} [theme]
 */

const ALLOWED_SCHEMES = ["http:", "https:"];

function isPlainObject(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

/**
 * Validate a parsed URL string. We only allow http/https so the generated
 * board never embeds javascript:, data:, or file: links.
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
 * Validate a config object. Does not throw — returns an array of error
 * messages. Callers decide how to surface them.
 * @param {unknown} config
 * @returns {string[]}
 */
export function validateConfig(config) {
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

  if (config.theme !== undefined && !["light", "dark"].includes(config.theme)) {
    errors.push('config.theme must be "light" or "dark" when present');
  }

  // groups
  if (config.groups !== undefined) {
    if (!Array.isArray(config.groups)) {
      errors.push("config.groups must be an array when present");
    } else {
      config.groups.forEach((group, gi) => {
        const where = `config.groups[${gi}]`;
        if (!isPlainObject(group)) {
          errors.push(`${where} must be an object`);
          return;
        }
        if (!isNonEmptyString(group.title)) {
          errors.push(`${where}.title is required and must be a non-empty string`);
        }
        if (!Array.isArray(group.links)) {
          errors.push(`${where}.links must be an array`);
          return;
        }
        group.links.forEach((link, li) => {
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
        });
      });
    }
  }

  // notes
  if (config.notes !== undefined) {
    if (!Array.isArray(config.notes)) {
      errors.push("config.notes must be an array when present");
    } else {
      config.notes.forEach((note, ni) => {
        const where = `config.notes[${ni}]`;
        if (!isPlainObject(note)) {
          errors.push(`${where} must be an object`);
          return;
        }
        if (!isNonEmptyString(note.title)) {
          errors.push(`${where}.title is required and must be a non-empty string`);
        }
        if (typeof note.body !== "string") {
          errors.push(`${where}.body is required and must be a string`);
        }
      });
    }
  }

  // status targets
  if (config.status !== undefined) {
    if (!Array.isArray(config.status)) {
      errors.push("config.status must be an array when present");
    } else {
      config.status.forEach((target, si) => {
        const where = `config.status[${si}]`;
        if (!isPlainObject(target)) {
          errors.push(`${where} must be an object`);
          return;
        }
        if (!isNonEmptyString(target.name)) {
          errors.push(`${where}.name is required and must be a non-empty string`);
        }
        if (!isNonEmptyString(target.url)) {
          errors.push(`${where}.url is required and must be a non-empty string`);
        } else if (!isSafeUrl(target.url)) {
          errors.push(`${where}.url must be an http(s) URL (got ${JSON.stringify(target.url)})`);
        }
        if (
          target.timeoutMs !== undefined &&
          (typeof target.timeoutMs !== "number" ||
            !Number.isFinite(target.timeoutMs) ||
            target.timeoutMs <= 0)
        ) {
          errors.push(`${where}.timeoutMs must be a positive number when present`);
        }
        if (target.okStatuses !== undefined) {
          if (
            !Array.isArray(target.okStatuses) ||
            !target.okStatuses.every(
              (s) => typeof s === "number" && Number.isInteger(s)
            )
          ) {
            errors.push(`${where}.okStatuses must be an array of integers when present`);
          }
        }
      });
    }
  }

  return errors;
}
