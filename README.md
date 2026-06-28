# startboard

A self-hostable **start-page / dashboard generator** for analysts. Point it at a
small JSON config and it produces a single, self-contained static HTML start
board — bookmark groups, working notes, and a service-status panel — with **no
external assets, scripts, stylesheets, fonts, or images**. Drop the file
anywhere (local disk, S3, a static host) and open it.

- Zero runtime dependencies. Plain Node ESM.
- Self-contained output: inline CSS only, nothing fetched off-document.
- Pluggable, injectable status checks — testable fully offline.
- A `validate` command that exits non-zero, ready as a CI gate.

License: COCL 1.0. Maintained by **Cognis Digital**.


<!-- cognis:example:start -->
## 🔎 Example output

**Sample result format** _(illustrative values — run on your own data for real findings):_

```
{
  "boards": [
    {
      "id": "1234567890",
      "name": "My Awesome Startboard",
      "description": "This is my personal startboard for tracking projects and tasks.",
      "columns": [
        {
          "id": "column-1",
          "name": "To-Do",
          "cards": [
            {
              "id": "card-1",
              "title": "Finish project proposal",
              "description": "",
              "status": "todo"
            },
            {
              "id": "card-2",
              "title": "Meet with team",
              "description": "",
              "status": "todo"
            }
          ]
        },
        {
          "id": "column-2",
          "name": "In Progress",
          "cards": [
            {
              "id": "card-3",
              "title": "Start coding",
              "description": "",
              "status": "in_progress"
            }
          ]
        }
      ]
    }
  ]
}
```

<!-- cognis:example:end -->

## Install

Requires Node.js 20 or newer.

```sh
# from a clone
npm install        # no runtime deps; installs nothing but sets up scripts
npm link           # optional: expose the `startboard` bin globally
```

Or run the binary directly without installing:

```sh
node bin/startboard.js help
```

## Quick start

```sh
# 1. scaffold a config
startboard new -o config.json

# 2. (optional) edit config.json, then validate it
startboard validate config.json

# 3. generate a self-contained start board
startboard build config.json -o board.html

# 4. open board.html in any browser
```

## Commands

| Command | Description |
| --- | --- |
| `startboard build <config.json> [-o board.html]` | Generate self-contained HTML. Writes to stdout if `-o` is omitted. |
| `startboard validate <config.json>` | Validate a config. Exits non-zero on any error — use as a CI gate. |
| `startboard new [-o config.json]` | Scaffold a starter config. Writes to stdout if `-o` is omitted. |
| `startboard check <config.json>` | The only networked command. Probes each status target and prints UP/DOWN/ERROR. Exits non-zero if any target is not up. |
| `startboard help` | Show usage. |

> `build` and `validate` are fully offline. Only `check` touches the network.

## Config format

```jsonc
{
  "title": "Analyst Start Board",        // required, non-empty
  "subtitle": "Daily links & status",    // optional
  "theme": "dark",                        // optional: "light" | "dark"

  "groups": [                             // optional bookmark groups
    {
      "title": "Markets",
      "links": [
        { "label": "TradingView", "url": "https://www.tradingview.com", "description": "Charts" }
      ]
    }
  ],

  "notes": [                              // optional note widgets
    { "title": "Today", "body": "Free-form text.\nNewlines are preserved." }
  ],

  "status": [                             // optional status targets
    {
      "name": "Example Service",
      "url": "https://example.com",
      "timeoutMs": 5000,                  // optional, default 5000
      "okStatuses": [200]                 // optional; default is any 2xx/3xx
    }
  ]
}
```

Validation rules (enforced by `validate` and before `build`):

- `title` is required and non-empty.
- All `url` values (links and status targets) must be `http`/`https`.
  `javascript:`, `data:`, and `file:` URLs are rejected — output stays safe.
- `theme`, when present, must be `light` or `dark`.
- `links` require `label` + `url`; `notes` require `title` + `body`;
  `status` targets require `name` + `url`.

A working example lives in [`examples/config.json`](examples/config.json).

## Status checks are pluggable

`check` is the only path that uses the network. The fetcher is abstracted
behind an injectable function, so the entire check pipeline is unit-tested
offline with a fake fetcher and never makes a real request in tests.

```js
import { checkAll } from "@cognis-digital/startboard";

const fakeFetcher = async (url) => ({ status: 200 });
const results = await checkAll(config, fakeFetcher); // no network
```

The default fetcher uses the global `fetch` with an `AbortController` timeout.

## Self-contained guarantee

The generated HTML embeds all styling inline and references no remote
resources. The test suite asserts the output contains no `<script>`, `<link>`,
or `<img>` tags, no `@import`, and no CSS `url()` — and that the only off-document
references present are the bookmark/status URLs you put in the config.

## Library API

```js
import {
  validateConfig,   // (config) => string[]  (empty = valid)
  isSafeUrl,         // (url) => boolean
  buildHtml,         // (config) => string    (full HTML document)
  escapeHtml,        // (str) => string
  checkAll,          // (config, fetcher?) => Promise<CheckResult[]>
  checkTarget,       // (target, fetcher) => Promise<CheckResult>
  scaffoldConfig,    // () => Config
  scaffoldConfigJson // () => string
} from "@cognis-digital/startboard";
```

## Development & tests

Tests use the built-in Node test runner (`node:test`) — no build step, no
test framework to install.

```sh
npm test
# or directly:
node --test "test/*.test.js"
```

CI runs on Ubuntu with Node 20 (`.github/workflows/ci.yml`): it validates the
example config (the CI gate) and runs the full test suite.

## License

COCL 1.0.
