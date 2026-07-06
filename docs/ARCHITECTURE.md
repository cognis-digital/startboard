# Architecture

startboard is a **generator**: a pure function from a JSON config to a single
self-contained HTML document, plus a thin CLI and an optional networked probe.
It has **zero runtime dependencies** — only the Node standard library.

## Module map

```
bin/startboard.js     CLI: arg parsing, command dispatch, I/O
src/config.js         Config loading + `include` merge (depth-first, cycle-safe)
src/validate.js       Hand-rolled schema validation (mirrors docs/startboard.schema.json)
src/build.js          HTML generation (themes, tabs, groups, notes, status)
src/markdown.js       Safe, escape-first markdown-ish renderer for note bodies
src/icons.js          Emoji text + inline-SVG data-URI glyphs (never a remote favicon)
src/themes.js         Built-in light/dark palettes
src/check.js          Injectable HTTP + TCP probes with bounded concurrency
src/html.js           Shared escapeHtml / slug primitives
src/index.js          Public library surface
```

## Pipeline

```
config.json ──▶ loadConfig ──▶ validateConfig ──▶ buildHtml ──▶ board.html
                (merge includes)  (CI gate)         (pure)
                                                        ▲
                              (optional) checkAll ──────┘  inject live status
```

- **`loadConfig`** reads the file, resolves any `include` array relative to the
  including file, and merges depth-first: array fields (`groups`, `notes`,
  `status`, `boards`) concatenate; scalar fields (`title`, `theme`, …) take the
  last value. Include cycles are detected and rejected.
- **`validateConfig`** returns an array of human-readable error strings (empty =
  valid). It never throws. The CLI turns a non-empty array into a non-zero exit,
  which is what makes `validate` usable as a CI gate.
- **`buildHtml`** is a pure function `(config, options) => string`. No I/O, no
  network, deterministic output for a given input.
- **`checkAll`** is the *only* code path that can touch the network, and only
  when you run `check` or `build --check`.

## Self-containment guarantee

The generated document references **no off-document resources**. Concretely, the
output contains:

- no `<link>` (external stylesheets),
- no `<script src=…>` (external scripts),
- no `<img src="http(s)…">` (remote images),
- no `@import`,
- no CSS `url(http…)` / `url(//…)`.

All styling is inline in one `<style>` block. Group/link icons are either emoji
(plain text) or **inline SVG encoded as a `data:` URI** — a `data:` URI embeds
the bytes in the document itself, so nothing is fetched. (We still forbid `data:`
in *link hrefs* — that would be a script/redirect vector — see `isSafeUrl`.)

The only http(s) strings that legitimately appear in the output are the bookmark
and status **URLs you put in the config**; they are anchor `href` targets, not
resources the page loads. The test suite asserts exactly this.

### CSP posture

The **default** build emits **zero JavaScript and zero inline event handlers**,
so it renders correctly under a strict policy such as
`default-src 'none'; style-src 'unsafe-inline'; img-src data:`. Collapsible
groups use `<details>/<summary>`; multi-board switching uses the CSS radio-button
"tab" technique. Nothing needs script.

`--interactive` adds **one** small inline `<script>` (search-as-you-type filter).
It fetches nothing, but it does require `script-src 'unsafe-inline'`. If you need
a strict-CSP artifact, omit the flag.

## Injectable checks

`check.js` separates *what to probe* from *how to probe*:

```js
checkAll(config, { fetcher, tcp, concurrency });
```

- `fetcher(url, {timeoutMs})` → `{status}` — defaults to global `fetch` with an
  `AbortController` timeout.
- `tcp(hostPort, {timeoutMs})` → resolves on connect — defaults to a `net.Socket`.
- Both are injectable, so the entire probe pipeline is unit-tested with fakes and
  **never** makes a real request in CI.

Results carry a stable `key` (`type|name|url`) so `build --check` can inject live
status into the rendered status panel, matching each result back to its target.

## Escaping & safety model

- `escapeHtml` escapes the five significant characters and is applied to **every**
  piece of user content before it enters markup.
- `renderMarkdown` is **escape-first**: input is HTML-escaped, *then* a fixed,
  closed set of tags is introduced. There is no raw-HTML passthrough, so a note
  body containing `<script>` renders as inert text.
- Markdown links only become anchors for `http`/`https` targets; anything else
  stays literal, so `[x](javascript:…)` can never produce a `javascript:` href.
- Inline-SVG icons are rejected if they contain `<script>`, inline event
  handlers, `<foreignObject>`, or remote/`data:` references (fail closed).
