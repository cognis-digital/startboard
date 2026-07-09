// @ts-check
// Built-in color themes. Each theme provides a light + dark palette so the
// output honors prefers-color-scheme automatically. All values are opaque
// colors; no images, gradients-with-url, or external fonts.

/**
 * @typedef {Object} Palette
 * @property {string} bg
 * @property {string} panel
 * @property {string} text
 * @property {string} muted
 * @property {string} accent
 * @property {string} border
 * @property {string} up
 * @property {string} down
 * @property {string} warn
 */

/**
 * @typedef {Object} Theme
 * @property {Palette} light
 * @property {Palette} dark
 */

/** @type {Record<string, Theme>} */
export const THEMES = {
  // Neutral, high-contrast default.
  slate: {
    light: {
      bg: "#f4f5f7", panel: "#ffffff", text: "#1d2127", muted: "#5c6470",
      accent: "#2f6fed", border: "#e2e5ea", up: "#137a3f", down: "#c0392b", warn: "#b7791f",
    },
    dark: {
      bg: "#14171c", panel: "#1d222b", text: "#e6e9ef", muted: "#9aa2b1",
      accent: "#5b8cff", border: "#2a313c", up: "#3ecf7a", down: "#ff6b5e", warn: "#e6b34d",
    },
  },
  // Green-on-black analyst / terminal aesthetic.
  terminal: {
    light: {
      bg: "#eef2ee", panel: "#ffffff", text: "#10221a", muted: "#4a6156",
      accent: "#0a7d43", border: "#cbd9cf", up: "#0a7d43", down: "#a8331f", warn: "#8a6d1b",
    },
    dark: {
      bg: "#0a0f0c", panel: "#0f1712", text: "#c9f7d8", muted: "#5f8f74",
      accent: "#25d366", border: "#1c2a22", up: "#25d366", down: "#ff5c5c", warn: "#e2c14a",
    },
  },
  // Warm, low-glare "amber" reading theme.
  amber: {
    light: {
      bg: "#fbf6ec", panel: "#fffdf8", text: "#2a2113", muted: "#6b5c40",
      accent: "#b5651d", border: "#e8dcc4", up: "#5d7d2b", down: "#a8331f", warn: "#b5651d",
    },
    dark: {
      bg: "#161207", panel: "#1e180c", text: "#f2e4c6", muted: "#a98f5f",
      accent: "#e8a33d", border: "#332815", up: "#a3c760", down: "#ff7a5c", warn: "#e8a33d",
    },
  },
  // Cool "ocean" blue.
  ocean: {
    light: {
      bg: "#eef4f8", panel: "#ffffff", text: "#0f2733", muted: "#4a6675",
      accent: "#0e7490", border: "#d3e2ea", up: "#0f766e", down: "#be123c", warn: "#b45309",
    },
    dark: {
      bg: "#071018", panel: "#0d1a24", text: "#d7ecf5", muted: "#6f95a8",
      accent: "#38bdf8", border: "#16303e", up: "#2dd4bf", down: "#fb7185", warn: "#fbbf24",
    },
  },
};

export const DEFAULT_THEME = "slate";

/** @returns {string[]} */
export function themeNames() {
  return Object.keys(THEMES);
}

/**
 * Resolve a theme name to a Theme, honoring the legacy "light"/"dark" values
 * (which now select the default theme's palette explicitly).
 * @param {string|undefined} name
 * @returns {{ theme: Theme, name: string, forced: null|"light"|"dark" }}
 */
export function resolveTheme(name) {
  if (name === "light" || name === "dark") {
    return { theme: THEMES[DEFAULT_THEME], name: DEFAULT_THEME, forced: name };
  }
  if (name && THEMES[name]) return { theme: THEMES[name], name, forced: null };
  return { theme: THEMES[DEFAULT_THEME], name: DEFAULT_THEME, forced: null };
}
