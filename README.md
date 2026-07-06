# startboard

A self-hostable **start-page / dashboard generator** for analysts. Point it at a
small JSON config and it produces a single, self-contained static HTML start
board — bookmark groups, working notes, and a service-status panel — with **no
external assets, scripts, stylesheets, fonts, or images**. Drop the file
anywhere (local disk, S3, an internal share) and open it. It works offline,
survives a CDN outage, and renders under a strict Content-Security-Policy.

- **Zero runtime dependencies.** Plain Node ESM, standard library only.
- **Self-contained output:** inline CSS, nothing fetched off-document. Icons are
  emoji or inline-SVG `data:` URIs — never a remote favicon.
- **CSP-friendly by default:** the default build emits *zero* JavaScript and no
  inline event handlers. Interactivity (collapsible groups, tabbed boards) is
  CSS-only. An opt-in `--interactive` flag adds one small inline search script.
- **Pluggable, injectable status checks** (HTTP + TCP) — the whole probe
  pipeline is unit-tested offline with fakes and never hits the network in CI.
- **A `validate` command that exits non-zero** — ready as a CI gate.

License: COCL 1.0. Maintained by **Cognis Digital**.

## Why

Dashboard start-pages usually pull favicons, web fonts, and analytics from a
dozen third parties — which means they leak your bookmarks to those hosts, break
on a flaky network, and can't live behind an air-gapped or strict-CSP boundary.
startboard produces one HTML file that references *nothing but the links you
typed*. What you ship is auditable: the test suite proves there are no external
resource loads.

## Install

Requires Node.js 20 or newer (CI runs Node 22).

```sh
# from a clone
npm install        # no runtime deps; just registers scripts
npm link           # optional: expose the `startboard` bin globally
```

Or use the platform installers:

```sh
sh install.sh          # macOS / Linux (npm link, else ~/.local/bin shim)
```
```powershell
./install.ps1          # Windows (npm link, else %LOCALAPPDATA%\startboard\bin shim)
```

Or run the binary directly without installing:

```sh
node bin/startboard.js help
```

Docker:

```sh
docker build -t startboard .
docker run --rm -v "$PWD:/work" startboard build config.json -o board.html
```

## Quick start

```sh
startboard new -o config.json          # 1. scaffold a starter config
startboard validate config.json        # 2. validate it (non-zero exit on error)
startboard build config.json -o board.html   # 3. generate the board
# 4. open board.html in any browser
```

## Commands

| Command | Description |
| --- | --- |
| `startboard build <config.json> [options]` | Generate self-contained HTML. Writes to stdout if `-o` is omitted. |
| `startboard validate <config.json>` | Validate a config. Exits non-zero on any error — use as a CI gate. |
| `startboard new [-o config.json]` | Scaffold a starter config. |
| `startboard check <config.json> [--json]` | The only networked command. Probes each status target (HTTP/TCP) and prints UP/DOWN/ERROR. Exits non-zero if any target is not up. |
| `startboard help` | Show usage. |

**Build options:** `-o/--out <file>`, `--interactive` (add inline search),
`--theme <name>` (`slate`/`terminal`/`amber`/`ocean`/`light`/`dark`),
`--css <file>` (inject validated inline CSS), `--check` (probe + embed live
status), `--concurrency <n>`.

> `build` and `validate` are fully offline. Only `check` (and `build --check`)
> touch the network.

## What it generates

- **Bookmark groups** with optional emoji or inline-SVG icons, per-item ordering,
  and CSS-only **collapsible** sections (`<details>`).
- **Note panels** rendered from a safe markdown-ish subset (headings, bold,
  italic, code, fenced blocks, lists, blockquotes, rules, http(s) links) — all
  escape-first, so raw HTML in a note stays inert.
- **A status panel** listing HTTP/TCP targets. Static files can't self-refresh,
  so `build --check` embeds a point-in-time result plus a "Last checked" stamp.
- **Multiple boards** as a CSS-only **tabbed** layout (radio-button technique),
  plus four built-in themes with automatic `prefers-color-scheme` dark mode.
- **`include`** to compose a config from shared fragments (arrays merge, scalars
  override; cycles rejected).

Config reference: [`docs/CONFIG.md`](docs/CONFIG.md). JSON Schema (draft-07):
[`docs/startboard.schema.json`](docs/startboard.schema.json). Design and
guarantees: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Honest results (from an actual run)

Ran on Node v24.11.1 against the shipped examples:

```
$ startboard validate examples/config.json
ok: "examples/config.json" is a valid startboard config

$ startboard build examples/config.json -o board.html
wrote board.html (15249 bytes)
```

