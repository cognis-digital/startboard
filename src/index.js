// @ts-check
// Public library surface for @cognis-digital/startboard.
export { validateConfig, isSafeUrl, isHostPort, isSafeCss } from "./validate.js";
export { buildHtml, escapeHtml, statusKey } from "./build.js";
export { renderMarkdown } from "./markdown.js";
export { renderIcon, builtinIconNames, isSafeInlineSvg } from "./icons.js";
export { THEMES, themeNames, resolveTheme, DEFAULT_THEME } from "./themes.js";
export { loadConfig, mergeConfig, parseConfig } from "./config.js";
export {
  checkAll,
  checkTarget,
  defaultFetcher,
  defaultTcpProbe,
} from "./check.js";
export { scaffoldConfig, scaffoldConfigJson } from "./scaffold.js";