Generated output sizes (a whole dashboard in one small file):

| Example | Output size |
| --- | --- |
| `examples/minimal.json`  | 11,541 bytes |
| `examples/config.json` (analyst/OSINT) | 15,249 bytes |
| `examples/homelab.json` (tabbed, TCP probes, custom CSS) | 15,834 bytes |

Self-containment assertion on `board.html`:

```
$ grep -ciE '<script|<link|<img[^>]+src="https?:' board.html
0
```

Zero external stylesheets, scripts, or remote images. The only http(s) strings
in the file are the bookmark/status URLs from the config itself.

Test suite (`npm test`):

```
ℹ tests 91
ℹ pass 91
ℹ fail 0
```

Demo suite (`sh demos/run_all.sh`) builds every example, asserts
self-containment, exercises `--interactive`, and runs a hermetic local HTTP/TCP
`check` — it exits 0:

```
[4] check with a local probe (hermetic)
    [UP] local HTTP (127.0.0.1:64147) — 3ms
    [ERROR] dead port (127.0.0.1:1) — 2ms connect ECONNREFUSED 127.0.0.1:1
ALL DEMOS PASSED
```

## Self-contained guarantee

The generated HTML embeds all styling inline and references no remote resources.
The test suite asserts the output contains no `<link>`, no external
`<script src>`, no remote `<img>`, no `@import`, and no CSS `url(http…)` — and
that the only off-document references present are the bookmark/status URLs you
put in the config. Icons are emoji text or inline-SVG `data:` URIs, which embed
their bytes in the document (nothing is fetched). See
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#self-containment-guarantee).

### CSP posture

The default build renders correctly under, e.g.,
`default-src 'none'; style-src 'unsafe-inline'; img-src data:` — no script, no
inline handlers. `--interactive` adds one inline `<script>` (search filter) and
then needs `script-src 'unsafe-inline'`; omit the flag for a strict-CSP artifact.

## Accessibility

Landmarks (`header`/`main`/`footer`), a skip-to-content link, `role="region"`
with `aria-label` on every card, `aria-hidden` decorative icons, a
`role="tablist"`/`tabpanel` structure for multi-board layouts, and a print
stylesheet that expands all groups/tabs. Themes ship light + dark palettes tuned
for contrast.

## Status checks are pluggable

`check` is the only path that uses the network. Both probers are injectable, so
the entire pipeline is unit-tested offline with fakes:

```js
import { checkAll } from "@cognis-digital/startboard";

const results = await checkAll(config, {
  fetcher: async (url) => ({ status: 200 }),   // fake HTTP prober
  tcp: async () => ({ connected: true }),       // fake TCP prober
  concurrency: 6,
});
```

The defaults use global `fetch` (with an `AbortController` timeout) and
`net.Socket`.

## Library API

```js
import {
  validateConfig, isSafeUrl, isHostPort, isSafeCss,  // validation
  buildHtml, escapeHtml, statusKey,                   // generation
  renderMarkdown,                                     // safe markdown-ish
  renderIcon, builtinIconNames, isSafeInlineSvg,      // icons
  THEMES, themeNames, resolveTheme,                   // theming
  loadConfig, mergeConfig,                            // config + includes
  checkAll, checkTarget, defaultFetcher, defaultTcpProbe,  // status
  scaffoldConfig, scaffoldConfigJson,                 // scaffolding
} from "@cognis-digital/startboard";
```

## Development

```sh
npm test                 # node:test runner; no framework to install
make demo                # end-to-end demo (also the CI smoke test)
make examples            # build every example into ./dist
make typecheck           # tsc --checkJs if TypeScript is installed (else skipped)
```

Sources carry `// @ts-check` + JSDoc types; `make typecheck` runs
`tsc --checkJs --noEmit` when TypeScript is available (it is not a runtime
dependency, so the target no-ops cleanly if `tsc` is absent).

## Cross-platform

Pure Node standard library, no shell-isms in the JS: paths go through
`node:path`, temp dirs through `node:os`, sockets through `node:net`. Tested on
Windows; the install scripts cover macOS/Linux (`install.sh`) and Windows
(`install.ps1`). CI runs on `ubuntu-latest` with Node 22.

## CI

`.github/workflows/ci.yml` (Ubuntu, Node 22): installs, validates every example
config (the `examples/config.json` gate plus the rest), runs the full test
suite, asserts self-containment of a fresh build, and runs the demo smoke test.

## License

COCL 1.0. See [`LICENSE`](LICENSE).
